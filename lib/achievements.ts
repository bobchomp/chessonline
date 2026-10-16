import { BOTS, getBot } from "@/lib/bots/definitions";
import type { GameResult } from "@/lib/db/schema";
import { daysBetween, type PuzzleRecord } from "@/lib/puzzles/logic";

/**
 * Achievements are worked out from a player's finished games rather than stored,
 * so they cover games played before the feature existed and can't drift.
 */

export type AchievementCategory = "Milestones" | "Streaks" | "Puzzles" | "Beat the bots";

export type Achievement = {
  id: string;
  category: AchievementCategory;
  icon: string;
  title: string;
  description: string;
  /** When it was earned (the game that earned it), or null if not yet. */
  unlockedAt: string | null;
  /** For locked ones with a count to reach, e.g. 7 of 10 games. */
  progress: { current: number; target: number } | null;
};

export type FinishedGame = {
  whiteId: string | null;
  blackId: string | null;
  result: GameResult | null;
  rated: boolean;
  endedAt: Date;
};

export type AchievementSummary = {
  achievements: Achievement[];
  unlocked: number;
  currentStreak: number;
  bestStreak: number;
};

type Def = Omit<Achievement, "unlockedAt" | "progress">;

const GAME_MILESTONES = [10, 50, 100];
const STREAKS = [3, 5, 10];
const PUZZLES_SOLVED = 50;
const PUZZLES_PERFECT = 10;
const PUZZLE_STREAKS = [7, 30];

/** Everything a player can earn, in display order. */
export const ACHIEVEMENTS: Def[] = [
  { id: "first-win", category: "Milestones", icon: "🏆", title: "First win", description: "Win your first game." },
  { id: "first-rated", category: "Milestones", icon: "📈", title: "On the ladder", description: "Finish your first rated game." },
  { id: "first-friend", category: "Milestones", icon: "🤝", title: "Making friends", description: "Add your first friend." },
  ...GAME_MILESTONES.map((n) => ({
    id: `games-${n}`,
    category: "Milestones" as const,
    icon: n >= 100 ? "💯" : n >= 50 ? "🎖️" : "🎯",
    title: `${n} games`,
    description: `Finish ${n} games.`,
  })),
  ...STREAKS.map((n) => ({
    id: `streak-${n}`,
    category: "Streaks" as const,
    icon: n >= 10 ? "🌋" : n >= 5 ? "🔥" : "✨",
    title: `${n} in a row`,
    description: `Win ${n} games in a row.`,
  })),
  { id: "puzzle-first", category: "Puzzles", icon: "🧩", title: "First puzzle", description: "Solve a daily puzzle." },
  {
    id: `puzzle-perfect-${PUZZLES_PERFECT}`,
    category: "Puzzles",
    icon: "⭐",
    title: "Sharp eye",
    description: `Solve ${PUZZLES_PERFECT} daily puzzles first try.`,
  },
  {
    id: `puzzles-${PUZZLES_SOLVED}`,
    category: "Puzzles",
    icon: "🧠",
    title: "Puzzle fan",
    description: `Solve ${PUZZLES_SOLVED} daily puzzles.`,
  },
  ...PUZZLE_STREAKS.map((n) => ({
    id: `puzzle-streak-${n}`,
    category: "Puzzles" as const,
    icon: n >= 30 ? "🗓️" : "📅",
    title: n >= 30 ? "Month of puzzles" : "Week of puzzles",
    description: `Solve the daily puzzle ${n} days in a row.`,
  })),
  ...BOTS.map((b) => ({
    id: `beat-${b.id.slice(4)}`,
    category: "Beat the bots" as const,
    icon: b.avatar,
    title: `Beat ${b.name}`,
    description: `${b.rating} · win one game.`,
  })),
];

function outcomeFor(g: FinishedGame, userId: string): "win" | "loss" | "draw" | null {
  if (!g.result) return null;
  if (g.result === "1/2-1/2") return "draw";
  const white = g.whiteId === userId;
  return (g.result === "1-0") === white ? "win" : "loss";
}

/**
 * Achievements for `userId`. `games` are their finished games (any order);
 * `firstFriendAt` is when their first friendship was accepted; `puzzles` their
 * daily puzzle results.
 */
export function computeAchievements(
  userId: string,
  games: FinishedGame[],
  firstFriendAt: Date | null,
  puzzles: PuzzleRecord[] = [],
): AchievementSummary {
  const sorted = [...games].sort((a, b) => a.endedAt.getTime() - b.endedAt.getTime());
  const unlocked = new Map<string, Date>();
  const unlock = (id: string, at: Date) => {
    if (!unlocked.has(id)) unlocked.set(id, at);
  };

  let played = 0;
  let streak = 0;
  let best = 0;
  for (const g of sorted) {
    const outcome = outcomeFor(g, userId);
    if (!outcome) continue;
    played++;
    if (g.rated) unlock("first-rated", g.endedAt);
    for (const n of GAME_MILESTONES) if (played === n) unlock(`games-${n}`, g.endedAt);

    if (outcome === "win") {
      unlock("first-win", g.endedAt);
      streak++;
      best = Math.max(best, streak);
      for (const n of STREAKS) if (streak === n) unlock(`streak-${n}`, g.endedAt);
      const bot = getBot(g.whiteId === userId ? g.blackId : g.whiteId);
      if (bot) unlock(`beat-${bot.id.slice(4)}`, g.endedAt);
    } else {
      streak = 0;
    }
  }
  if (firstFriendAt) unlock("first-friend", firstFriendAt);

  // Puzzles, in the order they were solved.
  const solved = puzzles
    .filter((p) => p.status === "solved" && p.completedAt)
    .sort((a, b) => a.completedAt!.getTime() - b.completedAt!.getTime());
  let perfect = 0;
  solved.forEach((p, i) => {
    unlock("puzzle-first", p.completedAt!);
    if (i + 1 === PUZZLES_SOLVED) unlock(`puzzles-${PUZZLES_SOLVED}`, p.completedAt!);
    if (p.mistakes === 0 && p.hints === 0 && ++perfect === PUZZLES_PERFECT) unlock(`puzzle-perfect-${PUZZLES_PERFECT}`, p.completedAt!);
  });
  // Streaks only count puzzles solved on their own day.
  let puzzleRun = 0;
  let bestPuzzleRun = 0;
  let prevDay: string | null = null;
  for (const p of solved.filter((p) => p.onTime).sort((a, b) => a.day.localeCompare(b.day))) {
    puzzleRun = prevDay && daysBetween(prevDay, p.day) === 1 ? puzzleRun + 1 : 1;
    bestPuzzleRun = Math.max(bestPuzzleRun, puzzleRun);
    prevDay = p.day;
    for (const n of PUZZLE_STREAKS) if (puzzleRun === n) unlock(`puzzle-streak-${n}`, p.completedAt!);
  }

  const progressFor = (id: string): Achievement["progress"] => {
    const games = /^games-(\d+)$/.exec(id);
    if (games) return { current: Math.min(played, +games[1]), target: +games[1] };
    const run = /^streak-(\d+)$/.exec(id);
    if (run) return { current: Math.min(best, +run[1]), target: +run[1] };
    const puzzleRunTarget = /^puzzle-streak-(\d+)$/.exec(id);
    if (puzzleRunTarget) return { current: Math.min(bestPuzzleRun, +puzzleRunTarget[1]), target: +puzzleRunTarget[1] };
    if (id === `puzzles-${PUZZLES_SOLVED}`) return { current: Math.min(solved.length, PUZZLES_SOLVED), target: PUZZLES_SOLVED };
    if (id === `puzzle-perfect-${PUZZLES_PERFECT}`) return { current: Math.min(perfect, PUZZLES_PERFECT), target: PUZZLES_PERFECT };
    return null;
  };

  const achievements = ACHIEVEMENTS.map((d) => {
    const at = unlocked.get(d.id);
    return { ...d, unlockedAt: at ? at.toISOString() : null, progress: at ? null : progressFor(d.id) };
  });
  return { achievements, unlocked: unlocked.size, currentStreak: streak, bestStreak: best };
}
