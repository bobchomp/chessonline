import { and, asc, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { games, profiles, type Color, type Game } from "@/lib/db/schema";
import { relationshipWith } from "@/lib/friends/service";
import type { Player } from "@/lib/users/service";
import {
  CHALLENGE_TTL_MS,
  DAILY_CHALLENGE_TTL_MS,
  DAY_MS,
  HttpError,
  challengeExpiryPatch,
  challengeTtlMs,
  colorOf,
  type GamePatch,
} from "./rules";

/** SQL condition: the challenge is still inside its answer window (longer for daily games). */
function notExpired(now: Date) {
  return sql`${games.createdAt} > ${now.toISOString()}::timestamptz - (CASE WHEN ${games.initialMs} >= ${DAY_MS}::int
    THEN ${DAILY_CHALLENGE_TTL_MS}::bigint ELSE ${CHALLENGE_TTL_MS}::bigint END) * interval '1 millisecond'`;
}
import { insertChallengeGame, loadGame, mutateGame, type NewGameOptions } from "./service";

export type IncomingChallenge = {
  gameId: string;
  from: string;
  timeControl: { initialMs: number | null; incrementMs: number };
  yourColor: Color;
  expiresAt: string;
};

/** Challenge a friend. Re-challenging someone you're already waiting on returns that challenge. */
export async function createChallenge(me: Player, friendId: string, opts: NewGameOptions): Promise<Game> {
  if (friendId === me.id) throw new HttpError(400, "You can't challenge yourself.");
  if ((await relationshipWith(me.id, friendId)) !== "friends") {
    throw new HttpError(403, "You can only challenge your friends.");
  }
  const db = getDb();
  const now = new Date();
  const [existing] = await db
    .select()
    .from(games)
    .where(
      and(
        eq(games.status, "waiting"),
        eq(games.createdBy, me.id),
        eq(games.invitedUserId, friendId),
        notExpired(now),
      ),
    )
    .limit(1);
  if (existing) return existing;

  const [friend] = await db
    .select({ username: profiles.username })
    .from(profiles)
    .where(eq(profiles.userId, friendId))
    .limit(1);
  if (!friend) throw new HttpError(404, "User not found.");
  return insertChallengeGame(me, opts, { id: friendId, name: friend.username });
}

/** Accept or decline a challenge addressed to `me`. */
export async function respondToChallenge(me: Player, gameId: string, accept: boolean): Promise<Game> {
  const before = await loadGame(gameId);
  if (before.invitedUserId !== me.id) throw new HttpError(404, "Challenge not found.");

  const game = await mutateGame(gameId, (g, now): GamePatch | null => {
    if (g.status !== "waiting") return null; // handled below (already accepted, cancelled, ...)
    const expired = challengeExpiryPatch(g, now);
    if (expired) return expired;
    if (!accept) return { status: "aborted", abortReason: "declined", endedAt: now };
    const seat: GamePatch = g.whiteId
      ? { blackId: me.id, blackName: me.name }
      : { whiteId: me.id, whiteName: me.name };
    return { ...seat, status: "active", startedAt: now };
  });

  if (game.status === "active" && colorOf(game, me.id)) {
    if (!accept) throw new HttpError(409, "You already accepted this challenge.");
    return game;
  }
  if (game.status === "aborted" && game.abortReason === "declined" && !accept) return game;
  if (game.abortReason === "expired") throw new HttpError(409, "This challenge has expired.");
  throw new HttpError(409, "This challenge was cancelled.");
}

/** Unanswered, unexpired challenges addressed to `userId`, oldest first. */
export async function incomingChallenges(userId: string, now = new Date()): Promise<IncomingChallenge[]> {
  const rows = await getDb()
    .select()
    .from(games)
    .where(
      and(
        eq(games.status, "waiting"),
        eq(games.invitedUserId, userId),
        notExpired(now),
      ),
    )
    .orderBy(asc(games.createdAt))
    .limit(10);
  return rows.map((g) => ({
    gameId: g.id,
    from: (g.whiteId === g.createdBy ? g.whiteName : g.blackName) ?? "A friend",
    timeControl: { initialMs: g.initialMs, incrementMs: g.incrementMs },
    yourColor: g.whiteId ? "black" : "white",
    expiresAt: new Date(g.createdAt.getTime() + challengeTtlMs(g)).toISOString(),
  }));
}
