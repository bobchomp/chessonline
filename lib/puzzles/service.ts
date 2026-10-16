import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { puzzleSolves } from "@/lib/db/schema";
import { HttpError } from "@/lib/game/rules";
import data from "./puzzles.json";
import {
  ARCHIVE_DAYS,
  DIFFICULTY,
  WEEKDAYS,
  addDays,
  isPlayableDay,
  poolSlot,
  utcDay,
  type DailyPuzzle,
  type DayStats,
  type PuzzleRecord,
} from "./logic";

/** The puzzle for a day: the same for everyone. Built by scripts/build-puzzles.mjs. */
export function getDailyPuzzle(day: string): DailyPuzzle {
  const { weekday, index } = poolSlot(day, data.pools[0].length);
  const p = data.pools[weekday][index];
  return {
    id: p.id,
    fen: p.fen,
    moves: p.moves.split(" "),
    rating: p.rating,
    themes: p.themes.split(" "),
    game: p.game,
    day,
    weekday: WEEKDAYS[weekday],
    difficulty: DIFFICULTY[weekday],
  };
}

const recordColumns = {
  day: puzzleSolves.day,
  status: puzzleSolves.status,
  mistakes: puzzleSolves.mistakes,
  hints: puzzleSolves.hints,
  onTime: puzzleSolves.onTime,
  completedAt: puzzleSolves.completedAt,
};

/** Every daily puzzle a player has touched, newest first. */
export async function getPuzzleRecords(userId: string): Promise<PuzzleRecord[]> {
  return getDb().select(recordColumns).from(puzzleSolves).where(eq(puzzleSolves.userId, userId)).orderBy(desc(puzzleSolves.day));
}

/** How many players have solved a day's puzzle, and how many got it first try. */
export async function getDayStats(day: string): Promise<DayStats> {
  const [row] = await getDb()
    .select({
      solvers: sql<number>`count(*) filter (where ${puzzleSolves.status} = 'solved')::int`,
      perfect: sql<number>`count(*) filter (where ${puzzleSolves.status} = 'solved' and ${puzzleSolves.mistakes} = 0 and ${puzzleSolves.hints} = 0)::int`,
    })
    .from(puzzleSolves)
    .where(eq(puzzleSolves.day, day));
  return { solvers: row?.solvers ?? 0, perfect: row?.perfect ?? 0 };
}

export type PuzzleAction = "mistake" | "hint" | "solved" | "revealed";
export const PUZZLE_ACTIONS: PuzzleAction[] = ["mistake", "hint", "solved", "revealed"];

/**
 * Records progress on a day's puzzle. Mistakes and hints add up until it's
 * finished; once solved (or the solution shown) the result is final, so trying
 * it again afterwards is just practice.
 */
export async function recordPuzzleEvent(userId: string, day: string, action: PuzzleAction, now = new Date()): Promise<PuzzleRecord> {
  const today = utcDay(now);
  if (!isPlayableDay(day, today)) throw new HttpError(400, "That puzzle isn't available.");
  const puzzle = getDailyPuzzle(day);
  const finishing = action === "solved" || action === "revealed";
  const db = getDb();
  const [row] = await db
    .insert(puzzleSolves)
    .values({
      userId,
      day,
      puzzleId: puzzle.id,
      status: finishing ? action : "attempted",
      mistakes: action === "mistake" ? 1 : 0,
      hints: action === "hint" ? 1 : 0,
      onTime: finishing && day === today,
      completedAt: finishing ? now : null,
    })
    .onConflictDoUpdate({
      target: [puzzleSolves.userId, puzzleSolves.day],
      set: {
        status: sql`excluded.status`,
        mistakes: sql`${puzzleSolves.mistakes} + excluded.mistakes`,
        hints: sql`${puzzleSolves.hints} + excluded.hints`,
        onTime: sql`excluded.on_time`,
        completedAt: sql`excluded.completed_at`,
      },
      setWhere: eq(puzzleSolves.status, "attempted"),
    })
    .returning(recordColumns);
  if (row) return row;
  // Already finished: nothing changes.
  const [existing] = await db
    .select(recordColumns)
    .from(puzzleSolves)
    .where(and(eq(puzzleSolves.userId, userId), eq(puzzleSolves.day, day)));
  return existing;
}

/** The archive window: today first, then the days before it. */
export function archiveDays(today: string): string[] {
  return Array.from({ length: ARCHIVE_DAYS }, (_, i) => addDays(today, -i));
}
