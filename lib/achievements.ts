import { BOTS, getBot } from "@/lib/bots/definitions";
import type { GameResult } from "@/lib/db/schema";

/**
 * Achievements are worked out from a player's finished games rather than stored,
 * so they cover games played before the feature existed and can't drift.
 */

export type AchievementCategory = "Milestones" | "Streaks" | "Beat the bots";

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
 * `firstFriendAt` is when their first friendship was accepted.
 */
export function computeAchievements(userId: string, games: FinishedGame[], firstFriendAt: Date | null): AchievementSummary {
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

  const progressFor = (id: string): Achievement["progress"] => {
    const games = /^games-(\d+)$/.exec(id);
    if (games) return { current: Math.min(played, +games[1]), target: +games[1] };
    const run = /^streak-(\d+)$/.exec(id);
    if (run) return { current: Math.min(best, +run[1]), target: +run[1] };
    return null;
  };

  const achievements = ACHIEVEMENTS.map((d) => {
    const at = unlocked.get(d.id);
    return { ...d, unlockedAt: at ? at.toISOString() : null, progress: at ? null : progressFor(d.id) };
  });
  return { achievements, unlocked: unlocked.size, currentStreak: streak, bestStreak: best };
}
