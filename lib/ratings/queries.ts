import { and, asc, count, desc, eq, gt, gte, inArray, isNotNull, notInArray, or } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { blocks, friendships, games, profiles } from "@/lib/db/schema";
import { isProvisional } from "./glicko2";

/** Players need this many rated games before they're ranked. */
export const LEADERBOARD_MIN_GAMES = 5;

export type RatingSummary = {
  rating: number;
  provisional: boolean;
  ratedGames: number;
  peak: number | null;
  /** Leaderboard position, once ranked. */
  rank: number | null;
};

export async function getRatingSummary(userId: string): Promise<RatingSummary | null> {
  const db = getDb();
  const [p] = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
  if (!p) return null;
  let rank: number | null = null;
  if (p.ratedGames >= LEADERBOARD_MIN_GAMES) {
    const [{ above }] = await db
      .select({ above: count() })
      .from(profiles)
      .where(and(gte(profiles.ratedGames, LEADERBOARD_MIN_GAMES), gt(profiles.rating, p.rating)));
    rank = above + 1;
  }
  return {
    rating: Math.round(p.rating),
    provisional: isProvisional(p.ratingRd),
    ratedGames: p.ratedGames,
    peak: p.peakRating === null ? null : Math.round(p.peakRating),
    rank,
  };
}

export type LeaderboardRow = {
  rank: number;
  userId: string;
  username: string;
  rating: number;
  provisional: boolean;
  ratedGames: number;
};

/** Top players by rating: everyone, or just `me` and my friends. Blocked players are left out. */
export async function getLeaderboard(meId: string, scope: "all" | "friends", limit = 10): Promise<LeaderboardRow[]> {
  const db = getDb();
  const blockRows = await db
    .select()
    .from(blocks)
    .where(or(eq(blocks.blockerId, meId), eq(blocks.blockedId, meId)));
  const hidden = blockRows.map((b) => (b.blockerId === meId ? b.blockedId : b.blockerId));

  let only: string[] | null = null;
  if (scope === "friends") {
    const rows = await db
      .select()
      .from(friendships)
      .where(and(eq(friendships.status, "accepted"), or(eq(friendships.userLow, meId), eq(friendships.userHigh, meId))));
    only = [meId, ...rows.map((f) => (f.userLow === meId ? f.userHigh : f.userLow))];
  }

  const rows = await db
    .select()
    .from(profiles)
    .where(
      and(
        gte(profiles.ratedGames, LEADERBOARD_MIN_GAMES),
        only ? inArray(profiles.userId, only) : undefined,
        hidden.length ? notInArray(profiles.userId, hidden) : undefined,
      ),
    )
    .orderBy(desc(profiles.rating), asc(profiles.username))
    .limit(limit);
  return rows.map((p, i) => ({
    rank: i + 1,
    userId: p.userId,
    username: p.username,
    rating: Math.round(p.rating),
    provisional: isProvisional(p.ratingRd),
    ratedGames: p.ratedGames,
  }));
}

export type RatingPoint = { at: string; rating: number };

/** Rating after each rated game, oldest first (most recent 100). */
export async function getRatingHistory(userId: string): Promise<RatingPoint[]> {
  return (await getRatingHistories([userId], 100)).get(userId) ?? [];
}

/** Rating histories for several players (most recent `perUser` rated games each, oldest first). */
export async function getRatingHistories(userIds: string[], perUser: number): Promise<Map<string, RatingPoint[]>> {
  const lists = await Promise.all(userIds.map((id) => historyOf(id, perUser)));
  return new Map(userIds.map((id, i) => [id, lists[i]]));
}

async function historyOf(userId: string, limit: number): Promise<RatingPoint[]> {
  const rows = await getDb()
    .select({
      whiteId: games.whiteId,
      whiteRating: games.whiteRating,
      blackRating: games.blackRating,
      whiteRatingDiff: games.whiteRatingDiff,
      blackRatingDiff: games.blackRatingDiff,
      endedAt: games.endedAt,
    })
    .from(games)
    .where(
      and(
        eq(games.status, "finished"),
        isNotNull(games.whiteRating),
        or(eq(games.whiteId, userId), eq(games.blackId, userId)),
      ),
    )
    .orderBy(desc(games.endedAt))
    .limit(limit);
  return rows.reverse().map((g) => {
    const white = g.whiteId === userId;
    const before = white ? g.whiteRating : g.blackRating;
    const diff = white ? g.whiteRatingDiff : g.blackRatingDiff;
    return { at: (g.endedAt ?? new Date(0)).toISOString(), rating: (before ?? 0) + (diff ?? 0) };
  });
}

/** Ratings for a set of players, for showing next to their names. */
export async function getRatings(userIds: string[]): Promise<Map<string, { rating: number; provisional: boolean }>> {
  if (!userIds.length) return new Map();
  const rows = await getDb()
    .select({ userId: profiles.userId, rating: profiles.rating, rd: profiles.ratingRd })
    .from(profiles)
    .where(inArray(profiles.userId, userIds));
  return new Map(rows.map((r) => [r.userId, { rating: Math.round(r.rating), provisional: isProvisional(r.rd) }]));
}


