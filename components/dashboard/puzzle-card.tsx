import Link from "next/link";
import { ChevronRight, Flame, Puzzle } from "lucide-react";
import type { DailyPuzzle, PuzzleOutcome, PuzzleStats } from "@/lib/puzzles/logic";
import { OUTCOME_BADGE } from "@/components/puzzles/outcome";
import { Card } from "@/components/ui/card";
import { buttonClasses } from "@/components/ui/button";

/** Today's puzzle at a glance: done or not, and the streak. */
export function PuzzleCard({ puzzle, outcome, stats }: { puzzle: DailyPuzzle; outcome: PuzzleOutcome; stats: PuzzleStats }) {
  const finished = outcome === "perfect" || outcome === "solved" || outcome === "revealed";
  const badge = finished ? OUTCOME_BADGE[outcome] : null;
  return (
    <Card>
      <Link href="/puzzles" className="flex items-center gap-4 rounded-xl p-4 hover:bg-secondary/40 sm:p-5">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Puzzle className="size-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">Daily puzzle</span>
          <span className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
            {badge ? (
              <span className={badge.className}>{badge.label}</span>
            ) : (
              <span>
                {puzzle.weekday} · {puzzle.difficulty}
              </span>
            )}
            {stats.currentStreak > 0 && (
              <span className="inline-flex items-center gap-1">
                <Flame className="size-3.5 text-orange-500" aria-hidden />
                {stats.currentStreak} day{stats.currentStreak === 1 ? "" : "s"}
              </span>
            )}
          </span>
        </span>
        {finished ? (
          <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
        ) : (
          <span className={buttonClasses({ size: "sm" })}>Solve</span>
        )}
      </Link>
    </Card>
  );
}
