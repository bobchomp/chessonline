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
import { CalendarDays, Check, ExternalLink, Eye, Flame, Lightbulb, Puzzle as PuzzleIcon, RotateCcw, X } from "lucide-react";
import { BoardLayout, SideDot } from "@/components/chess/board-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";
import { Stat } from "@/components/ui/stat";

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

  const ResultIcon = outcome && outcome !== "attempted" ? OUTCOME_BADGE[outcome].icon : null;

  return (
    <BoardLayout
      top={
        <div className="flex h-14 items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <PuzzleIcon className="size-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold">Daily puzzle</h1>
              <p className="truncate text-xs text-muted-foreground">{formatPuzzleDay(puzzle.day, !isToday)}</p>
            </div>
          </div>
          <Badge>
            {puzzle.difficulty} · {puzzle.rating}
          </Badge>
        </div>
      }
      board={
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
      }
      side={
        <>
          <Card aria-live="polite">
            {!showResult ? (
              <CardBody>
                <p className="flex items-center gap-2 text-lg font-semibold">
                  <SideDot color={color} className="size-3" />
                  {color === "white" ? "White" : "Black"} to move
                </p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Find the best move{yourMoves > 1 ? `. The solution is ${yourMoves} moves long.` : "."}
                </p>
                {practice && (
                  <Badge className="mt-2" tone="info">
                    Practice: not recorded
                  </Badge>
                )}
                <div className="mt-4 flex min-h-11 items-center rounded-lg bg-secondary/60 px-3 py-2 text-sm">
                  {revealing ? (
                    <span>Showing the solution…</span>
                  ) : busy && step === 0 ? (
                    <span className="text-muted-foreground">Your opponent is moving…</span>
                  ) : feedback?.kind === "wrong" ? (
                    <span className="flex items-center gap-1.5 font-semibold text-red-600">
                      <X className="size-4" aria-hidden /> {feedback.san} isn&apos;t it. Try again.
                    </span>
                  ) : feedback?.kind === "right" ? (
                    <span className="flex items-center gap-1.5 font-semibold text-emerald-700">
                      <Check className="size-4" aria-hidden /> {feedback.san}! Keep going.
                    </span>
                  ) : feedback?.kind === "hint" ? (
                    <span className="flex items-center gap-1.5">
                      <Lightbulb className="size-4 text-amber-600" aria-hidden /> Look at the highlighted piece.
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Drag or tap a piece to move.</span>
                  )}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button variant="secondary" onClick={hint} disabled={busy || revealing || hintFor === step}>
                    <Lightbulb /> Hint
                  </Button>
                  <Button variant="secondary" onClick={showSolution} disabled={revealing || step === 0}>
                    <Eye /> Show solution
                  </Button>
                </div>
                {!practice && !done && mistakes > 0 && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    {mistakes} {mistakes === 1 ? "mistake" : "mistakes"} so far. You can still solve it.
                  </p>
                )}
              </CardBody>
            ) : (
              <>
                <div
                  className={cn(
                    "flex items-center gap-4 p-4 sm:p-5",
                    practice ? "bg-secondary/50" : outcome === "revealed" ? "bg-red-50/70" : outcome === "perfect" ? "bg-amber-50" : "bg-emerald-50",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-12 shrink-0 items-center justify-center rounded-full text-white",
                      practice ? "bg-neutral-400" : outcome === "revealed" ? "bg-red-600" : outcome === "perfect" ? "bg-amber-500" : "bg-emerald-600",
                    )}
                  >
                    {ResultIcon && !practice ? <ResultIcon className="size-6" aria-hidden /> : <RotateCcw className="size-6" aria-hidden />}
                  </span>
                  <div>
                    <p className="text-xl font-bold">
                      {practice ? (practiceRevealed ? "Practice done" : "Solved again") : outcome && outcome !== "attempted" ? OUTCOME_BADGE[outcome].label : "Done"}
                    </p>
                    {!practice && outcome === "solved" && record && (
                      <p className="text-sm text-muted-foreground">
                        {[
                          record.mistakes ? `${record.mistakes} ${record.mistakes === 1 ? "mistake" : "mistakes"}` : null,
                          record.hints ? `${record.hints} ${record.hints === 1 ? "hint" : "hints"}` : null,
                        ]
                          .filter(Boolean)
                          .join(", ")}
                      </p>
                    )}
                  </div>
                </div>
                <CardBody className="space-y-4 border-t border-border text-sm">
                  <div className="grid grid-cols-3 gap-2">
                    <Stat
                      label="Streak"
                      value={
                        <span className="inline-flex items-center gap-1">
                          {stats.currentStreak > 0 && <Flame className="size-4 text-orange-500" aria-hidden />}
                          {stats.currentStreak}
                        </span>
                      }
                    />
                    <Stat label="Best streak" value={stats.bestStreak} />
                    <Stat label={isToday ? "Solved today" : "Solved by"} value={dayStats.solvers} />
                  </div>
                  {!isToday && outcome === "solved" && <p className="text-xs text-muted-foreground">Archive puzzles don&apos;t count towards your streak.</p>}
                  <div>
                    <div className="text-xs font-medium text-muted-foreground">Solution</div>
                    <div className="mt-0.5 font-medium">{solution}</div>
                  </div>
                  {themes.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {themes.map((t) => (
                        <Badge key={t}>{t}</Badge>
                      ))}
                    </div>
                  )}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
                    <Button variant="outline" size="sm" onClick={practiceAgain}>
                      <RotateCcw /> Try it again
                    </Button>
                    <a
                      href={`https://lichess.org/${puzzle.game}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline"
                    >
                      From a game on Lichess <ExternalLink className="size-3" aria-hidden />
                    </a>
                  </div>
                </CardBody>
              </>
            )}
          </Card>

          <PuzzleArchive items={archiveWithLive} current={puzzle.day} />
        </>
      }
    />
  );
}

/** The last 30 days' puzzles, to catch up on ones you missed. */
function PuzzleArchive({ items, current }: { items: ArchiveItem[]; current: string }) {
  return (
    <Card>
      <CardHeader title="Past puzzles" icon={<CalendarDays />} description="Catch up on the last 30 days." divider />
      <ul className="max-h-96 divide-y divide-border overflow-y-auto">
        {items.map((a, i) => {
          const badge = a.outcome ? OUTCOME_BADGE[a.outcome] : null;
          const Icon = badge?.icon;
          return (
            <li key={a.day}>
              <Link
                href={i === 0 ? "/puzzles" : `/puzzles/${a.day}`}
                aria-current={a.day === current ? "page" : undefined}
                className={cn("flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-secondary/60 sm:px-5", a.day === current && "bg-primary/5")}
              >
                <span className="min-w-0 flex-1 truncate">
                  <span className={cn(a.day === current && "font-semibold")}>{i === 0 ? "Today" : formatPuzzleDay(a.day)}</span>
                  <span className="text-xs text-muted-foreground"> · {a.difficulty}</span>
                </span>
                <span className={cn("flex w-5 justify-center", badge?.className)} title={badge?.label ?? "Not tried"}>
                  {Icon ? <Icon className="size-4" aria-hidden /> : <span className="size-1.5 rounded-full bg-border" />}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
