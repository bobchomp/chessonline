import type { ChatMessage, Color, Game, GameResult, GameStatus, Termination } from "@/lib/db/schema";
import { clockAt, colorOf, opposite, type ClockSnapshot } from "./rules";

export type PlayerView = { id: string; name: string };

export type ChatView = { id: number; userId: string; userName: string; body: string; createdAt: string };

/** Everything a client needs to render a game. Safe to send to the browser. */
export type GameView = {
  id: string;
  pin: string | null;
  status: GameStatus;
  result: GameResult | null;
  termination: Termination | null;
  white: PlayerView | null;
  black: PlayerView | null;
  myColor: Color | null;
  isCreator: boolean;
  fen: string;
  moves: string[];
  timeControl: { initialMs: number; incrementMs: number } | null;
  clock: ClockSnapshot | null;
  drawOfferBy: Color | null;
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

export function opponentAwayMs(game: Game, userId: string, now: Date): number | null {
  const color = colorOf(game, userId);
  if (!color || game.status !== "active") return null;
  const opp = opposite(color);
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

export function toGameView(game: Game, userId: string, now: Date, chat: ChatMessage[] = []): GameView {
  return {
    id: game.id,
    pin: game.status === "waiting" ? game.pin : null,
    status: game.status,
    result: game.result,
    termination: game.termination,
    white: player(game.whiteId, game.whiteName),
    black: player(game.blackId, game.blackName),
    myColor: colorOf(game, userId),
    isCreator: game.createdBy === userId,
    fen: game.fen,
    moves: game.moves,
    timeControl:
      game.initialMs === null ? null : { initialMs: game.initialMs, incrementMs: game.incrementMs },
    clock: clockAt(game, now),
    drawOfferBy: game.drawOfferBy,
    rematchOfferBy: game.rematchOfferBy,
    rematchGameId: game.rematchGameId,
    opponentAwayMs: opponentAwayMs(game, userId, now),
    version: game.version,
    chat: chat.map(toChatView),
  };
}
