import type { AbortReason, ChatMessage, Color, Game, GameResult, GameStatus, Termination } from "@/lib/db/schema";
import { CHALLENGE_TTL_MS, clockAt, colorOf, opposite, type ClockSnapshot } from "./rules";
import { getBot, isBotId } from "@/lib/bots/definitions";
import { isProvisional } from "@/lib/ratings/glicko2";

export type PlayerView = {
  id: string;
  name: string;
  /** Rating going into the game (or the player's current rating while it's on). */
  rating?: number | null;
  /** Shown with a "?" while still settling. */
  provisional?: boolean;
  /** Rating change from a finished rated game. */
  ratingDiff?: number | null;
};

/** Current ratings of the human players, used while a game hasn't been rated yet. */
export type LiveRatings = Record<string, { rating: number; rd: number }>;

export type ChatView = { id: number; userId: string; userName: string; body: string; createdAt: string };

/** Everything a client needs to render a game. Safe to send to the browser. */
export type GameView = {
  id: string;
  pin: string | null;
  status: GameStatus;
  result: GameResult | null;
  termination: Termination | null;
  abortReason: AbortReason | null;
  white: PlayerView | null;
  black: PlayerView | null;
  rated: boolean;
  myColor: Color | null;
  isCreator: boolean;
  /** For friend challenges: who was challenged, whether that's you, and when it expires. */
  invited: PlayerView | null;
  isInvited: boolean;
  expiresAt: string | null;
  fen: string;
  moves: string[];
  timeControl: { initialMs: number; incrementMs: number } | null;
  clock: ClockSnapshot | null;
  drawOfferBy: Color | null;
  /** Which players have used their one draw offer for this game. */
  drawOffered: { white: boolean; black: boolean };
  rematchOfferBy: Color | null;
  rematchGameId: string | null;
  /** How long the opponent has gone without checking in (players only). */
  opponentAwayMs: number | null;
  version: number;
  chat: ChatView[];
};

/** Returned by the poll endpoint when nothing has changed since `version`. */
export type UnchangedView = {
  unchanged: true;
  version: number;
  clock: ClockSnapshot | null;
  opponentAwayMs: number | null;
};

function player(id: string | null, name: string | null): PlayerView | null {
  return id ? { id, name: name ?? "Player" } : null;
}

function seat(game: Game, color: Color, live: LiveRatings): PlayerView | null {
  const base = color === "white" ? player(game.whiteId, game.whiteName) : player(game.blackId, game.blackName);
  if (!base) return null;
  const stored = color === "white" ? game.whiteRating : game.blackRating;
  const diff = color === "white" ? game.whiteRatingDiff : game.blackRatingDiff;
  const bot = getBot(base.id);
  if (stored !== null) return { ...base, rating: stored, provisional: false, ratingDiff: diff };
  if (bot) return { ...base, rating: bot.ratingValue, provisional: false, ratingDiff: null };
  const r = live[base.id];
  return { ...base, rating: r ? Math.round(r.rating) : null, provisional: r ? isProvisional(r.rd) : false, ratingDiff: null };
}

export function opponentAwayMs(game: Game, userId: string, now: Date): number | null {
  const color = colorOf(game, userId);
  if (!color || game.status !== "active") return null;
  const opp = opposite(color);
  if (isBotId(opp === "white" ? game.whiteId : game.blackId)) return null;
  const seen = (opp === "white" ? game.whiteSeenAt : game.blackSeenAt) ?? game.startedAt ?? game.createdAt;
  return Math.max(0, now.getTime() - seen.getTime());
}

export function toChatView(m: ChatMessage): ChatView {
  return {
    id: m.id,
    userId: m.userId,
    userName: m.userName,
    body: m.body,
    createdAt: m.createdAt.toISOString(),
  };
}

export function toGameView(
  game: Game,
  userId: string,
  now: Date,
  chat: ChatMessage[] = [],
  live: LiveRatings = {},
): GameView {
  return {
    id: game.id,
    pin: game.status === "waiting" && !game.invitedUserId ? game.pin : null,
    status: game.status,
    result: game.result,
    termination: game.termination,
    abortReason: game.abortReason,
    white: seat(game, "white", live),
    black: seat(game, "black", live),
    rated: game.rated,
    myColor: colorOf(game, userId),
    isCreator: game.createdBy === userId,
    invited: player(game.invitedUserId, game.invitedName),
    isInvited: !!game.invitedUserId && game.invitedUserId === userId,
    expiresAt:
      game.status === "waiting" && game.invitedUserId
        ? new Date(game.createdAt.getTime() + CHALLENGE_TTL_MS).toISOString()
        : null,
    fen: game.fen,
    moves: game.moves,
    timeControl:
      game.initialMs === null ? null : { initialMs: game.initialMs, incrementMs: game.incrementMs },
    clock: clockAt(game, now),
    drawOfferBy: game.drawOfferBy,
    drawOffered: { white: game.whiteOfferedDraw, black: game.blackOfferedDraw },
    rematchOfferBy: game.rematchOfferBy,
    rematchGameId: game.rematchGameId,
    opponentAwayMs: opponentAwayMs(game, userId, now),
    version: game.version,
    chat: chat.map(toChatView),
  };
}
