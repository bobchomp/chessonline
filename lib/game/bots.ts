import { eq, and, isNull, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { games, type Color, type Game } from "@/lib/db/schema";
import { getBot, isBotId } from "@/lib/bots/definitions";
import type { Player } from "@/lib/users/service";
import { HttpError, TIME_CONTROLS, colorOf, movePatch, opposite, turnOf, type MoveInput } from "./rules";
import { loadGame, mutateGame, prepareNewGame, type NewGameOptions } from "./service";

export function isBotGame(game: Pick<Game, "whiteId" | "blackId">): boolean {
  return isBotId(game.whiteId) || isBotId(game.blackId);
}

/** Starts a game against a computer opponent straight away (no waiting room). */
export async function createBotGame(me: Player, botId: string, opts: NewGameOptions): Promise<Game> {
  const bot = getBot(botId);
  if (!bot) throw new HttpError(400, "Unknown computer opponent.");
  const now = new Date();
  const values = await prepareNewGame(me, opts, now);
  const botSeat = values.whiteId ? { blackId: bot.id, blackName: bot.name } : { whiteId: bot.id, whiteName: bot.name };
  const [game] = await getDb()
    .insert(games)
    .values({ ...values, ...botSeat, pin: null, status: "active", startedAt: now })
    .returning();
  return game;
}

/**
 * Applies the computer's move. Bot moves are computed in the human player's
 * browser, so only that player may submit them, and only on the bot's turn.
 */
export async function playBotMove(me: Player, gameId: string, input: MoveInput, ply: number): Promise<Game> {
  return mutateGame(gameId, (g, now) => {
    if (!colorOf(g, me.id)) throw new HttpError(403, "You are not playing in this game.");
    const botId = turnOf(g) === "white" ? g.whiteId : g.blackId;
    if (!isBotId(botId)) throw new HttpError(409, "It's not the computer's turn.");
    return movePatch(g, botId!, input, ply, now);
  });
}

/** "Play again" against the same bot: same time control, colors swapped. */
export async function rematchBotGame(me: Player, gameId: string): Promise<Game> {
  const old = await loadGame(gameId);
  const myColor = colorOf(old, me.id);
  if (!myColor || !isBotGame(old)) throw new HttpError(403, "You are not playing in this game.");
  if (old.rematchGameId) return old;
  if (old.status !== "finished" && old.status !== "aborted") throw new HttpError(409, "The game isn't over yet.");

  const botId = (myColor === "white" ? old.blackId : old.whiteId)!;
  const tc = TIME_CONTROLS.find((t) => t.initialMs === old.initialMs && t.incrementMs === old.incrementMs);
  const next = await createBotGame(me, botId, {
    timeControlId: tc?.id ?? "untimed",
    color: opposite(myColor) as Color,
    rated: old.rated,
  });
  await getDb()
    .update(games)
    .set({ rematchGameId: next.id, rematchOfferBy: null, version: sql`${games.version} + 1`, updatedAt: new Date() })
    .where(and(eq(games.id, old.id), isNull(games.rematchGameId)));
  return loadGame(gameId);
}
