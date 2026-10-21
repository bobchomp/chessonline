import { and, desc, eq, gt, gte, or, sql } from "drizzle-orm";
import { DAY_MS } from "@/lib/game/rules";
import { getDb } from "@/lib/db";
import { games } from "@/lib/db/schema";
import { checkIn, ONLINE_WINDOW_MS } from "@/lib/friends/service";
import { incomingChallenges, type IncomingChallenge } from "@/lib/game/challenges";
import type { Player } from "@/lib/users/service";

export type NotificationsResponse = {
  /** Your username, for the avatar menu. */
  username: string | null;
  friendRequests: number;
  challenges: IncomingChallenge[];
  /** An active game you're connected to right now, if any. */
  activeGameId: string | null;
  /** Daily games where it's your move. */
  dailyMovesWaiting: number;
};

async function dailyMovesWaiting(userId: string): Promise<number> {
  const [row] = await getDb()
    .select({ n: sql<number>`count(*)::int` })
    .from(games)
    .where(
      and(
        eq(games.status, "active"),
        gte(games.initialMs, DAY_MS),
        or(
          and(eq(games.whiteId, userId), sql`jsonb_array_length(${games.moves}) % 2 = 0`),
          and(eq(games.blackId, userId), sql`jsonb_array_length(${games.moves}) % 2 = 1`),
        ),
      ),
    );
  return row?.n ?? 0;
}

async function connectedActiveGame(userId: string, now: Date): Promise<string | null> {
  const since = new Date(now.getTime() - ONLINE_WINDOW_MS);
  const [row] = await getDb()
    .select({ id: games.id })
    .from(games)
    .where(
      and(
        eq(games.status, "active"),
        or(
          and(eq(games.whiteId, userId), gt(games.whiteSeenAt, since)),
          and(eq(games.blackId, userId), gt(games.blackSeenAt, since)),
        ),
      ),
    )
    .orderBy(desc(games.updatedAt))
    .limit(1);
  return row?.id ?? null;
}

export async function getNotifications(me: Player, now = new Date()): Promise<NotificationsResponse> {
  const [{ friendRequests }, challenges, activeGameId, daily] = await Promise.all([
    checkIn(me, now),
    incomingChallenges(me.id, now),
    connectedActiveGame(me.id, now),
    dailyMovesWaiting(me.id),
  ]);
  return { username: me.name, friendRequests, challenges, activeGameId, dailyMovesWaiting: daily };
}
