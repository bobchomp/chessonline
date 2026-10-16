import Link from "next/link";
import type { DailyPuzzle, PuzzleOutcome, PuzzleStats } from "@/lib/puzzles/logic";
import { OUTCOME_BADGE } from "@/components/puzzles/outcome";

/** Today's puzzle at a glance: done or not, and the streak. */
export function PuzzleCard({ puzzle, outcome, stats }: { puzzle: DailyPuzzle; outcome: PuzzleOutcome; stats: PuzzleStats }) {
  const finished = outcome === "perfect" || outcome === "solved" || outcome === "revealed";
  return (
    <Link
      href="/puzzles"
      className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 shadow-sm transition-colors hover:bg-secondary"
    >
      <span className="text-3xl leading-none" aria-hidden>
        🧩
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">Daily puzzle</span>
        <span className="block truncate text-sm text-muted-foreground">
          {finished ? (
            <span className={OUTCOME_BADGE[outcome].className}>
              {OUTCOME_BADGE[outcome].icon} {OUTCOME_BADGE[outcome].label}
            </span>
          ) : (
            <>
              {puzzle.weekday} · {puzzle.difficulty}
            </>
          )}
          {stats.currentStreak > 0 && <> · 🔥 {stats.currentStreak}-day streak</>}
        </span>
      </span>
      {!finished && (
        <span className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground">Solve</span>
      )}
    </Link>
  );
}
