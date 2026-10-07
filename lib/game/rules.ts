import { Chess } from "chess.js";
import type { Color, Game, GameResult, Termination } from "@/lib/db/schema";

export const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

/** Friend challenges expire if not accepted within this long. */
export const CHALLENGE_TTL_MS = 10 * 60 * 1000;

/** How long a player can be gone before their opponent may claim the win. */
export const ABANDON_AFTER_MS = 2 * 60 * 1000;

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export type TimeControl = { id: string; label: string; initialMs: number | null; incrementMs: number };

export const TIME_CONTROLS: TimeControl[] = [
  { id: "untimed", label: "Untimed", initialMs: null, incrementMs: 0 },
  { id: "1+0", label: "1 + 0 (Bullet)", initialMs: 60_000, incrementMs: 0 },
  { id: "3+0", label: "3 + 0 (Blitz)", initialMs: 180_000, incrementMs: 0 },
  { id: "3+2", label: "3 + 2 (Blitz)", initialMs: 180_000, incrementMs: 2_000 },
  { id: "5+0", label: "5 + 0 (Blitz)", initialMs: 300_000, incrementMs: 0 },
  { id: "5+3", label: "5 + 3 (Blitz)", initialMs: 300_000, incrementMs: 3_000 },
  { id: "10+0", label: "10 + 0 (Rapid)", initialMs: 600_000, incrementMs: 0 },
  { id: "10+5", label: "10 + 5 (Rapid)", initialMs: 600_000, incrementMs: 5_000 },
  { id: "15+10", label: "15 + 10 (Rapid)", initialMs: 900_000, incrementMs: 10_000 },
  { id: "30+0", label: "30 + 0 (Classical)", initialMs: 1_800_000, incrementMs: 0 },
];

export function opposite(color: Color): Color {
  return color === "white" ? "black" : "white";
}

export function colorOf(game: Pick<Game, "whiteId" | "blackId">, userId: string): Color | null {
  if (game.whiteId === userId) return "white";
  if (game.blackId === userId) return "black";
  return null;
}

export function turnOf(game: Pick<Game, "moves">): Color {
  return game.moves.length % 2 === 0 ? "white" : "black";
}

type ClockFields = Pick<
  Game,
  "status" | "initialMs" | "moves" | "whiteMs" | "blackMs" | "lastMoveAt"
>;

/**
 * Clocks start once both players have made their first move, like on most chess
 * servers, so nobody loses time while their opponent is still finding the board.
 */
export function isClockRunning(game: ClockFields): boolean {
  return (
    game.status === "active" &&
    game.initialMs !== null &&
    game.moves.length >= 2 &&
    game.lastMoveAt !== null
  );
}

export type ClockSnapshot = { whiteMs: number; blackMs: number; running: Color | null };

/** Remaining time for each side at `now`. Null for untimed games. */
export function clockAt(game: ClockFields, now: Date): ClockSnapshot | null {
  if (game.initialMs === null) return null;
  let whiteMs = game.whiteMs ?? game.initialMs;
  let blackMs = game.blackMs ?? game.initialMs;
  if (!isClockRunning(game)) return { whiteMs, blackMs, running: null };

  const elapsed = Math.max(0, now.getTime() - game.lastMoveAt!.getTime());
  const running = turnOf(game);
  if (running === "white") whiteMs = Math.max(0, whiteMs - elapsed);
  else blackMs = Math.max(0, blackMs - elapsed);
  return { whiteMs, blackMs, running };
}

/**
 * Whether `color` still has any material that could deliver mate. Used to turn a
 * timeout into a draw when the side that didn't flag couldn't possibly win
 * (lone king, or king plus a single knight or bishop).
 */
export function hasMatingMaterial(fen: string, color: Color): boolean {
  const c = color === "white" ? "w" : "b";
  const pieces = new Chess(fen)
    .board()
    .flat()
    .filter((sq) => sq && sq.color === c && sq.type !== "k");
  if (pieces.length === 0) return false;
  if (pieces.length === 1 && (pieces[0]!.type === "n" || pieces[0]!.type === "b")) return false;
  return true;
}

export function winResult(winner: Color): GameResult {
  return winner === "white" ? "1-0" : "0-1";
}

export type GamePatch = Partial<
  Pick<
    Game,
    | "fen"
    | "moves"
    | "whiteMs"
    | "blackMs"
    | "lastMoveAt"
    | "drawOfferBy"
    | "rematchOfferBy"
    | "rematchGameId"
    | "status"
    | "result"
    | "termination"
    | "endedAt"
    | "startedAt"
    | "whiteId"
    | "whiteName"
    | "blackId"
    | "blackName"
    | "pin"
    | "abortReason"
  >
>;

export function finishPatch(result: GameResult, termination: Termination, now: Date): GamePatch {
  return {
    status: "finished",
    result,
    termination,
    endedAt: now,
    drawOfferBy: null,
    rematchOfferBy: null,
  };
}

/** If the side to move has run out of time, returns the patch that ends the game. */
export function timeoutPatch(game: Game, now: Date): GamePatch | null {
  const clock = clockAt(game, now);
  if (!clock?.running) return null;
  const flagged = clock.running;
  const left = flagged === "white" ? clock.whiteMs : clock.blackMs;
  if (left > 0) return null;

  const clocks: GamePatch =
    flagged === "white" ? { whiteMs: 0, blackMs: clock.blackMs } : { whiteMs: clock.whiteMs, blackMs: 0 };
  const winner = opposite(flagged);
  if (!hasMatingMaterial(game.fen, winner)) {
    return { ...finishPatch("1/2-1/2", "timeout_vs_insufficient_material", now), ...clocks };
  }
  return { ...finishPatch(winResult(winner), "timeout", now), ...clocks };
}

/** If a friend challenge has gone unanswered too long, the patch that expires it. */
export function challengeExpiryPatch(
  game: Pick<Game, "status" | "invitedUserId" | "createdAt">,
  now: Date,
): GamePatch | null {
  if (game.status !== "waiting" || !game.invitedUserId) return null;
  if (now.getTime() - game.createdAt.getTime() < CHALLENGE_TTL_MS) return null;
  return { status: "aborted", abortReason: "expired", endedAt: now };
}

export function replay(moves: string[]): Chess {
  const chess = new Chess();
  for (const san of moves) chess.move(san);
  return chess;
}

export type MoveInput = { from: string; to: string; promotion?: string };

/** Validates and applies a move by `userId`, including clocks and game-over detection. */
export function movePatch(game: Game, userId: string, input: MoveInput, ply: number, now: Date): GamePatch {
  if (game.status !== "active") throw new HttpError(409, "This game is not in progress.");
  const color = colorOf(game, userId);
  if (!color) throw new HttpError(403, "You are not playing in this game.");
  if (ply !== game.moves.length) throw new HttpError(409, "The position changed. Refreshing…");
  if (turnOf(game) !== color) throw new HttpError(409, "It's not your turn.");

  const timeout = timeoutPatch(game, now);
  if (timeout) return timeout;

  const chess = replay(game.moves);
  let san: string;
  try {
    san = chess.move({
      from: input.from,
      to: input.to,
      promotion: input.promotion && /^[qrbn]$/.test(input.promotion) ? input.promotion : undefined,
    }).san;
  } catch {
    throw new HttpError(400, "Illegal move.");
  }

  const patch: GamePatch = {
    fen: chess.fen(),
    moves: [...game.moves, san],
    lastMoveAt: now,
  };

  // Making a move declines any draw your opponent offered.
  if (game.drawOfferBy && game.drawOfferBy !== color) patch.drawOfferBy = null;

  if (game.initialMs !== null) {
    const clock = clockAt(game, now)!;
    const wasRunning = clock.running !== null;
    const bonus = wasRunning ? game.incrementMs : 0;
    patch.whiteMs = clock.whiteMs + (color === "white" ? bonus : 0);
    patch.blackMs = clock.blackMs + (color === "black" ? bonus : 0);
  }

  const over = boardResult(chess);
  if (over) Object.assign(patch, finishPatch(over.result, over.termination, now));
  return patch;
}

export function boardResult(chess: Chess): { result: GameResult; termination: Termination } | null {
  if (chess.isCheckmate()) {
    // The side to move is the one that got mated.
    return { result: chess.turn() === "w" ? "0-1" : "1-0", termination: "checkmate" };
  }
  if (chess.isStalemate()) return { result: "1/2-1/2", termination: "stalemate" };
  if (chess.isInsufficientMaterial()) return { result: "1/2-1/2", termination: "insufficient_material" };
  if (chess.isThreefoldRepetition()) return { result: "1/2-1/2", termination: "threefold_repetition" };
  if (chess.isDrawByFiftyMoves()) return { result: "1/2-1/2", termination: "fifty_move_rule" };
  return null;
}

export type GameAction =
  | "resign"
  | "offer_draw"
  | "accept_draw"
  | "decline_draw"
  | "abort"
  | "cancel"
  | "claim_win"
  | "offer_rematch"
  | "decline_rematch";

/** Patch for every action except accepting a rematch, which creates a new game. */
export function actionPatch(game: Game, userId: string, action: GameAction, now: Date): GamePatch {
  if (action === "cancel") {
    if (game.status !== "waiting") throw new HttpError(409, "Someone already joined this game.");
    if (game.createdBy !== userId) throw new HttpError(403, "Only the creator can cancel this game.");
    return { status: "aborted", endedAt: now };
  }

  const color = colorOf(game, userId);
  if (!color) throw new HttpError(403, "You are not playing in this game.");
  const opponent = opposite(color);

  if (action === "offer_rematch" || action === "decline_rematch") {
    if (game.status !== "finished") throw new HttpError(409, "The game isn't over yet.");
    if (game.rematchGameId) throw new HttpError(409, "A rematch has already started.");
    if (action === "offer_rematch") {
      if (game.rematchOfferBy) throw new HttpError(409, "A rematch has already been offered.");
      return { rematchOfferBy: color };
    }
    if (game.rematchOfferBy !== opponent) throw new HttpError(409, "There's no rematch offer to decline.");
    return { rematchOfferBy: null };
  }

  if (game.status !== "active") throw new HttpError(409, "This game is not in progress.");

  const timeout = timeoutPatch(game, now);
  if (timeout) return timeout;

  switch (action) {
    case "resign":
      return finishPatch(winResult(opponent), "resignation", now);
    case "abort":
      if (game.moves.length >= 2) throw new HttpError(409, "Too late to abort. Resign instead.");
      return { status: "aborted", endedAt: now, drawOfferBy: null };
    case "offer_draw":
      if (game.drawOfferBy === opponent) return finishPatch("1/2-1/2", "agreement", now);
      if (game.drawOfferBy === color) throw new HttpError(409, "You already offered a draw.");
      return { drawOfferBy: color };
    case "accept_draw":
      if (game.drawOfferBy !== opponent) throw new HttpError(409, "There's no draw offer to accept.");
      return finishPatch("1/2-1/2", "agreement", now);
    case "decline_draw":
      if (game.drawOfferBy !== opponent) throw new HttpError(409, "There's no draw offer to decline.");
      return { drawOfferBy: null };
    case "claim_win": {
      const seen = opponent === "white" ? game.whiteSeenAt : game.blackSeenAt;
      const since = seen ?? game.startedAt ?? game.createdAt;
      if (now.getTime() - since.getTime() < ABANDON_AFTER_MS) {
        throw new HttpError(409, "Your opponent is still connected.");
      }
      if (game.moves.length < 2) return { status: "aborted", endedAt: now, drawOfferBy: null };
      return finishPatch(winResult(color), "abandonment", now);
    }
    default:
      throw new HttpError(400, "Unknown action.");
  }
}

export function describeEnding(game: Pick<Game, "status" | "result" | "termination" | "abortReason">): string {
  if (game.status === "aborted") {
    if (game.abortReason === "declined") return "Challenge declined";
    if (game.abortReason === "expired") return "Challenge expired";
    return "Game aborted";
  }
  if (game.status !== "finished" || !game.result) return "";
  const winner = game.result === "1-0" ? "White" : game.result === "0-1" ? "Black" : null;
  const reason: Record<string, string> = {
    checkmate: "by checkmate",
    resignation: "by resignation",
    timeout: "on time",
    abandonment: "by abandonment",
    stalemate: "by stalemate",
    threefold_repetition: "by threefold repetition",
    fifty_move_rule: "by the 50-move rule",
    insufficient_material: "by insufficient material",
    agreement: "by agreement",
    timeout_vs_insufficient_material: "by timeout vs insufficient material",
  };
  const why = game.termination ? reason[game.termination] ?? "" : "";
  return winner ? `${winner} wins ${why}`.trim() : `Draw ${why}`.trim();
}
