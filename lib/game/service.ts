import { randomInt, randomUUID } from "node:crypto";
import { and, asc, count, desc, eq, gt, lt, ne, or, isNotNull, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { chatMessages, games, type Color, type Game } from "@/lib/db/schema";
import type { CurrentUser } from "@/lib/auth/session";
import {
  HttpError,
  START_FEN,
  TIME_CONTROLS,
  actionPatch,
  challengeExpiryPatch,
  clockAt,
  colorOf,
  movePatch,
  opposite,
  timeoutPatch,
  type GameAction,
  type GamePatch,
  type MoveInput,
} from "./rules";
import { COLOR_HISTORY_GAMES, pickFairColor } from "./colors";
import { opponentAwayMs, toGameView, type GameView, type UnchangedView } from "./view";
import { isBotId } from "@/lib/bots/definitions";

const WAITING_GAME_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_WAITING_GAMES_PER_USER = 5;
const PRESENCE_WRITE_EVERY_MS = 15_000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUniqueViolation(err: unknown): boolean {
  for (let e: unknown = err; e && typeof e === "object"; e = (e as { cause?: unknown }).cause) {
    if ((e as { code?: string }).code === "23505") return true;
  }
  return false;
}

export async function loadGame(id: string): Promise<Game> {
  if (!UUID_RE.test(id)) throw new HttpError(404, "Game not found.");
  const [game] = await getDb().select().from(games).where(eq(games.id, id)).limit(1);
  if (!game) throw new HttpError(404, "Game not found.");
  return game;
}

/**
 * Optimistic-concurrency update: load the game, compute a patch, and write it only
 * if nobody else changed the game in between. Retries a few times on conflict.
 */
export async function mutateGame(id: string, fn: (game: Game, now: Date) => GamePatch | null): Promise<Game> {
  const db = getDb();
  for (let attempt = 0; attempt < 4; attempt++) {
    const game = await loadGame(id);
    const now = new Date();
    const patch = fn(game, now);
    if (!patch) return game;
    const [updated] = await db
      .update(games)
      .set({ ...patch, version: sql`${games.version} + 1`, updatedAt: now })
      .where(and(eq(games.id, id), eq(games.version, game.version)))
      .returning();
    if (updated) return updated;
  }
  throw new HttpError(409, "The game is busy. Please try again.");
}

export type NewGameOptions = { timeControlId: string; color: Color | "random" };

/** The colors a player had in their most recent started games, newest first. */
async function recentColors(userId: string): Promise<Color[]> {
  const rows = await getDb()
    .select({ whiteId: games.whiteId })
    .from(games)
    .where(
      and(
        or(eq(games.whiteId, userId), eq(games.blackId, userId)),
        or(eq(games.status, "active"), eq(games.status, "finished")),
      ),
    )
    .orderBy(desc(games.createdAt))
    .limit(COLOR_HISTORY_GAMES);
  return rows.map((r) => (r.whiteId === userId ? "white" : "black"));
}

/** Validates options, frees stale PINs, enforces the open-game limit, and picks a color. */
export async function prepareNewGame(
  user: CurrentUser,
  opts: NewGameOptions,
  now: Date,
  /** For challenges: the invited player, whose color history also counts. */
  opponentId?: string,
) {
  const tc = TIME_CONTROLS.find((t) => t.id === opts.timeControlId);
  if (!tc) throw new HttpError(400, "Unknown time control.");
  if (!["white", "black", "random"].includes(opts.color)) throw new HttpError(400, "Unknown color.");

  const db = getDb();
  // Free up PINs held by games nobody joined.
  await db
    .update(games)
    .set({ status: "aborted", endedAt: now, updatedAt: now, version: sql`${games.version} + 1` })
    .where(and(eq(games.status, "waiting"), lt(games.createdAt, new Date(now.getTime() - WAITING_GAME_TTL_MS))));

  const [{ value: waiting }] = await db
    .select({ value: count() })
    .from(games)
    .where(and(eq(games.createdBy, user.id), eq(games.status, "waiting")));
  if (waiting >= MAX_WAITING_GAMES_PER_USER) {
    throw new HttpError(429, "You have too many open games. Cancel one before creating another.");
  }

  const color: Color =
    opts.color === "random"
      ? pickFairColor(
          await recentColors(user.id),
          opponentId ? await recentColors(opponentId) : null,
          randomInt(1_000_000) / 1_000_000,
        )
      : opts.color;
  return {
    status: "waiting" as const,
    createdBy: user.id,
    whiteId: color === "white" ? user.id : null,
    whiteName: color === "white" ? user.name : null,
    blackId: color === "black" ? user.id : null,
    blackName: color === "black" ? user.name : null,
    fen: START_FEN,
    moves: [],
    initialMs: tc.initialMs,
    incrementMs: tc.incrementMs,
    whiteMs: tc.initialMs,
    blackMs: tc.initialMs,
    createdAt: now,
    updatedAt: now,
  };
}

export async function createGame(user: CurrentUser, opts: NewGameOptions): Promise<Game> {
  const now = new Date();
  const values = await prepareNewGame(user, opts, now);
  for (let attempt = 0; attempt < 10; attempt++) {
    const pin = String(randomInt(100_000, 1_000_000));
    try {
      const [game] = await getDb()
        .insert(games)
        .values({ ...values, pin })
        .returning();
      return game;
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
    }
  }
  throw new HttpError(503, "Couldn't allocate a PIN. Please try again.");
}

/** A waiting game addressed to one user instead of a PIN. Callers check they may challenge them. */
export async function insertChallengeGame(
  user: CurrentUser,
  opts: NewGameOptions,
  invited: { id: string; name: string },
): Promise<Game> {
  const now = new Date();
  const values = await prepareNewGame(user, opts, now, invited.id);
  const [game] = await getDb()
    .insert(games)
    .values({ ...values, pin: null, invitedUserId: invited.id, invitedName: invited.name })
    .returning();
  return game;
}

export async function joinByPin(user: CurrentUser, pin: string): Promise<Game> {
  const clean = pin.replace(/\D/g, "");
  if (clean.length !== 6) throw new HttpError(400, "PINs are 6 digits.");

  const [found] = await getDb()
    .select()
    .from(games)
    .where(and(eq(games.pin, clean), eq(games.status, "waiting")))
    .limit(1);
  if (!found || Date.now() - found.createdAt.getTime() > WAITING_GAME_TTL_MS) {
    throw new HttpError(404, "No open game with that PIN.");
  }
  if (found.createdBy === user.id) return found;

  return mutateGame(found.id, (game, now) => {
    if (game.status !== "waiting") {
      if (colorOf(game, user.id)) return null; // we already joined (double submit)
      throw new HttpError(409, "Someone else already joined that game.");
    }
    const seatPatch: GamePatch = game.whiteId
      ? { blackId: user.id, blackName: user.name }
      : { whiteId: user.id, whiteName: user.name };
    return { ...seatPatch, status: "active", startedAt: now };
  });
}

export async function makeMove(user: CurrentUser, id: string, input: MoveInput, ply: number): Promise<Game> {
  return mutateGame(id, (game, now) => movePatch(game, user.id, input, ply, now));
}

export async function performAction(user: CurrentUser, id: string, action: GameAction | "accept_rematch") {
  if (action === "accept_rematch") return acceptRematch(user, id);
  if (action === "offer_rematch") {
    // If both players hit "rematch" at about the same time, treat the second as an accept.
    const game = await loadGame(id);
    const color = colorOf(game, user.id);
    if (color && game.rematchOfferBy === opposite(color) && !game.rematchGameId) {
      return acceptRematch(user, id);
    }
  }
  return mutateGame(id, (game, now) => actionPatch(game, user.id, action, now));
}

/** Creates the rematch (colors swapped) and links it from the old game, atomically. */
async function acceptRematch(user: CurrentUser, id: string): Promise<Game> {
  const db = getDb();
  for (let attempt = 0; attempt < 4; attempt++) {
    const old = await loadGame(id);
    const color = colorOf(old, user.id);
    if (!color) throw new HttpError(403, "You are not playing in this game.");
    if (old.rematchGameId) return old;
    if (old.status !== "finished") throw new HttpError(409, "The game isn't over yet.");
    if (old.rematchOfferBy !== opposite(color)) throw new HttpError(409, "There's no rematch offer to accept.");

    const newId = randomUUID();
    const now = new Date().toISOString();
    const res = await db.execute(sql`
      WITH claimed AS (
        UPDATE games
        SET rematch_game_id = ${newId}::uuid, rematch_offer_by = NULL,
            version = version + 1, updated_at = ${now}::timestamptz
        WHERE id = ${old.id}::uuid AND version = ${old.version} AND rematch_game_id IS NULL
        RETURNING id
      )
      INSERT INTO games (
        id, status, created_by, white_id, white_name, black_id, black_name, fen, moves,
        initial_ms, increment_ms, white_ms, black_ms, started_at, created_at, updated_at
      )
      SELECT
        ${newId}::uuid, 'active', ${user.id}, ${old.blackId}, ${old.blackName}, ${old.whiteId}, ${old.whiteName},
        ${START_FEN}, '[]'::jsonb, ${old.initialMs}::int, ${old.incrementMs}::int,
        ${old.initialMs}::int, ${old.initialMs}::int, ${now}::timestamptz, ${now}::timestamptz, ${now}::timestamptz
      FROM claimed
      RETURNING id
    `);
    if (res.rows.length > 0) return loadGame(id);
  }
  throw new HttpError(409, "The game is busy. Please try again.");
}

/**
 * Poll endpoint. Also enforces flag-falls lazily (whoever polls first ends the
 * game on time) and records that the caller is still connected.
 */
export async function getGameState(
  user: CurrentUser,
  id: string,
  sinceVersion: number | null,
  chatAfter: number,
): Promise<GameView | UnchangedView> {
  const db = getDb();
  let game = await loadGame(id);
  let now = new Date();

  if (timeoutPatch(game, now)) {
    game = await mutateGame(id, (g, n) => timeoutPatch(g, n));
    now = new Date();
  }
  if (challengeExpiryPatch(game, now)) {
    game = await mutateGame(id, (g, n) => challengeExpiryPatch(g, n));
    now = new Date();
  }

  const color = colorOf(game, user.id);
  if (color && (game.status === "active" || game.status === "waiting")) {
    const seenAt = color === "white" ? game.whiteSeenAt : game.blackSeenAt;
    if (!seenAt || now.getTime() - seenAt.getTime() > PRESENCE_WRITE_EVERY_MS) {
      // Deliberately doesn't bump `version`: presence alone isn't worth a full refresh.
      await db
        .update(games)
        .set(color === "white" ? { whiteSeenAt: now } : { blackSeenAt: now })
        .where(eq(games.id, id));
    }
  }

  if (sinceVersion === game.version) {
    return {
      unchanged: true,
      version: game.version,
      clock: clockAt(game, now),
      opponentAwayMs: opponentAwayMs(game, user.id, now),
    };
  }

  const chat = color
    ? await db
        .select()
        .from(chatMessages)
        .where(and(eq(chatMessages.gameId, id), gt(chatMessages.id, chatAfter)))
        .orderBy(asc(chatMessages.id))
        .limit(200)
    : [];

  return toGameView(game, user.id, now, chat);
}

export async function postChat(user: CurrentUser, id: string, body: string): Promise<void> {
  const text = body.trim().slice(0, 500);
  if (!text) throw new HttpError(400, "Message is empty.");
  const game = await loadGame(id);
  if (!colorOf(game, user.id)) throw new HttpError(403, "Only players can chat.");
  if (isBotId(game.whiteId) || isBotId(game.blackId)) throw new HttpError(400, "The computer doesn't chat.");

  const db = getDb();
  await db.batch([
    db.insert(chatMessages).values({ gameId: id, userId: user.id, userName: user.name, body: text }),
    db
      .update(games)
      .set({ version: sql`${games.version} + 1`, updatedAt: new Date() })
      .where(eq(games.id, id)),
  ]);
}

/** Games the user is (or was) playing, newest activity first. Excludes cancelled invites. */
export async function listGames(userId: string): Promise<Game[]> {
  return getDb()
    .select()
    .from(games)
    .where(
      and(
        or(eq(games.whiteId, userId), eq(games.blackId, userId)),
        or(ne(games.status, "aborted"), and(isNotNull(games.whiteId), isNotNull(games.blackId))),
      ),
    )
    .orderBy(desc(games.updatedAt))
    .limit(100);
}
