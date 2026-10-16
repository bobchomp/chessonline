import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { DIFFICULTY, WEEKDAYS, computePuzzleStats, outcomeOf, utcDay, weekdayIndex } from "@/lib/puzzles/logic";
import { archiveDays, getDailyPuzzle, getDayStats, getPuzzleRecords } from "@/lib/puzzles/service";
import { DailyPuzzleBoard, type ArchiveItem } from "./daily-puzzle";

/** The daily puzzle page for `day` (today, or one from the archive). */
export async function PuzzlePage({ day, today }: { day: string; today: string }) {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/sign-in");

  const [records, dayStats] = await Promise.all([getPuzzleRecords(user.id), getDayStats(day)]);
  const byDay = new Map(records.map((r) => [r.day, r]));
  const archive: ArchiveItem[] = archiveDays(today).map((d) => ({
    day: d,
    weekday: WEEKDAYS[weekdayIndex(d)],
    difficulty: DIFFICULTY[weekdayIndex(d)],
    outcome: outcomeOf(byDay.get(d)),
  }));

  return (
    <DailyPuzzleBoard
      // A fresh board for each day when moving around the archive.
      key={day}
      puzzle={getDailyPuzzle(day)}
      isToday={day === today}
      initialRecord={byDay.get(day) ?? null}
      initialStats={computePuzzleStats(records, utcDay())}
      initialDayStats={dayStats}
      archive={archive}
    />
  );
}
