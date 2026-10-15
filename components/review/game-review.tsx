"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { Chess, type Square } from "chess.js";
import { Chessboard, type PieceDropHandlerArgs, type SquareHandlerArgs } from "react-chessboard";
import type { GameView } from "@/lib/game/view";
import { describeEnding } from "@/lib/game/rules";
import {
  ALL_CLASSES,
  CLASS_INFO,
  formatEval,
  gameSummary,
  keyMoments as findKeyMoments,
  reviewMoves,
  summarize,
  whiteWinPercent,
  type Eval,
  type Phase,
  type PlayerSummary,
  type PositionInfo,
  type ReviewedMove,
} from "@/lib/review/analysis";
import { explainMove, formatLine, playLine } from "@/lib/review/explain";
import { playSound, soundForSan } from "@/lib/sounds";
import { EvalGraph } from "./eval-graph";

/** Engine time per position (top two moves); a 40-move game takes about half a minute. */
const MOVETIME_MS = 300;
/** Time spent judging a move tried in "Retry". */
const RETRY_MOVETIME_MS = 350;
const CACHE_VERSION = 2;
const HIGHLIGHT = "rgba(246, 246, 105, 0.6)";
const RETRY_CLASSES = new Set(["mistake", "blunder", "miss"]);

type Openings = Record<string, [string, string]>;
type Preview = { fen: string; line: string[]; step: number };
type Retry = {
  plies: number[];
  index: number;
  status: "your-turn" | "checking" | "right" | "wrong" | "solution";
  tried: string | null;
  solved: number;
  fen: string;
};

const positionKey = (fen: string) => fen.split(" ").slice(0, 4).join(" ");
const toWhiteView = (s: { cp: number } | { mate: number }, whiteToMove: boolean): Eval => {
  const flip = whiteToMove ? 1 : -1;
  return "mate" in s ? { mate: s.mate * flip } : { cp: s.cp * flip };
};

function loadCached(id: string, count: number): PositionInfo[] | null {
  try {
    const raw = localStorage.getItem(`review:v${CACHE_VERSION}:${id}`);
    const p = raw ? (JSON.parse(raw) as PositionInfo[]) : null;
    return p && p.length === count ? p : null;
  } catch {
    return null;
  }
}

function saveCached(id: string, p: PositionInfo[]) {
  try {
    localStorage.setItem(`review:v${CACHE_VERSION}:${id}`, JSON.stringify(p));
  } catch {
    // Storage full or blocked: we'll analyse again next time.
  }
}

/** The coloured label badge, as in the move list and on the board. */
function ClassBadge({ cls, size = "sm" }: { cls: ReviewedMove["cls"]; size?: "sm" | "lg" }) {
  const info = CLASS_INFO[cls];
  return (
    <span
      title={info.label}
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white ${
        size === "lg" ? "h-7 min-w-7 px-1.5 text-sm" : "h-4 min-w-4 px-1 text-[10px]"
      }`}
      style={{ backgroundColor: info.color }}
    >
      {info.symbol}
    </span>
  );
}

function PhaseCell({ value }: { value: number | null }) {
  return <span className="tabular-nums">{value === null ? "–" : `${Math.round(value)}%`}</span>;
}

/** Stockfish review of a finished game, run in the browser. */
export function GameReview({ game }: { game: GameView }) {
  const moves = game.moves;
  const { fens, played } = useMemo(() => {
    const chess = new Chess();
    const fens = [chess.fen()];
    const played: string[] = [];
    for (const san of moves) {
      const m = chess.move(san);
      played.push(m.from + m.to + (m.promotion ?? ""));
      fens.push(chess.fen());
    }
    return { fens, played };
  }, [moves]);

  const [positions, setPositions] = useState<PositionInfo[] | null>(null);
  const [progress, setProgress] = useState(0);
  const [failed, setFailed] = useState(false);
  const [openings, setOpenings] = useState<Openings | null>(null);
  const [ply, setPly] = useState(moves.length);
  const [flipped, setFlipped] = useState(game.myColor === "black");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [retry, setRetry] = useState<Retry | null>(null);

  // Opening names (Lichess's public-domain list), for "Book" moves.
  useEffect(() => {
    let cancelled = false;
    fetch("/openings.json")
      .then((r) => (r.ok ? r.json() : {}))
      .then((o: Openings) => !cancelled && setOpenings(o))
      .catch(() => !cancelled && setOpenings({}));
    return () => {
      cancelled = true;
    };
  }, []);

  // Analyse every position (or load a cached review) in Stockfish's worker.
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const cached = loadCached(game.id, fens.length);
      if (cached) {
        setPositions(cached);
        return;
      }
      try {
        const { getEngine } = await import("@/lib/bots/engine");
        const engine = getEngine();
        const out: PositionInfo[] = [];
        for (let i = 0; i < fens.length; i++) {
          if (cancelled) return;
          const chess = new Chess(fens[i]);
          const whiteToMove = chess.turn() === "w";
          if (chess.isCheckmate()) {
            out.push({ eval: { mate: whiteToMove ? -1 : 1 }, best: null, pv: [], second: null });
          } else if (chess.isGameOver()) {
            out.push({ eval: { cp: 0 }, best: null, pv: [], second: null });
          } else {
            const r = await engine.analyse(fens[i], MOVETIME_MS);
            out.push({
              eval: toWhiteView(r.score ?? { cp: 0 }, whiteToMove),
              best: r.best,
              pv: r.pv,
              second: r.second ? toWhiteView(r.second, whiteToMove) : null,
            });
          }
          setProgress(i + 1);
        }
        if (cancelled) return;
        saveCached(game.id, out);
        setPositions(out);
      } catch (err) {
        console.error("Analysis failed", err);
        if (!cancelled) setFailed(true);
      }
    };
    const t = setTimeout(run, 0);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [game.id, fens]);

  const book = useMemo(() => moves.map((_, i) => !!openings?.[positionKey(fens[i + 1])]), [moves, fens, openings]);
  const opening = useMemo(() => {
    if (!openings) return null;
    let found: [string, string] | null = null;
    for (let i = 1; i < Math.min(fens.length, 40); i++) found = openings[positionKey(fens[i])] ?? found;
    return found;
  }, [openings, fens]);

  const reviewed = useMemo(
    () => (positions && openings ? reviewMoves(moves, fens, positions, played, book) : []),
    [positions, openings, moves, fens, played, book],
  );
  const summaries = useMemo(
    () => ({ white: summarize(reviewed, "white"), black: summarize(reviewed, "black") }),
    [reviewed],
  );
  const ready = reviewed.length === moves.length && moves.length > 0;
  const keyMoments = useMemo(() => findKeyMoments(reviewed), [reviewed]);
  const story = useMemo(
    () => gameSummary(reviewed, game.result, { white: game.white?.name ?? "White", black: game.black?.name ?? "Black" }),
    [reviewed, game.result, game.white?.name, game.black?.name],
  );
  const [selected, setSelected] = useState<Square | null>(null);
  const retryPlies = useMemo(
    () =>
      reviewed
        .filter((m) => RETRY_CLASSES.has(m.cls) && (!game.myColor || m.color === game.myColor))
        .map((m) => m.ply),
    [reviewed, game.myColor],
  );

  const select = useCallback(
    (p: number) => {
      const next = Math.max(0, Math.min(moves.length, p));
      if (next === ply + 1 && next > 0) playSound(soundForSan(moves[next - 1]));
      setPreview(null);
      setPly(next);
    },
    [moves, ply],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (retry) return;
      if (e.key === "ArrowLeft") select(ply - 1);
      if (e.key === "ArrowRight") select(ply + 1);
      if (e.key === "Home") select(0);
      if (e.key === "End") select(moves.length);
      if (e.key === "f" && !e.metaKey && !e.ctrlKey) setFlipped((f) => !f);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [select, ply, moves.length, retry]);

  // ---- current move, coaching and lines --------------------------------------

  const current = ply > 0 && ready ? reviewed[ply - 1] : null;
  const evalNow = positions?.[ply]?.eval ?? null;
  const explanation =
    current && positions
      ? explainMove(current, fens[ply - 1], fens[ply], positions[ply - 1], positions[ply], opening?.[1] ?? null)
      : null;
  // Non-best moves: the line the engine wanted instead. Otherwise: how the game should continue.
  const lineSource =
    current && positions && current.cls !== "best" && current.cls !== "book" && current.cls !== "brilliant" && current.cls !== "great"
      ? { fen: fens[ply - 1], pv: positions[ply - 1].pv, label: "Best line" }
      : positions?.[ply]?.pv.length
        ? { fen: fens[ply], pv: positions[ply].pv, label: "Follow-up" }
        : null;
  const lineSan = lineSource ? playLine(lineSource.fen, lineSource.pv.slice(0, 8)).san : [];

  function startPreview() {
    if (!lineSource) return;
    setPreview({ fen: lineSource.fen, line: lineSource.pv.slice(0, lineSan.length), step: 1 });
  }
  const previewFen = preview ? playLine(preview.fen, preview.line.slice(0, preview.step)).fen : null;

  // ---- retry your mistakes ---------------------------------------------------

  const retryPly = retry ? retry.plies[retry.index] : null;
  const retryMove = retryPly ? reviewed[retryPly - 1] : null;

  function startRetry(index = 0) {
    if (!retryPlies.length) return;
    const p = retryPlies[index];
    setPreview(null);
    setPly(p - 1);
    setFlipped(reviewed[p - 1].color === "black");
    setRetry((r) => ({
      plies: retryPlies,
      index,
      status: "your-turn",
      tried: null,
      solved: r?.solved ?? 0,
      fen: fens[p - 1],
    }));
  }

  async function judgeRetry(from: string, to: string): Promise<boolean> {
    if (!retry || !retryPly || !positions || retry.status !== "your-turn") return false;
    const chess = new Chess(retry.fen);
    let move;
    try {
      move = chess.move({ from: from as Square, to: to as Square, promotion: "q" });
    } catch {
      return false;
    }
    const uci = move.from + move.to + (move.promotion ?? "");
    const before = positions[retryPly - 1];
    const mover = retryMove!.color;
    setRetry({ ...retry, status: "checking", tried: move.san, fen: chess.fen() });
    playSound(soundForSan(move.san));
    let good = uci === before.best;
    if (!good && uci !== played[retryPly - 1]) {
      // Not the engine's first choice: accept it if it keeps nearly all the winning chances.
      const { getEngine } = await import("@/lib/bots/engine");
      const r = chess.isCheckmate()
        ? { score: { mate: 0 } }
        : await getEngine().analyse(chess.fen(), RETRY_MOVETIME_MS);
      const afterWhite = chess.isCheckmate()
        ? mover === "white"
          ? 100
          : 0
        : whiteWinPercent(toWhiteView(r.score ?? { cp: 0 }, chess.turn() === "w"));
      const beforeWhite = whiteWinPercent(before.eval);
      const loss = mover === "white" ? beforeWhite - afterWhite : afterWhite - beforeWhite;
      good = loss < 5;
    }
    setRetry((r) =>
      r ? { ...r, status: good ? "right" : "wrong", solved: r.solved + (good ? 1 : 0) } : r,
    );
    return true;
  }

  function onRetryClick({ square, piece }: SquareHandlerArgs) {
    if (!retry || retry.status !== "your-turn" || !retryMove) return;
    const sq = square as Square;
    const legal = selected ? new Chess(retry.fen).moves({ square: selected, verbose: true }).some((m) => m.to === sq) : false;
    if (selected && legal) {
      setSelected(null);
      void judgeRetry(selected, sq);
      return;
    }
    const mine = piece?.pieceType.startsWith(retryMove.color === "white" ? "w" : "b");
    setSelected(mine && selected !== sq ? sq : null);
  }

  function onRetryDrop({ sourceSquare, targetSquare }: PieceDropHandlerArgs): boolean {
    if (!targetSquare) return false;
    const legal = new Chess(retry!.fen).moves({ square: sourceSquare as Square, verbose: true }).some((m) => m.to === targetSquare);
    if (!legal) return false;
    setSelected(null);
    void judgeRetry(sourceSquare, targetSquare);
    return true;
  }

  function retryAgain() {
    if (retry && retryPly) setRetry({ ...retry, status: "your-turn", tried: null, fen: fens[retryPly - 1] });
  }

  function retryNext() {
    if (!retry) return;
    if (retry.index + 1 < retry.plies.length) startRetry(retry.index + 1);
    else setRetry({ ...retry, index: retry.plies.length });
  }

  // ---- board -----------------------------------------------------------------

  const boardFen = retry && retryPly ? retry.fen : (previewFen ?? fens[ply]);
  const orientation = flipped ? "black" : "white";
  const retrySolutionUci = retry && retryPly && positions ? positions[retryPly - 1].best : null;

  const squareStyles = useMemo(() => {
    const styles: Record<string, CSSProperties> = {};
    if (!retry && !preview && ply > 0) {
      styles[played[ply - 1].slice(0, 2)] = { backgroundColor: HIGHLIGHT };
      styles[played[ply - 1].slice(2, 4)] = { backgroundColor: HIGHLIGHT };
    }
    if (retry && selected) {
      styles[selected] = { backgroundColor: "rgba(246, 246, 105, 0.85)" };
      for (const m of new Chess(retry.fen).moves({ square: selected, verbose: true })) {
        styles[m.to] = { backgroundImage: "radial-gradient(circle, rgba(0,0,0,0.18) 22%, transparent 24%)" };
      }
    }
    return styles;
  }, [ply, played, retry, preview, selected]);

  let arrows: { startSquare: string; endSquare: string; color: string }[] = [];
  if (retry && retry.status === "solution" && retrySolutionUci) {
    arrows = [{ startSquare: retrySolutionUci.slice(0, 2), endSquare: retrySolutionUci.slice(2, 4), color: "rgba(21, 128, 61, 0.8)" }];
  } else if (!retry && !preview && current && lineSource?.label === "Best line" && positions?.[ply - 1].best) {
    const b = positions[ply - 1].best!;
    arrows = [{ startSquare: b.slice(0, 2), endSquare: b.slice(2, 4), color: "rgba(21, 128, 61, 0.75)" }];
  } else if (!retry && !preview && positions?.[ply]?.best) {
    const b = positions[ply].best!;
    arrows = [{ startSquare: b.slice(0, 2), endSquare: b.slice(2, 4), color: "rgba(21, 128, 61, 0.55)" }];
  }

  // The move's label badge on its destination square.
  const badgeSquare = !retry && !preview && current ? current.uci.slice(2, 4) : null;
  const squareRenderer = ({ square, children }: SquareHandlerArgs & { children?: React.ReactNode }) => (
    <div className="relative h-full w-full">
      {children}
      {square === badgeSquare && current && (
        <span className="pointer-events-none absolute -top-1.5 -right-1.5 z-10 drop-shadow">
          <ClassBadge cls={current.cls} size="lg" />
        </span>
      )}
    </div>
  );

  const shownEval = retry ? null : evalNow;
  const whitePct = shownEval ? whiteWinPercent(shownEval) : 50;
  const isMateNow = ply > 0 && new Chess(fens[ply]).isCheckmate();

  const player = (color: "white" | "black") => {
    const p = color === "white" ? game.white : game.black;
    const s = ready ? summaries[color] : null;
    return (
      <div className="flex items-center justify-between py-2 text-sm">
        <span className="font-semibold">
          {color === "white" ? "♔" : "♚"} {p?.name ?? "—"}
          {p?.rating != null && <span className="ml-1 font-normal text-muted-foreground">{p.rating}</span>}
        </span>
        {s && <span className="rounded bg-secondary px-2 py-0.5 text-xs font-semibold tabular-nums">{s.accuracy.toFixed(1)}%</span>}
      </div>
    );
  };

  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_400px]">
      <div className="min-w-0">
        {player(flipped ? "white" : "black")}
        <div className="flex gap-2">
          <div
            className="relative w-5 shrink-0 overflow-hidden rounded bg-neutral-700"
            title={shownEval ? formatEval(shownEval) : ""}
            aria-label={shownEval ? `Evaluation ${formatEval(shownEval)}` : "Evaluation hidden"}
          >
            <div
              className={`absolute inset-x-0 bg-neutral-100 transition-all duration-300 ${flipped ? "top-0" : "bottom-0"}`}
              style={{ height: `${whitePct}%` }}
            />
            <span
              className={`absolute inset-x-0 text-center text-[9px] font-bold ${
                whitePct >= 50 ? "text-neutral-800" : "text-neutral-100"
              } ${whitePct >= 50 !== flipped ? "bottom-1" : "top-1"}`}
            >
              {retry ? "" : isMateNow ? "#" : shownEval ? formatEval(shownEval).replace("+", "") : ""}
            </span>
          </div>
          <div className="min-w-0 flex-1 overflow-hidden rounded-lg shadow-md">
            <Chessboard
              options={{
                id: "review",
                position: boardFen,
                boardOrientation: orientation,
                allowDragging: retry?.status === "your-turn",
                canDragPiece: ({ piece }) =>
                  retry?.status === "your-turn" && !!retryMove && piece.pieceType.startsWith(retryMove.color === "white" ? "w" : "b"),
                onPieceDrop: retry ? onRetryDrop : undefined,
                onSquareClick: retry ? onRetryClick : undefined,
                squareStyles,
                squareRenderer,
                arrows,
                lightSquareStyle: { backgroundColor: "var(--board-light)" },
                darkSquareStyle: { backgroundColor: "var(--board-dark)" },
                animationDurationInMs: 150,
              }}
            />
          </div>
        </div>
        {player(flipped ? "black" : "white")}
      </div>

      <aside className="flex min-w-0 flex-col gap-4">
        {/* Summary */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h1 className="font-semibold">Game review</h1>
            <Link href={`/game/${game.id}`} className="text-sm text-primary hover:underline">
              ← Back to game
            </Link>
          </div>
          <p className="text-xs text-muted-foreground">
            {describeEnding(game)}
            {opening && (
              <>
                {" · "}
                <span title={opening[0]}>{opening[1]}</span>
              </>
            )}
          </p>

          {failed ? (
            <p className="mt-3 text-sm text-destructive">The analysis engine couldn&apos;t start in this browser.</p>
          ) : !ready ? (
            <div className="mt-3" aria-live="polite">
              <div className="flex justify-between text-sm">
                <span>Analysing with Stockfish…</span>
                <span className="tabular-nums text-muted-foreground">
                  {progress}/{fens.length}
                </span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-secondary">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(progress / fens.length) * 100}%` }} />
              </div>
            </div>
          ) : (
            <>
            {story && <p className="mt-2 rounded-md bg-secondary/60 px-3 py-2 text-sm">💬 {story}</p>}
            <SummaryTable white={summaries.white} black={summaries.black} whiteName={game.white?.name ?? "White"} blackName={game.black?.name ?? "Black"} />
            </>
          )}

          {ready && !retry && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => select(keyMoments.find((p) => p > ply) ?? keyMoments[0] ?? ply)}
                disabled={!keyMoments.length}
                className="rounded-md bg-secondary py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
              >
                ⚡ Key moments ({keyMoments.length})
              </button>
              <button
                type="button"
                onClick={() => startRetry(0)}
                disabled={!retryPlies.length}
                title={retryPlies.length ? undefined : "No mistakes to retry"}
                className="rounded-md bg-primary py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                ↻ Retry {game.myColor ? "your " : ""}mistakes ({retryPlies.length})
              </button>
            </div>
          )}
        </div>

        {/* Coach / retry panel */}
        {ready && retry ? (
          <RetryPanel
            retry={retry}
            move={retryMove}
            solutionSan={retrySolutionUci && retryPly ? playLine(fens[retryPly - 1], [retrySolutionUci]).san[0] : null}
            onAgain={retryAgain}
            onSolution={() => setRetry({ ...retry, status: "solution", fen: fens[retryPly! - 1] })}
            onNext={retryNext}
            onExit={() => {
              setRetry(null);
              if (retryPly) setPly(retryPly);
            }}
          />
        ) : ready && positions ? (
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <EvalGraph evals={positions.map((p) => p.eval)} moves={moves} reviewed={reviewed} ply={ply} onSelect={select} />
            <div className="mt-3 min-h-16 text-sm" aria-live="polite">
              {current && explanation ? (
                <>
                  <div className="flex items-center gap-2">
                    <ClassBadge cls={current.cls} size="lg" />
                    <span className="font-semibold">{explanation.headline}</span>
                    <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                      {evalNow && (isMateNow ? "#" : formatEval(evalNow))}
                    </span>
                  </div>
                  <p className="mt-1 text-muted-foreground">{explanation.detail}</p>
                  {explanation.better && !["book", "best", "brilliant", "great"].includes(current.cls) && (
                    <p className="mt-1">
                      Best was <span className="font-semibold">{explanation.better}</span>
                    </p>
                  )}
                </>
              ) : (
                <p className="text-muted-foreground">Starting position. Step through the game or jump to a key moment.</p>
              )}
              {lineSource && lineSan.length > 0 && (
                <div className="mt-2 rounded-md bg-secondary/60 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-muted-foreground">{lineSource.label}</span>
                    {preview ? (
                      <span className="flex gap-1">
                        <button type="button" onClick={() => setPreview({ ...preview, step: Math.max(1, preview.step - 1) })} className="rounded px-1.5 text-xs hover:bg-accent" aria-label="Previous move in line">◀</button>
                        <button type="button" onClick={() => setPreview({ ...preview, step: Math.min(preview.line.length, preview.step + 1) })} className="rounded px-1.5 text-xs hover:bg-accent" aria-label="Next move in line">▶</button>
                        <button type="button" onClick={() => setPreview(null)} className="rounded px-1.5 text-xs hover:bg-accent" aria-label="Close line">✕</button>
                      </span>
                    ) : (
                      <button type="button" onClick={startPreview} className="rounded px-2 text-xs font-medium text-primary hover:bg-accent">
                        ▶ Show on board
                      </button>
                    )}
                  </div>
                  <p className="mt-0.5 font-mono text-xs leading-relaxed">
                    {preview
                      ? formatLine(preview.fen, lineSan.slice(0, preview.step)) + (preview.step < lineSan.length ? " …" : "")
                      : formatLine(lineSource.fen, lineSan)}
                  </p>
                </div>
              )}
              {keyMoments.length > 0 && (
                <div className="mt-2 flex justify-between text-xs">
                  <button
                    type="button"
                    onClick={() => select([...keyMoments].reverse().find((p) => p < ply) ?? ply)}
                    disabled={!keyMoments.some((p) => p < ply)}
                    className="rounded px-2 py-1 font-medium text-primary hover:bg-accent disabled:opacity-40"
                  >
                    ◀ Previous key moment
                  </button>
                  <button
                    type="button"
                    onClick={() => select(keyMoments.find((p) => p > ply) ?? ply)}
                    disabled={!keyMoments.some((p) => p > ply)}
                    className="rounded px-2 py-1 font-medium text-primary hover:bg-accent disabled:opacity-40"
                  >
                    Next key moment ▶
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : null}

        {/* Moves */}
        {!retry && (
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-semibold">Moves</span>
              <button
                type="button"
                onClick={() => setFlipped((f) => !f)}
                title="Flip board (F)"
                className="rounded-md bg-secondary px-2 py-1 text-xs font-medium hover:bg-accent"
              >
                ⇅ Flip
              </button>
            </div>
            <div className="max-h-64 overflow-y-auto rounded-md bg-background/60 p-2">
              <div className="grid grid-cols-[2.5rem_1fr_1fr] gap-y-0.5">
                {Array.from({ length: Math.ceil(moves.length / 2) }, (_, r) => (
                  <div key={r} className="contents">
                    <span className="py-0.5 text-sm text-muted-foreground">{r + 1}.</span>
                    {[r * 2 + 1, r * 2 + 2].map((p) =>
                      p <= moves.length ? (
                        <button
                          key={p}
                          type="button"
                          onClick={() => select(p)}
                          className={`flex items-center gap-1 rounded px-2 py-0.5 text-left font-mono text-sm ${
                            ply === p ? "bg-primary text-primary-foreground" : "hover:bg-secondary"
                          }`}
                        >
                          {moves[p - 1]}
                          {reviewed[p - 1] && !["good", "excellent"].includes(reviewed[p - 1].cls) && (
                            <ClassBadge cls={reviewed[p - 1].cls} />
                          )}
                        </button>
                      ) : (
                        <span key={p} />
                      ),
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-2 grid grid-cols-4 gap-1">
              {[
                { label: "⏮", title: "Start (Home)", to: 0 },
                { label: "◀", title: "Previous (←)", to: ply - 1 },
                { label: "▶", title: "Next (→)", to: ply + 1 },
                { label: "⏭", title: "End (End)", to: moves.length },
              ].map((b) => (
                <button
                  key={b.title}
                  type="button"
                  title={b.title}
                  aria-label={b.title}
                  onClick={() => select(b.to)}
                  disabled={b.to < 0 || b.to > moves.length || b.to === ply}
                  className="rounded-md bg-secondary py-1.5 text-sm hover:bg-accent disabled:opacity-40"
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

const PHASES: { id: Phase; label: string }[] = [
  { id: "opening", label: "Opening" },
  { id: "middlegame", label: "Middlegame" },
  { id: "endgame", label: "Endgame" },
];

/** Accuracy, per-phase accuracy and label counts for both players, side by side. */
function SummaryTable({
  white,
  black,
  whiteName,
  blackName,
}: {
  white: PlayerSummary;
  black: PlayerSummary;
  whiteName: string;
  blackName: string;
}) {
  return (
    <div className="mt-3 text-sm">
      <div className="grid grid-cols-[1fr_4.5rem_4.5rem] items-center gap-y-1">
        <span />
        <span className="truncate text-center text-xs font-semibold" title={whiteName}>
          ♔ {whiteName}
        </span>
        <span className="truncate text-center text-xs font-semibold" title={blackName}>
          ♚ {blackName}
        </span>

        <span className="font-medium">Accuracy</span>
        <span className="text-center text-lg font-bold tabular-nums">{white.accuracy.toFixed(1)}</span>
        <span className="text-center text-lg font-bold tabular-nums">{black.accuracy.toFixed(1)}</span>

        {ALL_CLASSES.map((c) => (
          <div key={c} className="contents">
            <span className="flex items-center gap-2 text-muted-foreground">
              <ClassBadge cls={c} />
              {CLASS_INFO[c].label}
            </span>
            <span className={`text-center tabular-nums ${white.counts[c] ? "font-semibold" : "text-muted-foreground/60"}`}>
              {white.counts[c]}
            </span>
            <span className={`text-center tabular-nums ${black.counts[c] ? "font-semibold" : "text-muted-foreground/60"}`}>
              {black.counts[c]}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-[1fr_4.5rem_4.5rem] gap-y-1 border-t border-border pt-2 text-xs">
        {PHASES.map((p) => (
          <div key={p.id} className="contents">
            <span className="text-muted-foreground">{p.label}</span>
            <span className="text-center">
              <PhaseCell value={white.phases[p.id]} />
            </span>
            <span className="text-center">
              <PhaseCell value={black.phases[p.id]} />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** "Retry your mistakes": find a better move in each position where you went wrong. */
function RetryPanel({
  retry,
  move,
  solutionSan,
  onAgain,
  onSolution,
  onNext,
  onExit,
}: {
  retry: Retry;
  move: ReviewedMove | null;
  solutionSan: string | null;
  onAgain: () => void;
  onSolution: () => void;
  onNext: () => void;
  onExit: () => void;
}) {
  const done = retry.index >= retry.plies.length;
  return (
    <div className="rounded-xl border border-primary/40 bg-card p-4 shadow-sm" aria-live="polite">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">
          ↻ Retry mistakes {done ? "" : `· ${retry.index + 1} of ${retry.plies.length}`}
        </span>
        <button type="button" onClick={onExit} className="text-xs text-muted-foreground hover:text-foreground">
          Exit
        </button>
      </div>

      {done ? (
        <div className="mt-3 text-sm">
          <p className="text-lg font-semibold">
            You found {retry.solved} of {retry.plies.length} 🎯
          </p>
          <p className="text-muted-foreground">Nice work. Every one you find now is one you&apos;ll spot in a game.</p>
          <button type="button" onClick={onExit} className="mt-3 w-full rounded-md bg-primary py-2 font-semibold text-primary-foreground">
            Back to the review
          </button>
        </div>
      ) : move ? (
        <div className="mt-2 text-sm">
          <p>
            In the game, {move.color === "white" ? "White" : "Black"} played{" "}
            <span className="font-semibold">
              {Math.ceil(move.ply / 2)}
              {move.color === "white" ? "." : "…"} {move.san}
            </span>{" "}
            <ClassBadge cls={move.cls} />. Find something better for {move.color}.
          </p>
          <div className="mt-3 min-h-10 rounded-md bg-secondary/60 px-3 py-2">
            {retry.status === "your-turn" && <span className="text-muted-foreground">Make a move on the board.</span>}
            {retry.status === "checking" && <span>Checking {retry.tried}…</span>}
            {retry.status === "right" && (
              <span className="font-semibold text-emerald-700">✓ {retry.tried} is a strong move. Well found!</span>
            )}
            {retry.status === "wrong" && <span className="font-semibold text-red-600">✗ {retry.tried} isn&apos;t it. Try again?</span>}
            {retry.status === "solution" && (
              <span>
                The engine&apos;s move was <span className="font-semibold">{solutionSan}</span> (green arrow).
              </span>
            )}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={onAgain}
              disabled={retry.status === "your-turn" || retry.status === "checking"}
              className="rounded-md bg-secondary py-2 text-xs font-medium hover:bg-accent disabled:opacity-40"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={onSolution}
              disabled={retry.status === "checking" || retry.status === "solution"}
              className="rounded-md bg-secondary py-2 text-xs font-medium hover:bg-accent disabled:opacity-40"
            >
              Show solution
            </button>
            <button
              type="button"
              onClick={onNext}
              disabled={retry.status === "checking"}
              className="rounded-md bg-primary py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-40"
            >
              {retry.index + 1 < retry.plies.length ? "Next" : "Finish"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
