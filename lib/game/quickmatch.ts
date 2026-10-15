import { randomInt, randomUUID } from "node:crypto";
import { and, eq, isNull, lt, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { games, profiles, seeks } from "@/lib/db/schema";
import { BOTS, type BotDef } from "@/lib/bots/definitions";
import type { Player } from "@/lib/users/service";
import { DEFAULT_RATING } from "@/lib/ratings/glicko2";
import { HttpError, QUICK_MATCH_TIME_CONTROLS, START_FEN } from "./rules";
import { pickFairColor } from "./colors";
import { recentColors } from "./service";


/** A searcher who hasn't checked in for this long has closed the tab. */
const STALE_MS = 8_000;
/** Pair players within this many rating points at first... */
const START_WINDOW = 200;
/** ...widening by this much per second of waiting. */
const WIDEN_PER_SECOND = 10;

export type QuickMatchStatus =
  | { status: "matched"; gameId: string }
  | {
      status: "searching";
      since: string;
      rating: number;
      /** The computer opponent nearest the player's rating, offered after a while. */
      bot: Pick<BotDef, "id" | "name" | "rating" | "avatar">;
    };

function nearestBot(rating: number): BotDef {
  return BOTS.reduce((a, b) => (Math.abs(b.ratingValue - rating) < Math.abs(a.ratingValue - rating) ? b : a));
}

async function gameExists(id: string): Promise<boolean> {
  const [row] = await getDb().select({ id: games.id }).from(games).where(eq(games.id, id)).limit(1);
  return !!row;
}

/**
 * One check-in from a searching player: if someone already paired with them, send
 * them to that game; otherwise try to pair with the closest-rated waiting player;
 * otherwise (re)join the waiting list.
 */
export async function quickMatch(me: Player, timeControlId: string, now = new Date()): Promise<QuickMatchStatus> {
  const tc = QUICK_MATCH_TIME_CONTROLS.find((t) => t.id === timeControlId);
  if (!tc) throw new HttpError(400, "Pick a time control.");
  const db = getDb();
  await db.delete(seeks).where(lt(seeks.lastSeenAt, new Date(now.getTime() - 60_000)));

  // Did someone pair with us since our last check-in?
  const [mine] = await db.select().from(seeks).where(eq(seeks.userId, me.id));
  if (mine?.matchedGameId) {
    await db.delete(seeks).where(eq(seeks.userId, me.id));
    if (await gameExists(mine.matchedGameId)) return { status: "matched", gameId: mine.matchedGameId };
  }

  const [profile] = await db.select({ rating: profiles.rating }).from(profiles).where(eq(profiles.userId, me.id));
  const rating = profile?.rating ?? DEFAULT_RATING.rating;
  const since = mine && !mine.matchedGameId && mine.timeControlId === tc.id ? mine.createdAt : now;

  // Stay on the list (and visible) the whole time. This never clears a match that
  // lands between the read above and here; the next check-in picks it up.
  await db
    .insert(seeks)
    .values({ userId: me.id, username: me.name, timeControlId: tc.id, rating, createdAt: since, lastSeenAt: now })
    .onConflictDoUpdate({
      target: seeks.userId,
      set: { timeControlId: tc.id, rating, createdAt: since, lastSeenAt: now },
    });

  const window = START_WINDOW + (WIDEN_PER_SECOND * (now.getTime() - since.getTime())) / 1000;
  const fresh = new Date(now.getTime() - STALE_MS).toISOString();
  const gameId = randomUUID();
  const iso = now.toISOString();

  // Pair up in ONE statement: lock our own entry and the closest-rated player who
  // started searching before us (so of any two searchers only the newer one makes
  // the match), mark both as matched, and create the game. SKIP LOCKED means two
  // searchers can never claim the same person, or each other, at the same time.
  const created = await db.execute<{ black_id: string }>(sql`
    WITH mine AS (
      SELECT user_id, created_at FROM seeks
      WHERE user_id = ${me.id} AND matched_game_id IS NULL
      FOR UPDATE SKIP LOCKED
    ),
    opp AS (
      SELECT s.user_id, s.username FROM seeks s, mine
      WHERE s.time_control_id = ${tc.id}
        AND s.matched_game_id IS NULL
        AND s.user_id <> ${me.id}
        AND (s.created_at, s.user_id) < (mine.created_at, mine.user_id)
        AND s.last_seen_at > ${fresh}::timestamptz
        -- close enough by whichever player's (widening) range is wider
        AND abs(s.rating - ${rating}) <= greatest(
          ${window},
          ${START_WINDOW} + ${WIDEN_PER_SECOND} * extract(epoch FROM (${iso}::timestamptz - s.created_at))
        )
        AND NOT EXISTS (
          SELECT 1 FROM blocks b
          WHERE (b.blocker_id = ${me.id} AND b.blocked_id = s.user_id)
             OR (b.blocker_id = s.user_id AND b.blocked_id = ${me.id})
        )
      ORDER BY abs(s.rating - ${rating}), s.created_at
      LIMIT 1
      FOR UPDATE OF s SKIP LOCKED
    ),
    claimed AS (
      UPDATE seeks SET matched_game_id = ${gameId}::uuid
      WHERE user_id IN (SELECT user_id FROM opp UNION ALL SELECT user_id FROM mine)
        AND EXISTS (SELECT 1 FROM opp)
      RETURNING user_id
    )
    INSERT INTO games (
      id, status, rated, created_by, white_id, white_name, black_id, black_name, fen, moves,
      initial_ms, increment_ms, white_ms, black_ms, started_at, created_at, updated_at
    )
    SELECT
      ${gameId}::uuid, 'active', true, ${me.id}, ${me.id}, ${me.name}, opp.user_id, opp.username,
      ${START_FEN}, '[]'::jsonb, ${tc.initialMs}::int, ${tc.incrementMs}::int, ${tc.initialMs}::int,
      ${tc.initialMs}::int, ${iso}::timestamptz, ${iso}::timestamptz, ${iso}::timestamptz
    FROM opp
    WHERE (SELECT count(*) FROM claimed) = 2
    RETURNING black_id
  `);
  const opponentId = created.rows[0]?.black_id;
  if (opponentId) {
    await db.delete(seeks).where(eq(seeks.userId, me.id));
    // Fair-random colours (see colors.ts). The game was created with us as white;
    // swap the seats before anyone has moved if we should be black.
    const color = pickFairColor(
      await recentColors(me.id, gameId),
      await recentColors(opponentId, gameId),
      randomInt(1_000_000) / 1_000_000,
    );
    if (color === "black") {
      await db.execute(sql`
        UPDATE games
        SET white_id = black_id, white_name = black_name, black_id = white_id, black_name = white_name,
            version = version + 1
        WHERE id = ${gameId}::uuid AND moves = '[]'::jsonb
      `);
    }
    return { status: "matched", gameId };
  }

  const bot = nearestBot(rating);
  return {
    status: "searching",
    since: since.toISOString(),
    rating: Math.round(rating),
    bot: { id: bot.id, name: bot.name, rating: bot.rating, avatar: bot.avatar },
  };
}

/** Stop searching. If someone paired with us in the meantime, returns that game so we can still go to it. */
export async function cancelQuickMatch(me: Player): Promise<string | null> {
  const db = getDb();
  await db.delete(seeks).where(and(eq(seeks.userId, me.id), isNull(seeks.matchedGameId)));
  const [left] = await db.delete(seeks).where(eq(seeks.userId, me.id)).returning();
  return left?.matchedGameId && (await gameExists(left.matchedGameId)) ? left.matchedGameId : null;
}
