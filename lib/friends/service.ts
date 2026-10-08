import { and, desc, eq, inArray, ne, or, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { blocks, friendships, games, profiles, type Friendship, type GameResult } from "@/lib/db/schema";
import { HttpError } from "@/lib/game/rules";
import type { Player } from "@/lib/users/service";
import { isBotId } from "@/lib/bots/definitions";

/** A friend counts as online if they checked in this recently. */
export const ONLINE_WINDOW_MS = 75_000;
const LAST_SEEN_WRITE_EVERY_MS = 30_000;
const MAX_PENDING_OUTGOING = 50;

export type Relationship = "self" | "none" | "friends" | "outgoing" | "incoming" | "blocked";

export type UserSummary = { userId: string; username: string };

export type Record3 = { wins: number; losses: number; draws: number };

export type FriendInfo = UserSummary & {
  online: boolean;
  inGame: boolean;
  headToHead: Record3;
  since: string;
};

export type FriendsOverview = {
  friends: FriendInfo[];
  incoming: (UserSummary & { at: string })[];
  outgoing: (UserSummary & { at: string })[];
  blocked: UserSummary[];
};

export type FriendAction = "request" | "accept" | "decline" | "cancel" | "remove" | "block" | "unblock";

function pair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

/** Pending (waiting) friend challenges between two users, in either direction. */
function pendingChallengesBetween(a: string, b: string) {
  return and(
    eq(games.status, "waiting"),
    or(
      and(eq(games.createdBy, a), eq(games.invitedUserId, b)),
      and(eq(games.createdBy, b), eq(games.invitedUserId, a)),
    ),
  );
}

function cancelChallengesBetween(a: string, b: string, now: Date) {
  return getDb()
    .update(games)
    .set({ status: "aborted", endedAt: now, updatedAt: now, version: sql`${games.version} + 1` })
    .where(pendingChallengesBetween(a, b));
}

function pairWhere(a: string, b: string) {
  const [low, high] = pair(a, b);
  return and(eq(friendships.userLow, low), eq(friendships.userHigh, high));
}

async function getFriendship(a: string, b: string): Promise<Friendship | null> {
  const [row] = await getDb().select().from(friendships).where(pairWhere(a, b)).limit(1);
  return row ?? null;
}

/** "mine" if I blocked them, "theirs" if they blocked me, otherwise null. */
async function blockBetween(me: string, other: string): Promise<"mine" | "theirs" | null> {
  const rows = await getDb()
    .select({ blockerId: blocks.blockerId })
    .from(blocks)
    .where(
      or(
        and(eq(blocks.blockerId, me), eq(blocks.blockedId, other)),
        and(eq(blocks.blockerId, other), eq(blocks.blockedId, me)),
      ),
    );
  if (rows.some((r) => r.blockerId === me)) return "mine";
  if (rows.length) return "theirs";
  return null;
}

/** How `me` relates to `other`. Users who blocked `me` look like they don't exist (null). */
export async function relationshipWith(me: string, other: string): Promise<Relationship | null> {
  if (me === other) return "self";
  const block = await blockBetween(me, other);
  if (block === "theirs") return null;
  if (block === "mine") return "blocked";
  const f = await getFriendship(me, other);
  if (!f) return "none";
  if (f.status === "accepted") return "friends";
  return f.requestedBy === me ? "outgoing" : "incoming";
}

async function requireTarget(me: string, otherId: string): Promise<UserSummary> {
  const [p] = await getDb()
    .select({ userId: profiles.userId, username: profiles.username })
    .from(profiles)
    .where(eq(profiles.userId, otherId))
    .limit(1);
  if (!p || (await blockBetween(me, otherId)) === "theirs") throw new HttpError(404, "User not found.");
  return p;
}

/** Usernames starting with `query` (2+ chars), excluding yourself and anyone blocked either way. */
export async function searchUsers(me: Player, query: string): Promise<(UserSummary & { relationship: Relationship })[]> {
  const q = query.trim();
  if (q.length < 2 || !/^[A-Za-z0-9_]+$/.test(q)) return [];
  // `_` is a LIKE wildcard, and it's a legal username character, so escape it.
  const pattern = q.toLowerCase().replace(/_/g, "\\_") + "%";
  const db = getDb();
  const rows = await db
    .select({ userId: profiles.userId, username: profiles.username })
    .from(profiles)
    .where(
      and(
        sql`lower(${profiles.username}) like ${pattern}`,
        ne(profiles.userId, me.id),
        sql`not exists (select 1 from ${blocks} where (${blocks.blockerId} = ${me.id} and ${blocks.blockedId} = ${profiles.userId}) or (${blocks.blockerId} = ${profiles.userId} and ${blocks.blockedId} = ${me.id}))`,
      ),
    )
    .orderBy(sql`length(${profiles.username})`, profiles.username)
    .limit(10);
  if (!rows.length) return [];

  const rels = await db
    .select()
    .from(friendships)
    .where(
      or(
        and(eq(friendships.userLow, me.id), inArray(friendships.userHigh, rows.map((r) => r.userId))),
        and(eq(friendships.userHigh, me.id), inArray(friendships.userLow, rows.map((r) => r.userId))),
      ),
    );
  const relOf = (id: string): Relationship => {
    const f = rels.find((r) => r.userLow === id || r.userHigh === id);
    if (!f) return "none";
    if (f.status === "accepted") return "friends";
    return f.requestedBy === me.id ? "outgoing" : "incoming";
  };
  return rows.map((r) => ({ ...r, relationship: relOf(r.userId) }));
}

export async function friendAction(me: Player, action: FriendAction, otherId: string): Promise<Relationship> {
  if (otherId === me.id) throw new HttpError(400, "That's you!");
  const db = getDb();
  const now = new Date();

  if (action === "unblock") {
    await db.delete(blocks).where(and(eq(blocks.blockerId, me.id), eq(blocks.blockedId, otherId)));
    return (await relationshipWith(me.id, otherId)) ?? "none";
  }

  await requireTarget(me.id, otherId);

  if (action === "block") {
    await db.batch([
      db.insert(blocks).values({ blockerId: me.id, blockedId: otherId, createdAt: now }).onConflictDoNothing(),
      db.delete(friendships).where(pairWhere(me.id, otherId)),
      cancelChallengesBetween(me.id, otherId, now),
    ]);
    return "blocked";
  }

  if ((await blockBetween(me.id, otherId)) === "mine") {
    throw new HttpError(409, "You've blocked this player. Unblock them first.");
  }
  const f = await getFriendship(me.id, otherId);

  switch (action) {
    case "request": {
      if (f?.status === "accepted") return "friends";
      if (f?.requestedBy === me.id) return "outgoing";
      if (f) {
        // They already asked us: sending a request back accepts theirs.
        await db.update(friendships).set({ status: "accepted", acceptedAt: now }).where(pairWhere(me.id, otherId));
        return "friends";
      }
      const [{ n }] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(friendships)
        .where(and(eq(friendships.requestedBy, me.id), eq(friendships.status, "pending")));
      if (n >= MAX_PENDING_OUTGOING) throw new HttpError(429, "You have too many pending friend requests.");
      const [low, high] = pair(me.id, otherId);
      await db
        .insert(friendships)
        .values({ userLow: low, userHigh: high, requestedBy: me.id, status: "pending", createdAt: now })
        .onConflictDoNothing();
      return (await relationshipWith(me.id, otherId)) ?? "none";
    }
    case "accept":
      if (f?.status !== "pending" || f.requestedBy === me.id) throw new HttpError(409, "There's no request to accept.");
      await db.update(friendships).set({ status: "accepted", acceptedAt: now }).where(pairWhere(me.id, otherId));
      return "friends";
    case "decline":
      if (f?.status !== "pending" || f.requestedBy === me.id) throw new HttpError(409, "There's no request to decline.");
      await db.delete(friendships).where(pairWhere(me.id, otherId));
      return "none";
    case "cancel":
      if (f?.status !== "pending" || f.requestedBy !== me.id) throw new HttpError(409, "There's no request to cancel.");
      await db.delete(friendships).where(pairWhere(me.id, otherId));
      return "none";
    case "remove":
      if (f?.status !== "accepted") throw new HttpError(409, "You're not friends.");
      await db.batch([db.delete(friendships).where(pairWhere(me.id, otherId)), cancelChallengesBetween(me.id, otherId, now)]);
      return "none";
    default:
      throw new HttpError(400, "Unknown action.");
  }
}

function emptyRecord(): Record3 {
  return { wins: 0, losses: 0, draws: 0 };
}

function tally(rec: Record3, result: GameResult | null, meWhite: boolean) {
  if (result === "1/2-1/2") rec.draws++;
  else if ((result === "1-0") === meWhite) rec.wins++;
  else if (result) rec.losses++;
}

/** Results of finished games between `me` and each of `others`, from `me`'s side. */
async function headToHead(me: string, others: string[]): Promise<Map<string, Record3>> {
  const out = new Map(others.map((o) => [o, emptyRecord()]));
  if (!others.length) return out;
  const rows = await getDb()
    .select({ whiteId: games.whiteId, blackId: games.blackId, result: games.result })
    .from(games)
    .where(
      and(
        eq(games.status, "finished"),
        or(
          and(eq(games.whiteId, me), inArray(games.blackId, others)),
          and(eq(games.blackId, me), inArray(games.whiteId, others)),
        ),
      ),
    );
  for (const g of rows) {
    const meWhite = g.whiteId === me;
    const other = meWhite ? g.blackId! : g.whiteId!;
    tally(out.get(other)!, g.result, meWhite);
  }
  return out;
}

/** Users (of `ids`) currently connected to an active game. */
async function inActiveGame(ids: string[], now: Date): Promise<Set<string>> {
  const out = new Set<string>();
  if (!ids.length) return out;
  const since = new Date(now.getTime() - ONLINE_WINDOW_MS);
  const rows = await getDb()
    .select({ whiteId: games.whiteId, blackId: games.blackId, whiteSeenAt: games.whiteSeenAt, blackSeenAt: games.blackSeenAt })
    .from(games)
    .where(and(eq(games.status, "active"), or(inArray(games.whiteId, ids), inArray(games.blackId, ids))));
  for (const g of rows) {
    if (g.whiteId && g.whiteSeenAt && g.whiteSeenAt >= since) out.add(g.whiteId);
    if (g.blackId && g.blackSeenAt && g.blackSeenAt >= since) out.add(g.blackId);
  }
  return out;
}

export async function friendsOverview(me: Player, now = new Date()): Promise<FriendsOverview> {
  const db = getDb();
  const rows = await db
    .select()
    .from(friendships)
    .where(or(eq(friendships.userLow, me.id), eq(friendships.userHigh, me.id)));
  const otherOf = (f: Friendship) => (f.userLow === me.id ? f.userHigh : f.userLow);

  const blockedRows = await db
    .select({ userId: profiles.userId, username: profiles.username })
    .from(blocks)
    .innerJoin(profiles, eq(profiles.userId, blocks.blockedId))
    .where(eq(blocks.blockerId, me.id))
    .orderBy(profiles.username);

  const ids = rows.map(otherOf);
  const people = ids.length
    ? await db
        .select({ userId: profiles.userId, username: profiles.username, lastSeenAt: profiles.lastSeenAt })
        .from(profiles)
        .where(inArray(profiles.userId, ids))
    : [];
  const byId = new Map(people.map((p) => [p.userId, p]));

  const friendIds = rows.filter((f) => f.status === "accepted").map(otherOf);
  const [h2h, playing] = await Promise.all([headToHead(me.id, friendIds), inActiveGame(friendIds, now)]);

  const friends: FriendInfo[] = rows
    .filter((f) => f.status === "accepted" && byId.has(otherOf(f)))
    .map((f) => {
      const p = byId.get(otherOf(f))!;
      return {
        userId: p.userId,
        username: p.username,
        online: !!p.lastSeenAt && now.getTime() - p.lastSeenAt.getTime() < ONLINE_WINDOW_MS,
        inGame: playing.has(p.userId),
        headToHead: h2h.get(p.userId) ?? emptyRecord(),
        since: (f.acceptedAt ?? f.createdAt).toISOString(),
      };
    })
    .sort((a, b) => Number(b.online) - Number(a.online) || a.username.localeCompare(b.username));

  const pending = (incoming: boolean) =>
    rows
      .filter((f) => f.status === "pending" && (f.requestedBy === me.id) !== incoming && byId.has(otherOf(f)))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((f) => ({ userId: otherOf(f), username: byId.get(otherOf(f))!.username, at: f.createdAt.toISOString() }));

  return { friends, incoming: pending(true), outgoing: pending(false), blocked: blockedRows };
}

/** Records that the user is around (throttled) and returns badge counts. */
export async function checkIn(me: Player, now = new Date()): Promise<{ friendRequests: number }> {
  const db = getDb();
  await db
    .update(profiles)
    .set({ lastSeenAt: now })
    .where(
      and(
        eq(profiles.userId, me.id),
        sql`(${profiles.lastSeenAt} is null or ${profiles.lastSeenAt} < ${new Date(now.getTime() - LAST_SEEN_WRITE_EVERY_MS)})`,
      ),
    );
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(friendships)
    .where(
      and(
        eq(friendships.status, "pending"),
        ne(friendships.requestedBy, me.id),
        or(eq(friendships.userLow, me.id), eq(friendships.userHigh, me.id)),
      ),
    );
  return { friendRequests: n };
}

export type RecentGame = {
  id: string;
  opponent: string | null;
  color: "white" | "black";
  outcome: "win" | "loss" | "draw";
  endedAt: string;
};

export type PublicProfile = UserSummary & {
  joinedAt: string;
  online: boolean;
  relationship: Relationship;
  /** Games against people only. */
  record: Record3;
  /** Games against the computer. */
  botRecord: Record3;
  headToHead: Record3 | null;
  recentGames: RecentGame[];
};

/** A player's profile as seen by `me`; null if it doesn't exist or they blocked `me`. */
export async function getPublicProfile(me: Player, username: string, now = new Date()): Promise<PublicProfile | null> {
  const db = getDb();
  const [p] = await db
    .select()
    .from(profiles)
    .where(sql`lower(${profiles.username}) = lower(${username})`)
    .limit(1);
  if (!p) return null;
  const relationship = await relationshipWith(me.id, p.userId);
  if (!relationship) return null;

  const finished = await db
    .select({
      id: games.id,
      whiteId: games.whiteId,
      blackId: games.blackId,
      whiteName: games.whiteName,
      blackName: games.blackName,
      result: games.result,
      endedAt: games.endedAt,
      updatedAt: games.updatedAt,
    })
    .from(games)
    .where(and(eq(games.status, "finished"), or(eq(games.whiteId, p.userId), eq(games.blackId, p.userId))))
    .orderBy(desc(games.endedAt));

  const record = emptyRecord();
  const botRecord = emptyRecord();
  for (const g of finished) {
    const white = g.whiteId === p.userId;
    tally(isBotId(white ? g.blackId : g.whiteId) ? botRecord : record, g.result, white);
  }

  const recentGames: RecentGame[] = finished.slice(0, 10).map((g) => {
    const white = g.whiteId === p.userId;
    const outcome =
      g.result === "1/2-1/2" ? "draw" : (g.result === "1-0") === white ? "win" : "loss";
    return {
      id: g.id,
      opponent: white ? g.blackName : g.whiteName,
      color: white ? "white" : "black",
      outcome,
      endedAt: (g.endedAt ?? g.updatedAt).toISOString(),
    };
  });

  const h2h = relationship === "self" ? null : ((await headToHead(me.id, [p.userId])).get(p.userId) ?? null);

  return {
    userId: p.userId,
    username: p.username,
    joinedAt: p.createdAt.toISOString(),
    online: !!p.lastSeenAt && now.getTime() - p.lastSeenAt.getTime() < ONLINE_WINDOW_MS,
    relationship,
    record,
    botRecord,
    headToHead: h2h,
    recentGames,
  };
}
