"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { Chess, type Square } from "chess.js";
import { Chessboard } from "react-chessboard";
import type { GameView } from "@/lib/game/view";
import { describeEnding } from "@/lib/game/rules";
import {
  CLASS_LABELS,
  formatEval,
  reviewMoves,
  summarize,
  whiteWinPercent,
  type Eval,
  type PlayerSummary,
  type ReviewedMove,
} from "@/lib/review/analysis";
import { playSound, soundForSan } from "@/lib/sounds";
import { CLASS_COLORS, EvalGraph } from "./eval-graph";

/** Engine thinking time per position; a 40-move game takes about half a minute. */
const MOVETIME_MS = 250;
const CACHE_VERSION = 1;
const HIGHLIGHT = "rgba(246, 246, 105, 0.6)";

type Analysis = { evals: Eval[]; best: (string | null)[] };

function cacheKey(id: string) {
  return `review:v${CACHE_VERSION}:${id}`;
}

function loadCached(id: string, positions: number): Analysis | null {
  try {
    const raw = localStorage.getItem(cacheKey(id));
    const a = raw ? (JSON.parse(raw) as Analysis) : null;
    return a && a.evals.length === positions && a.best.length === positions ? a : null;
  } catch {
    return null;
  }
}

function saveCached(id: string, a: Analysis) {
  try {
    localStorage.setItem(cacheKey(id), JSON.stringify(a));
  } catch {
    // Storage full or blocked: we'll just analyse again next time.
  }
}

function uciToSan(fen: string, uci: string | null): string | null {
  if (!uci) return null;
  try {
    return new Chess(fen).move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }).san;
  } catch {
    return null;
  }
}

function Symbol({ m }: { m: ReviewedMove }) {
  if (m.cls === "best") return <span className="ml-1 text-xs text-emerald-700" title="Best move">★</span>;
  if (!CLASS_COLORS[m.cls]) return null;
  return (
    <span
      className="ml-1 rounded px-1 text-[11px] font-bold text-white"
      style={{ backgroundColor: CLASS_COLORS[m.cls] }}
      title={CLASS_LABELS[m.cls].label}
    >
      {CLASS_LABELS[m.cls].symbol}
    </span>
  );
}

function SummaryRow({ name, s }: { name: string; s: PlayerSummary }) {
  return (
    <div className="flex items-center gap-3">
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{name}</span>
      <span className="text-xs text-muted-foreground tabular-nums" title="Inaccuracies · mistakes · blunders">
        <span style={{ color: CLASS_COLORS.inaccuracy }}>{s.inaccuracies}?!</span> ·{" "}
        <span style={{ color: CLASS_COLORS.mistake }}>{s.mistakes}?</span> ·{" "}
        <span style={{ color: CLASS_COLORS.blunder }}>{s.blunders}??</span>
      </span>
      <span className="w-16 text-right text-lg font-bold tabular-nums">{s.accuracy.toFixed(1)}%</span>
    </div>
  );
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

  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [progress, setProgress] = useState(0);
  const [failed, setFailed] = useState(false);
  const [ply, setPly] = useState(moves.length);
  const [flipped, setFlipped] = useState(game.myColor === "black");

  // Analyse every position (or load a cached review), off the main thread in Stockfish's worker.
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const cached = loadCached(game.id, fens.length);
      if (cached) {
        setAnalysis(cached);
        return;
      }
      try {
        const { getEngine } = await import("@/lib/bots/engine");
        const engine = getEngine();
        const evals: Eval[] = [];
        const best: (string | null)[] = [];
        for (let i = 0; i < fens.length; i++) {
          if (cancelled) return;
          const chess = new Chess(fens[i]);
          const whiteToMove = chess.turn() === "w";
          if (chess.isCheckmate()) {
            evals.push({ mate: whiteToMove ? -1 : 1 });
            best.push(null);
          } else if (chess.isGameOver()) {
            evals.push({ cp: 0 });
            best.push(null);
          } else {
            const { score, best: bestMove } = await engine.analyse(fens[i], MOVETIME_MS);
            // The engine scores from the side to move; reviews use White's point of view.
            const s = score ?? { cp: 0 };
            const flip = whiteToMove ? 1 : -1;
            evals.push("mate" in s ? { mate: s.mate * flip } : { cp: s.cp * flip });
            best.push(bestMove);
          }
          setProgress(i + 1);
        }
        if (cancelled) return;
        const done = { evals, best };
        saveCached(game.id, done);
        setAnalysis(done);
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

  const reviewed = useMemo(
    () => (analysis ? reviewMoves(moves, analysis.evals, analysis.best, played) : []),
    [analysis, moves, played],
  );
  const whiteSummary = useMemo(() => summarize(reviewed, "white"), [reviewed]);
  const blackSummary = useMemo(() => summarize(reviewed, "black"), [reviewed]);

  const select = useCallback(
    (p: number) => {
      const next = Math.max(0, Math.min(moves.length, p));
      if (next === ply + 1 && next > 0) playSound(soundForSan(moves[next - 1]));
      setPly(next);
    },
    [moves, ply],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") select(ply - 1);
      if (e.key === "ArrowRight") select(ply + 1);
      if (e.key === "Home") select(0);
      if (e.key === "End") select(moves.length);
      if (e.key === "f" && !e.metaKey && !e.ctrlKey) setFlipped((f) => !f);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [select, ply, moves.length]);

  const current = ply > 0 ? reviewed[ply - 1] : null;
  const evalNow = analysis?.evals[ply] ?? null;
  const bestHere = analysis?.best[ply] ?? null;
  const betterSan = current && current.cls !== "best" && analysis ? uciToSan(fens[ply - 1], analysis.best[ply - 1]) : null;
  const orientation = flipped ? "black" : "white";

  const squareStyles = useMemo(() => {
    const styles: Record<string, CSSProperties> = {};
    if (ply > 0) {
      const from = played[ply - 1].slice(0, 2), to = played[ply - 1].slice(2, 4);
      styles[from] = { backgroundColor: HIGHLIGHT };
      styles[to] = { backgroundColor: HIGHLIGHT };
    }
    return styles;
  }, [ply, played]);

  const arrows = bestHere
    ? [{ startSquare: bestHere.slice(0, 2) as Square, endSquare: bestHere.slice(2, 4) as Square, color: "rgba(21, 128, 61, 0.75)" }]
    : [];

  const whitePct = evalNow ? whiteWinPercent(evalNow) : 50;
  const isMateNow = ply > 0 && new Chess(fens[ply]).isCheckmate();
  const topName = (flipped ? game.white : game.black)?.name ?? "—";
  const bottomName = (flipped ? game.black : game.white)?.name ?? "—";

  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="min-w-0">
        <div className="flex items-center justify-between py-2 text-sm font-semibold">
          <span>{topName}</span>
        </div>
        <div className="flex gap-2">
          {/* Evaluation bar: White's share from the bottom (or top when flipped). */}
          <div
            className="relative w-5 shrink-0 overflow-hidden rounded bg-neutral-700"
            title={evalNow ? formatEval(evalNow) : "Analysing…"}
            aria-label={evalNow ? `Evaluation ${formatEval(evalNow)}` : "Analysing"}
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
              {isMateNow ? "#" : evalNow ? formatEval(evalNow).replace("+", "") : ""}
            </span>
          </div>
          <div className="min-w-0 flex-1 overflow-hidden rounded-lg shadow-md">
            <Chessboard
              options={{
                id: "review",
                position: fens[ply],
                boardOrientation: orientation,
                allowDragging: false,
                squareStyles,
                arrows,
                lightSquareStyle: { backgroundColor: "var(--board-light)" },
                darkSquareStyle: { backgroundColor: "var(--board-dark)" },
                animationDurationInMs: 150,
              }}
            />
          </div>
        </div>
        <div className="flex items-center justify-between py-2 text-sm font-semibold">
          <span>{bottomName}</span>
        </div>
      </div>

      <aside className="flex min-w-0 flex-col gap-4">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h1 className="font-semibold">Game review</h1>
            <Link href={`/game/${game.id}`} className="text-sm text-primary hover:underline">
              ← Back to game
            </Link>
          </div>
          <p className="text-xs text-muted-foreground">{describeEnding(game)}</p>

          {failed ? (
            <p className="mt-3 text-sm text-destructive">The analysis engine couldn&apos;t start in this browser.</p>
          ) : !analysis ? (
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
            <div className="mt-3 space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Accuracy</span>
              </div>
              <SummaryRow name={`♔ ${game.white?.name ?? "White"}`} s={whiteSummary} />
              <SummaryRow name={`♚ ${game.black?.name ?? "Black"}`} s={blackSummary} />
            </div>
          )}
        </div>

        {analysis && (
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <EvalGraph evals={analysis.evals} moves={moves} reviewed={reviewed} ply={ply} onSelect={select} />
            <div className="mt-3 min-h-10 text-sm" aria-live="polite">
              {current ? (
                <>
                  <span className="font-semibold">
                    {Math.ceil(current.ply / 2)}
                    {current.color === "white" ? "." : "…"} {current.san}
                  </span>{" "}
                  <span className="text-muted-foreground">
                    {CLASS_LABELS[current.cls].label}
                    {evalNow && ` · ${isMateNow ? "checkmate" : formatEval(evalNow)}`}
                  </span>
                  {betterSan && current.cls !== "good" && (
                    <span className="block text-muted-foreground">
                      Best was <span className="font-semibold text-foreground">{betterSan}</span>
                    </span>
                  )}
                </>
              ) : (
                <span className="text-muted-foreground">Starting position. The green arrow shows the engine&apos;s best move.</span>
              )}
            </div>
          </div>
        )}

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
                        className={`flex items-center rounded px-2 py-0.5 text-left font-mono text-sm ${
                          ply === p ? "bg-primary text-primary-foreground" : "hover:bg-secondary"
                        }`}
                      >
                        {moves[p - 1]}
                        {reviewed[p - 1] && <Symbol m={reviewed[p - 1]} />}
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
      </aside>
    </div>
  );
}
