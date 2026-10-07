import { and, desc, eq, gt, or } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { games } from "@/lib/db/schema";
import { checkIn, ONLINE_WINDOW_MS } from "@/lib/friends/service";
import { incomingChallenges, type IncomingChallenge } from "@/lib/game/challenges";
import type { Player } from "@/lib/users/service";

export type NotificationsResponse = {
  friendRequests: number;
  challenges: IncomingChallenge[];
  /** An active game you're connected to right now, if any. */
  activeGameId: string | null;
};

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
  const [{ friendRequests }, challenges, activeGameId] = await Promise.all([
    checkIn(me, now),
    incomingChallenges(me.id, now),
    connectedActiveGame(me.id, now),
  ]);
  return { friendRequests, challenges, activeGameId };
}
