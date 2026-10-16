import { WEEKDAYS, weekdayIndex, type PuzzleOutcome } from "@/lib/puzzles/logic";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "Friday 16 October" (plus the year if asked). Built by hand so the server and every browser agree. */
export function formatPuzzleDay(day: string, withYear = false): string {
  const [y, m, d] = day.split("-").map(Number);
  return `${WEEKDAYS[weekdayIndex(day)]} ${d} ${MONTHS[m - 1]}${withYear ? ` ${y}` : ""}`;
}

export const OUTCOME_BADGE: Record<NonNullable<PuzzleOutcome>, { icon: string; label: string; className: string }> = {
  perfect: { icon: "⭐", label: "Solved first try", className: "text-amber-600" },
  solved: { icon: "✓", label: "Solved", className: "text-emerald-700" },
  revealed: { icon: "✗", label: "Solution shown", className: "text-red-600" },
  attempted: { icon: "…", label: "In progress", className: "text-muted-foreground" },
};
