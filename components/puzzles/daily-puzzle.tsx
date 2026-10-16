"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Chess, type Square } from "chess.js";
import { Chessboard, type PieceDropHandlerArgs, type SquareHandlerArgs } from "react-chessboard";
import {
  applyUci,
  isCorrectMove,
  solutionSan,
  solverColor,
  themeNames,
  type DailyPuzzle as Puzzle,
  type DayStats,
  type PuzzleOutcome,
  type PuzzleRecord,
  type PuzzleStats,
} from "@/lib/puzzles/logic";
import { formatLine } from "@/lib/review/explain";
import { playSound, soundForSan } from "@/lib/sounds";
import { OUTCOME_BADGE, formatPuzzleDay } from "./outcome";

const OPPONENT_DELAY_MS = 450;
const LAST_MOVE = "rgba(255, 213, 79, 0.5)";

export type ArchiveItem = { day: string; weekday: string; difficulty: string; outcome: PuzzleOutcome };

type Feedback =
  | { kind: "right"; san: string }
  | { kind: "wrong"; san: string }
  | { kind: "hint" }
  | null;

/** Plays the puzzle's moves up to (not including) `step`. */
function fenAt(p: Puzzle, step: number): string {
  let fen = p.fen;
  for (const m of p.moves.slice(0, step)) fen = applyUci(fen, m)?.fen ?? fen;
  return fen;
}

export function DailyPuzzleBoard({
  puzzle,
  isToday,
  initialRecord,
  initialStats,
  initialDayStats,
  archive,
}: {
  puzzle: Puzzle;
  isToday: boolean;
  initialRecord: PuzzleRecord | null;
  initialStats: PuzzleStats;
  initialDayStats: DayStats;
  archive: ArchiveItem[];
}) {
  const color = solverColor(puzzle);
  const total = puzzle.moves.length;
  const alreadyDone = initialRecord?.status === "solved" || initialRecord?.status === "revealed";

  const [record, setRecord] = useState<PuzzleRecord | null>(initialRecord);
  const [stats, setStats] = useState(initialStats);
  const [dayStats, setDayStats] = useState(initialDayStats);
  // `step` is the index of the next move in puzzle.moves; the solver plays the odd ones.
  const [step, setStep] = useState(alreadyDone ? total : 0);
  const [fen, setFen] = useState(alreadyDone ? fenAt(puzzle, total) : puzzle.fen);
  const [lastMove, setLastMove] = useState<string | null>(alreadyDone ? puzzle.moves[total - 1] : null);
  const [busy, setBusy] = useState(!alreadyDone);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [hintFor, setHintFor] = useState<number | null>(null);
  const [selected, setSelected] = useState<Square | null>(null);
  const [revealing, setRevealing] = useState(false);
  // Practice: playing it again after finishing. Nothing is recorded.
  const [practice, setPractice] = useState(false);
  const [practiceRevealed, setPracticeRevealed] = useState(false);
  const [mistakes, setMistakes] = useState(initialRecord?.mistakes ?? 0);
  const [hints, setHints] = useState(initialRecord?.hints ?? 0);
  const timers = useRef<number[]>([]);

  const finished = step >= total;
  const outcome: PuzzleOutcome =
    record?.status === "solved"
      ? record.mistakes === 0 && record.hints === 0
        ? "perfect"
        : "solved"
      : (record?.status ?? null);
  const done = record?.status === "solved" || record?.status === "revealed";

  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  // Play the opponent's opening move, which sets the puzzle.
  function playOpening() {
    const r = applyUci(puzzle.fen, puzzle.moves[0])!;
    playSound(soundForSan(r.san));
    setFen(r.fen);
    setLastMove(puzzle.moves[0]);
    setStep(1);
    setBusy(false);
  }

  function restart() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setFen(puzzle.fen);
    setStep(0);
    setLastMove(null);
    setFeedback(null);
    setHintFor(null);
    setSelected(null);
    setBusy(true);
    later(playOpening, 700);
  }

  useEffect(() => {
    if (alreadyDone) return;
    const t = window.setTimeout(playOpening, 700);
    return () => clearTimeout(t);
    // Only on first load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function send(action: "mistake" | "hint" | "solved" | "revealed") {
    if (practice || done) return;
    if (action === "solved" || action === "revealed") {
      // Show the result straight away; the server's copy replaces it when it arrives.
      setRecord({ day: puzzle.day, status: action, mistakes, hints, onTime: isToday, completedAt: new Date() });
    }
    try {
      const res = await fetch(`/api/puzzles/${puzzle.day}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as { record: PuzzleRecord; stats?: PuzzleStats; dayStats?: DayStats };
      setRecord(data.record);
      if (data.stats) setStats(data.stats);
      if (data.dayStats) setDayStats(data.dayStats);
    } catch {
      // Offline: the board still works; the result just isn't saved.
    }
  }

  function tryMove(from: Square, to: Square): boolean {
    if (busy || finished || revealing) return false;
    const expected = puzzle.moves[step];
    // Use the solution's promotion piece when the squares match (covers underpromotions).
    const promotion = expected.slice(0, 4) === from + to ? expected[4] : "q";
    const chess = new Chess(fen);
    let san: string;
    let uci: string;
    try {
      const m = chess.move({ from, to, promotion });
      san = m.san;
      uci = m.from + m.to + (m.promotion ?? "");
    } catch {
      return false;
    }
    setSelected(null);
    playSound(soundForSan(san));

    if (!isCorrectMove(fen, uci, expected)) {
      // Show the move briefly, then take it back.
      const before = fen;
      setFen(chess.fen());
      setLastMove(uci);
      setBusy(true);
      setFeedback({ kind: "wrong", san });
      if (!practice && !done) {
        setMistakes((n) => n + 1);
        void send("mistake");
      }
      later(() => {
        setFen(before);
        setLastMove(puzzle.moves[step - 1]);
        setBusy(false);
      }, 600);
      return true;
    }

    setFen(chess.fen());
    setLastMove(uci);
    setFeedback({ kind: "right", san });
    setHintFor(null);
    const next = step + 1;
    if (next >= total || chess.isCheckmate()) {
      setStep(total);
      playSound("end");
      void send("solved");
      return true;
    }
    // The opponent replies.
    setStep(next);
    setBusy(true);
    later(() => {
      const r = applyUci(chess.fen(), puzzle.moves[next])!;
      playSound(soundForSan(r.san));
      setFen(r.fen);
      setLastMove(puzzle.moves[next]);
      setStep(next + 1);
      setBusy(false);
    }, OPPONENT_DELAY_MS);
    return true;
  }

  function onDrop({ sourceSquare, targetSquare }: PieceDropHandlerArgs): boolean {
    if (!targetSquare) return false;
    return tryMove(sourceSquare as Square, targetSquare as Square);
  }

  function onSquareClick({ square, piece }: SquareHandlerArgs) {
    if (busy || finished || revealing) return;
    const sq = square as Square;
    if (selected) {
      const legal = new Chess(fen).moves({ square: selected, verbose: true }).some((m) => m.to === sq);
      if (legal) {
        tryMove(selected, sq);
        return;
      }
    }
    const mine = piece?.pieceType.startsWith(color === "white" ? "w" : "b");
    setSelected(mine && selected !== sq ? sq : null);
  }

  function hint() {
    if (finished || busy) return;
    setFeedback({ kind: "hint" });
    if (hintFor !== step) {
      setHintFor(step);
      if (!practice && !done) setHints((n) => n + 1);
      void send("hint");
    }
  }

  function showSolution() {
    if (finished || revealing) return;
    setRevealing(true);
    setSelected(null);
    setFeedback(null);
    setHintFor(null);
    if (practice) setPracticeRevealed(true);
    else if (!done) void send("revealed");
    let f = fen;
    let i = step;
    const playNext = () => {
      if (i >= total) {
        setStep(total);
        setRevealing(false);
        return;
      }
      const r = applyUci(f, puzzle.moves[i])!;
      playSound(soundForSan(r.san));
      f = r.fen;
      setFen(f);
      setLastMove(puzzle.moves[i]);
      i++;
      setStep(i);
      later(playNext, 700);
    };
    later(playNext, 200);
  }

  function practiceAgain() {
    setPractice(true);
    setPracticeRevealed(false);
    restart();
  }

  const squareStyles = useMemo(() => {
    const styles: Record<string, CSSProperties> = {};
    if (lastMove) {
      styles[lastMove.slice(0, 2)] = { backgroundColor: LAST_MOVE };
      styles[lastMove.slice(2, 4)] = { backgroundColor: LAST_MOVE };
    }
    if (hintFor !== null && hintFor === step && !finished) {
      styles[puzzle.moves[step].slice(0, 2)] = { boxShadow: "inset 0 0 0 4px rgba(37, 99, 235, 0.85)", backgroundColor: "rgba(37, 99, 235, 0.25)" };
    }
    if (selected) {
      styles[selected] = { backgroundColor: "rgba(246, 246, 105, 0.85)" };
      for (const m of new Chess(fen).moves({ square: selected, verbose: true })) {
        styles[m.to] = { backgroundImage: "radial-gradient(circle, rgba(0,0,0,0.18) 22%, transparent 24%)" };
      }
    }
    return styles;
  }, [lastMove, hintFor, step, finished, puzzle.moves, selected, fen]);

  // e.g. "24. Qxg8+ Rxg8 25. Rxg8#"
  const solution = useMemo(() => formatLine(fenAt(puzzle, 1), solutionSan(puzzle)), [puzzle]);
  const themes = themeNames(puzzle.themes);
  const yourMoves = Math.ceil((total - 1) / 2);
  const showResult = finished && !revealing;
  const archiveWithLive = archive.map((a) => (a.day === puzzle.day ? { ...a, outcome } : a));

  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="min-w-0">
        <div className="overflow-hidden rounded-lg shadow-md">
          <Chessboard
            options={{
              id: "puzzle",
              position: fen,
              boardOrientation: color,
              allowDragging: !busy && !finished && !revealing,
              canDragPiece: ({ piece }) => piece.pieceType.startsWith(color === "white" ? "w" : "b"),
              onPieceDrop: onDrop,
              onSquareClick,
              squareStyles,
              lightSquareStyle: { backgroundColor: "var(--board-light)" },
              darkSquareStyle: { backgroundColor: "var(--board-dark)" },
              animationDurationInMs: 200,
            }}
          />
        </div>
      </div>

      <aside className="flex min-w-0 flex-col gap-4">
        <section className="rounded-xl border border-border bg-card p-4 shadow-sm" aria-live="polite">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-lg font-bold">🧩 Daily puzzle</h1>
              <p className="text-sm text-muted-foreground">{formatPuzzleDay(puzzle.day, !isToday)}</p>
            </div>
            <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium">
              {puzzle.difficulty} · {puzzle.rating}
            </span>
          </div>

          {!showResult ? (
            <>
              <p className="mt-4 font-semibold">
                <span className="mr-1.5 inline-block h-3 w-3 rounded-full border border-neutral-400 align-middle" style={{ background: color === "white" ? "#fff" : "#222" }} />
                {color === "white" ? "White" : "Black"} to move
                <span className="font-normal text-muted-foreground">
                  {" "}
                  · find the best move{yourMoves > 1 ? ` (${yourMoves} moves)` : ""}
                </span>
              </p>
              {practice && <p className="mt-1 text-xs text-muted-foreground">Practice: this attempt isn&apos;t recorded.</p>}
              <div className="mt-3 min-h-10 rounded-md bg-secondary/60 px-3 py-2 text-sm">
                {revealing ? (
                  <span>Showing the solution…</span>
                ) : busy && step === 0 ? (
                  <span className="text-muted-foreground">Your opponent is moving…</span>
                ) : feedback?.kind === "wrong" ? (
                  <span className="font-semibold text-red-600">✗ {feedback.san} isn&apos;t it. Try again.</span>
                ) : feedback?.kind === "right" ? (
                  <span className="font-semibold text-emerald-700">✓ {feedback.san}! Keep going.</span>
                ) : feedback?.kind === "hint" ? (
                  <span>💡 Look at the highlighted piece.</span>
                ) : (
                  <span className="text-muted-foreground">Drag or tap a piece to move.</span>
                )}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={hint}
                  disabled={busy || revealing || hintFor === step}
                  className="rounded-md bg-secondary py-2 text-sm font-medium hover:bg-accent disabled:opacity-40"
                >
                  💡 Hint
                </button>
                <button
                  type="button"
                  onClick={showSolution}
                  disabled={revealing || step === 0}
                  className="rounded-md bg-secondary py-2 text-sm font-medium hover:bg-accent disabled:opacity-40"
                >
                  Show solution
                </button>
              </div>
              {!practice && !done && mistakes > 0 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {mistakes} {mistakes === 1 ? "mistake" : "mistakes"} so far. You can still solve it.
                </p>
              )}
            </>
          ) : (
            <div className="mt-4 space-y-3 text-sm">
              {practice ? (
                <p className="text-lg font-semibold">{practiceRevealed ? "Practice done" : "Solved again ✓"}</p>
              ) : outcome && outcome !== "attempted" ? (
                <p className={`text-lg font-semibold ${OUTCOME_BADGE[outcome].className}`}>
                  {OUTCOME_BADGE[outcome].icon} {OUTCOME_BADGE[outcome].label}
                  {outcome === "solved" && record && (
                    <span className="block text-sm font-normal text-muted-foreground">
                      {[
                        record.mistakes ? `${record.mistakes} ${record.mistakes === 1 ? "mistake" : "mistakes"}` : null,
                        record.hints ? `${record.hints} ${record.hints === 1 ? "hint" : "hints"}` : null,
                      ]
                        .filter(Boolean)
                        .join(", ")}
                    </span>
                  )}
                </p>
              ) : null}

              <div className="grid grid-cols-3 gap-2 text-center">
                <Stat label="Streak" value={stats.currentStreak > 0 ? `🔥 ${stats.currentStreak}` : "0"} />
                <Stat label="Best streak" value={String(stats.bestStreak)} />
                <Stat label={isToday ? "Solved today" : "Solved by"} value={String(dayStats.solvers)} />
              </div>
              {!isToday && outcome === "solved" && <p className="text-xs text-muted-foreground">Archive puzzles don&apos;t count towards your streak.</p>}

              <div>
                <span className="text-muted-foreground">Solution: </span>
                <span className="font-medium">{solution}</span>
              </div>
              {themes.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {themes.map((t) => (
                    <span key={t} className="rounded-full bg-secondary px-2 py-0.5 text-xs">
                      {t}
                    </span>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <button type="button" onClick={practiceAgain} className="rounded-md bg-secondary px-3 py-2 text-sm font-medium hover:bg-accent">
                  ↻ Try it again
                </button>
                <a
                  href={`https://lichess.org/${puzzle.game}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                >
                  From a game on Lichess ↗
                </a>
              </div>
            </div>
          )}
        </section>

        <PuzzleArchive items={archiveWithLive} current={puzzle.day} />
      </aside>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-secondary/60 px-2 py-2">
      <div className="text-lg font-bold tabular-nums">{value}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}

/** The last 30 days' puzzles, to catch up on ones you missed. */
function PuzzleArchive({ items, current }: { items: ArchiveItem[]; current: string }) {
  return (
    <section className="rounded-xl border border-border bg-card shadow-sm">
      <h2 className="border-b border-border px-4 py-3 text-sm font-semibold">Past puzzles</h2>
      <ul className="max-h-96 divide-y divide-border overflow-y-auto">
        {items.map((a, i) => {
          const badge = a.outcome ? OUTCOME_BADGE[a.outcome] : null;
          return (
            <li key={a.day}>
              <Link
                href={i === 0 ? "/puzzles" : `/puzzles/${a.day}`}
                className={`flex items-center gap-3 px-4 py-2 text-sm hover:bg-secondary ${a.day === current ? "bg-secondary/70" : ""}`}
              >
                <span className="min-w-0 flex-1 truncate">
                  {i === 0 ? "Today" : formatPuzzleDay(a.day)}
                  <span className="text-xs text-muted-foreground"> · {a.difficulty}</span>
                </span>
                <span className={`w-5 text-center ${badge?.className ?? ""}`} title={badge?.label ?? "Not tried"}>
                  {badge?.icon ?? "·"}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
