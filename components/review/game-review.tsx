"use client";

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
import {
  ArrowLeft,
  ArrowUpDown,
  BookOpen,
  ChartLine,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ListOrdered,
  MessageSquareQuote,
  Play,
  RotateCcw,
  Sparkles,
  Star,
  Target,
  ThumbsUp,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { getBot } from "@/lib/bots/definitions";
import { BoardLayout, PlayerBar, SideDot } from "@/components/chess/board-layout";
import { RatingText } from "@/components/chess/result-mark";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";
import { Segmented } from "@/components/ui/segmented";

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

// Icons for the labels that aren't punctuation (!!, ?!, ??...).
const CLASS_ICONS: Partial<Record<ReviewedMove["cls"], LucideIcon>> = {
  best: Star,
  excellent: ThumbsUp,
  good: Check,
  book: BookOpen,
  miss: X,
};

/** The coloured label badge, as in the move list and on the board. */
function ClassBadge({ cls, size = "sm" }: { cls: ReviewedMove["cls"]; size?: "sm" | "lg" }) {
  const info = CLASS_INFO[cls];
  const Icon = CLASS_ICONS[cls];
  return (
    <span
      title={info.label}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white",
        size === "lg" ? "h-7 min-w-7 px-1.5 text-sm [&_svg]:size-4" : "h-4 min-w-4 px-1 text-[10px] [&_svg]:size-2.5",
      )}
      style={{ backgroundColor: info.color }}
    >
      {Icon ? <Icon strokeWidth={3} aria-hidden /> : info.symbol}
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
  const [tab, setTab] = useState<"analysis" | "moves">("analysis");

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
    const pBot = getBot(p?.id);
    return (
      <PlayerBar
        name={p?.name ?? (color === "white" ? "White" : "Black")}
        href={p && !pBot ? `/u/${encodeURIComponent(p.name)}` : undefined}
        emoji={pBot?.avatar}
        color={color}
        isYou={!!game.myColor && game.myColor === color}
        detail={pBot ? <span>Computer · {pBot.rating}</span> : <RatingText rating={p?.rating} provisional={p?.provisional} />}
        clock={
          s ? (
            <div className="flex h-10 min-w-24 flex-col items-center justify-center rounded-lg bg-card px-3 ring-1 ring-border" title="Accuracy">
              <span className="text-[10px] leading-none text-muted-foreground">Accuracy</span>
              <span className="text-base leading-tight font-bold tabular-nums">{s.accuracy.toFixed(1)}</span>
            </div>
          ) : undefined
        }
      />
    );
  };

  const nav = [
    { icon: ChevronsLeft, title: "Start (Home)", to: 0 },
    { icon: ChevronLeft, title: "Previous (←)", to: ply - 1 },
    { icon: ChevronRight, title: "Next (→)", to: ply + 1 },
    { icon: ChevronsRight, title: "End (End)", to: moves.length },
  ];

  return (
    <BoardLayout
      top={player(flipped ? "white" : "black")}
      bottom={player(flipped ? "black" : "white")}
      boardPrefix={
        <div
          className="relative w-4 shrink-0 overflow-hidden rounded-md bg-neutral-700 ring-1 ring-black/15 sm:w-5"
          title={shownEval ? formatEval(shownEval) : ""}
          aria-label={shownEval ? `Evaluation ${formatEval(shownEval)}` : "Evaluation hidden"}
        >
          <div
            className={cn("absolute inset-x-0 bg-neutral-100 transition-all duration-300", flipped ? "top-0" : "bottom-0")}
            style={{ height: `${whitePct}%` }}
          />
          <span
            className={cn(
              "absolute inset-x-0 text-center text-[9px] font-bold",
              whitePct >= 50 ? "text-neutral-800" : "text-neutral-100",
              whitePct >= 50 !== flipped ? "bottom-1" : "top-1",
            )}
          >
            {retry ? "" : isMateNow ? "#" : shownEval ? formatEval(shownEval).replace("+", "") : ""}
          </span>
        </div>
      }
      board={
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
      }
      side={
        <>
          {/* Summary */}
          <Card>
            <CardHeader
              as="h1"
              title="Game review"
              icon={<ChartLine />}
              description={
                <>
                  {describeEnding(game)}
                  {opening && (
                    <>
                      {" · "}
                      <span title={opening[0]}>{opening[1]}</span>
                    </>
                  )}
                </>
              }
              action={
                <ButtonLink href={`/game/${game.id}`} variant="ghost" size="sm">
                  <ArrowLeft /> Game
                </ButtonLink>
              }
            />
            <CardBody className="space-y-4">
              {failed ? (
                <p className="text-sm text-destructive">The analysis engine couldn&apos;t start in this browser.</p>
              ) : !ready ? (
                <div aria-live="polite">
                  <div className="flex justify-between text-sm">
                    <span>Analysing with Stockfish…</span>
                    <span className="text-muted-foreground tabular-nums">
                      {progress}/{fens.length}
                    </span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary">
                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(progress / fens.length) * 100}%` }} />
                  </div>
                </div>
              ) : (
                <>
                  {story && (
                    <p className="flex gap-2.5 rounded-lg bg-secondary/60 px-3 py-2.5 text-sm">
                      <MessageSquareQuote className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                      {story}
                    </p>
                  )}
                  <SummaryTable white={summaries.white} black={summaries.black} whiteName={game.white?.name ?? "White"} blackName={game.black?.name ?? "Black"} />
                </>
              )}

              {ready && !retry && (
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="secondary" onClick={() => select(keyMoments.find((p) => p > ply) ?? keyMoments[0] ?? ply)} disabled={!keyMoments.length}>
                    <Zap /> Key moments ({keyMoments.length})
                  </Button>
                  <Button onClick={() => startRetry(0)} disabled={!retryPlies.length} title={retryPlies.length ? undefined : "No mistakes to retry"}>
                    <RotateCcw /> Retry mistakes ({retryPlies.length})
                  </Button>
                </div>
              )}
            </CardBody>
          </Card>

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
          ) : (
            <Card>
              <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2 sm:px-4">
                <Segmented
                  label="Panel"
                  value={tab}
                  onChange={setTab}
                  options={[
                    { value: "analysis", label: "Analysis", icon: <Sparkles /> },
                    { value: "moves", label: "Moves", icon: <ListOrdered /> },
                  ]}
                />
                <Button variant="ghost" size="icon-sm" onClick={() => setFlipped((f) => !f)} aria-label="Flip board (F)" title="Flip board (F)">
                  <ArrowUpDown />
                </Button>
              </div>

              <div className="p-3 sm:p-4">
                {tab === "analysis" ? (
                  ready && positions ? (
                    <>
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
                            <p className="mt-1.5 text-muted-foreground">{explanation.detail}</p>
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
                          <div className="mt-3 rounded-lg bg-secondary/60 px-3 py-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-semibold text-muted-foreground">{lineSource.label}</span>
                              {preview ? (
                                <span className="flex gap-0.5">
                                  <Button variant="ghost" size="icon-sm" className="size-6" aria-label="Previous move in line" onClick={() => setPreview({ ...preview, step: Math.max(1, preview.step - 1) })}>
                                    <ChevronLeft />
                                  </Button>
                                  <Button variant="ghost" size="icon-sm" className="size-6" aria-label="Next move in line" onClick={() => setPreview({ ...preview, step: Math.min(preview.line.length, preview.step + 1) })}>
                                    <ChevronRight />
                                  </Button>
                                  <Button variant="ghost" size="icon-sm" className="size-6" aria-label="Close line" onClick={() => setPreview(null)}>
                                    <X />
                                  </Button>
                                </span>
                              ) : (
                                <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-primary" onClick={startPreview}>
                                  <Play /> Show on board
                                </Button>
                              )}
                            </div>
                            <p className="mt-0.5 text-xs leading-relaxed font-medium">
                              {preview
                                ? formatLine(preview.fen, lineSan.slice(0, preview.step)) + (preview.step < lineSan.length ? " …" : "")
                                : formatLine(lineSource.fen, lineSan)}
                            </p>
                          </div>
                        )}
                        {keyMoments.length > 0 && (
                          <div className="mt-3 flex justify-between">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-primary"
                              onClick={() => select([...keyMoments].reverse().find((p) => p < ply) ?? ply)}
                              disabled={!keyMoments.some((p) => p < ply)}
                            >
                              <ChevronLeft /> Previous key moment
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-primary"
                              onClick={() => select(keyMoments.find((p) => p > ply) ?? ply)}
                              disabled={!keyMoments.some((p) => p > ply)}
                            >
                              Next key moment <ChevronRight />
                            </Button>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <p className="py-6 text-center text-sm text-muted-foreground">The analysis appears here when it&apos;s ready.</p>
                  )
                ) : (
                  <div className="max-h-72 overflow-y-auto">
                    <div className="grid grid-cols-[2.25rem_1fr_1fr] gap-x-1 gap-y-0.5">
                      {Array.from({ length: Math.ceil(moves.length / 2) }, (_, r) => (
                        <div key={r} className="contents">
                          <span className="py-1 pl-1 text-sm text-muted-foreground tabular-nums">{r + 1}.</span>
                          {[r * 2 + 1, r * 2 + 2].map((p) =>
                            p <= moves.length ? (
                              <button
                                key={p}
                                type="button"
                                onClick={() => select(p)}
                                className={cn(
                                  "flex items-center gap-1.5 rounded-md px-2 py-1 text-left text-sm font-medium",
                                  ply === p ? "bg-primary text-primary-foreground" : "hover:bg-secondary",
                                )}
                              >
                                {moves[p - 1]}
                                {reviewed[p - 1] && !["good", "excellent"].includes(reviewed[p - 1].cls) && <ClassBadge cls={reviewed[p - 1].cls} />}
                              </button>
                            ) : (
                              <span key={p} />
                            ),
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-3 grid grid-cols-4 gap-1.5">
                  {nav.map(({ icon: Icon, title, to }) => (
                    <Button key={title} variant="secondary" size="sm" title={title} aria-label={title} onClick={() => select(to)} disabled={to < 0 || to > moves.length || to === ply}>
                      <Icon />
                    </Button>
                  ))}
                </div>
              </div>
            </Card>
          )}
        </>
      }
    />
  );
}

const PHASES: { id: Phase; label: string }[] = [
  { id: "opening", label: "Opening" },
  { id: "middlegame", label: "Middlegame" },
  { id: "endgame", label: "Endgame" },
];

/** Accuracy for both players, with the label counts and per-phase accuracy folded underneath. */
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
  const cols = "grid grid-cols-[1fr_4.5rem_4.5rem] items-center";
  return (
    <div className="text-sm">
      <div className="grid grid-cols-2 gap-2">
        {[
          { name: whiteName, color: "white" as const, s: white },
          { name: blackName, color: "black" as const, s: black },
        ].map(({ name, color, s }) => (
          <div key={color} className="rounded-lg bg-secondary/60 px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <SideDot color={color} />
              <span className="truncate">{name}</span>
            </div>
            <div className="mt-0.5 text-2xl font-bold tabular-nums">{s.accuracy.toFixed(1)}</div>
            <div className="text-xs text-muted-foreground">accuracy</div>
          </div>
        ))}
      </div>

      <details className="group mt-3">
        <summary className="flex cursor-pointer list-none items-center justify-between rounded-md py-1 text-sm font-medium text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
          <span className="group-open:hidden">Show breakdown</span>
          <span className="hidden group-open:inline">Hide breakdown</span>
          <ChevronRight className="size-4 transition-transform group-open:rotate-90" aria-hidden />
        </summary>
        <div className={cn(cols, "mt-2 gap-y-1")}>
          <span />
          <span className="flex items-center justify-center gap-1 text-xs font-semibold">
            <SideDot color="white" /> <span className="truncate">{whiteName}</span>
          </span>
          <span className="flex items-center justify-center gap-1 text-xs font-semibold">
            <SideDot color="black" /> <span className="truncate">{blackName}</span>
          </span>
          {ALL_CLASSES.map((c) => (
            <div key={c} className="contents">
              <span className="flex items-center gap-2 text-muted-foreground">
                <ClassBadge cls={c} />
                {CLASS_INFO[c].label}
              </span>
              <span className={cn("text-center tabular-nums", white.counts[c] ? "font-semibold" : "text-muted-foreground/50")}>{white.counts[c]}</span>
              <span className={cn("text-center tabular-nums", black.counts[c] ? "font-semibold" : "text-muted-foreground/50")}>{black.counts[c]}</span>
            </div>
          ))}
        </div>
        <div className={cn(cols, "mt-3 gap-y-1 border-t border-border pt-2 text-xs")}>
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
      </details>
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
    <Card aria-live="polite" className="ring-1 ring-primary/30">
      <CardHeader
        title={done ? "Retry finished" : `Retry mistakes · ${retry.index + 1} of ${retry.plies.length}`}
        icon={<RotateCcw />}
        divider
        action={
          <Button variant="ghost" size="sm" onClick={onExit}>
            Exit
          </Button>
        }
      />
      <CardBody>
        {done ? (
          <div className="text-sm">
            <p className="flex items-center gap-2 text-lg font-semibold">
              <Target className="size-5 text-primary" aria-hidden />
              You found {retry.solved} of {retry.plies.length}
            </p>
            <p className="mt-1 text-muted-foreground">Nice work. Every one you find now is one you&apos;ll spot in a game.</p>
            <Button block className="mt-4" onClick={onExit}>
              Back to the review
            </Button>
          </div>
        ) : move ? (
          <div className="text-sm">
            <p>
              In the game, {move.color === "white" ? "White" : "Black"} played{" "}
              <span className="font-semibold">
                {Math.ceil(move.ply / 2)}
                {move.color === "white" ? "." : "…"} {move.san}
              </span>{" "}
              <ClassBadge cls={move.cls} />. Find something better for {move.color}.
            </p>
            <div className="mt-3 flex min-h-10 items-center rounded-lg bg-secondary/60 px-3 py-2">
              {retry.status === "your-turn" && <span className="text-muted-foreground">Make a move on the board.</span>}
              {retry.status === "checking" && <span>Checking {retry.tried}…</span>}
              {retry.status === "right" && (
                <span className="flex items-center gap-1.5 font-semibold text-emerald-700">
                  <Check className="size-4" aria-hidden /> {retry.tried} is a strong move. Well found!
                </span>
              )}
              {retry.status === "wrong" && (
                <span className="flex items-center gap-1.5 font-semibold text-red-600">
                  <X className="size-4" aria-hidden /> {retry.tried} isn&apos;t it. Try again?
                </span>
              )}
              {retry.status === "solution" && (
                <span>
                  The engine&apos;s move was <span className="font-semibold">{solutionSan}</span> (green arrow).
                </span>
              )}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <Button variant="secondary" size="sm" onClick={onAgain} disabled={retry.status === "your-turn" || retry.status === "checking"}>
                Try again
              </Button>
              <Button variant="secondary" size="sm" onClick={onSolution} disabled={retry.status === "checking" || retry.status === "solution"}>
                Show solution
              </Button>
              <Button size="sm" onClick={onNext} disabled={retry.status === "checking"}>
                {retry.index + 1 < retry.plies.length ? "Next" : "Finish"}
              </Button>
            </div>
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}
