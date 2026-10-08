import { describe, expect, it } from "vitest";
import type { Game } from "@/lib/db/schema";
import {
  ABANDON_AFTER_MS,
  CHALLENGE_TTL_MS,
  challengeExpiryPatch,
  describeEnding,
  HttpError,
  START_FEN,
  actionPatch,
  clockAt,
  hasMatingMaterial,
  movePatch,
  timeoutPatch,
} from "./rules";

const W = "user-white";
const B = "user-black";
const T0 = new Date("2026-01-01T00:00:00Z");
const at = (ms: number) => new Date(T0.getTime() + ms);

function game(overrides: Partial<Game> = {}): Game {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    pin: "123456",
    status: "active",
    createdBy: W,
    invitedUserId: null,
    invitedName: null,
    whiteId: W,
    whiteName: "White",
    blackId: B,
    blackName: "Black",
    fen: START_FEN,
    moves: [],
    initialMs: null,
    incrementMs: 0,
    whiteMs: null,
    blackMs: null,
    lastMoveAt: null,
    drawOfferBy: null,
    rematchOfferBy: null,
    rematchGameId: null,
    result: null,
    termination: null,
    abortReason: null,
    whiteSeenAt: T0,
    blackSeenAt: T0,
    version: 1,
    createdAt: T0,
    startedAt: T0,
    endedAt: null,
    updatedAt: T0,
    ...overrides,
  };
}

/** Plays a sequence of [from, to] moves through movePatch, alternating players. */
function play(g: Game, moves: [string, string, string?][], stepMs = 1000): Game {
  let now = g.lastMoveAt?.getTime() ?? T0.getTime();
  for (const [from, to, promotion] of moves) {
    now += stepMs;
    const user = g.moves.length % 2 === 0 ? W : B;
    g = { ...g, ...movePatch(g, user, { from, to, promotion }, g.moves.length, new Date(now)) };
  }
  return g;
}

function expectHttp(fn: () => unknown, status: number) {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(HttpError);
    expect((e as HttpError).status).toBe(status);
    return;
  }
  throw new Error("expected HttpError");
}

describe("moves", () => {
  it("applies legal moves and records SAN", () => {
    const g = play(game(), [
      ["e2", "e4"],
      ["e7", "e5"],
      ["g1", "f3"],
    ]);
    expect(g.moves).toEqual(["e4", "e5", "Nf3"]);
    expect(g.fen).toContain(" b KQkq ");
  });

  it("rejects illegal moves, wrong turn, stale ply, and spectators", () => {
    const g = game();
    expectHttp(() => movePatch(g, W, { from: "e2", to: "e5" }, 0, T0), 400);
    expectHttp(() => movePatch(g, B, { from: "e7", to: "e5" }, 0, T0), 409);
    expectHttp(() => movePatch(g, W, { from: "e2", to: "e4" }, 3, T0), 409);
    expectHttp(() => movePatch(g, "someone-else", { from: "e2", to: "e4" }, 0, T0), 403);
  });

  it("detects checkmate (fool's mate)", () => {
    const g = play(game(), [
      ["f2", "f3"],
      ["e7", "e5"],
      ["g2", "g4"],
      ["d8", "h4"],
    ]);
    expect(g.status).toBe("finished");
    expect(g.result).toBe("0-1");
    expect(g.termination).toBe("checkmate");
  });

  it("handles promotion", () => {
    const promo = play(game(), [
      ["h2", "h4"],
      ["g7", "g5"],
      ["h4", "g5"],
      ["h7", "h6"],
      ["g5", "h6"],
      ["f8", "g7"],
      ["h6", "g7"],
      ["g8", "f6"],
      ["g7", "h8", "n"],
    ]);
    expect(promo.moves.at(-1)).toBe("gxh8=N");
  });

  it("detects threefold repetition", () => {
    const shuffle: [string, string][] = [
      ["g1", "f3"],
      ["g8", "f6"],
      ["f3", "g1"],
      ["f6", "g8"],
    ];
    const g = play(game(), [...shuffle, ...shuffle]);
    expect(g.status).toBe("finished");
    expect(g.termination).toBe("threefold_repetition");
    expect(g.result).toBe("1/2-1/2");
  });

  it("making a move declines the opponent's draw offer but keeps your own", () => {
    let g = game({ drawOfferBy: "black" });
    g = play(g, [["e2", "e4"]]);
    expect(g.drawOfferBy).toBeNull();
    g = { ...g, drawOfferBy: "black" };
    g = play(g, [["e7", "e5"]]);
    expect(g.drawOfferBy).toBe("black");
  });
});

describe("clocks", () => {
  const timed = (o: Partial<Game> = {}) =>
    game({ initialMs: 60_000, incrementMs: 2_000, whiteMs: 60_000, blackMs: 60_000, ...o });

  it("does not run until both players have moved", () => {
    let g = play(timed(), [["e2", "e4"]], 10_000);
    expect(g.whiteMs).toBe(60_000);
    expect(clockAt(g, at(50_000))!.running).toBeNull();
    g = play(g, [["e7", "e5"]], 10_000);
    expect(g.blackMs).toBe(60_000);
    expect(clockAt(g, g.lastMoveAt!)!.running).toBe("white");
  });

  it("deducts thinking time and adds the increment", () => {
    let g = play(timed(), [
      ["e2", "e4"],
      ["e7", "e5"],
    ]);
    g = play(g, [["g1", "f3"]], 5_000);
    expect(g.whiteMs).toBe(60_000 - 5_000 + 2_000);
    expect(g.blackMs).toBe(60_000);
  });

  it("flags the side to move when time runs out", () => {
    const g = play(timed({ incrementMs: 0 }), [
      ["e2", "e4"],
      ["e7", "e5"],
    ]);
    expect(timeoutPatch(g, at(g.lastMoveAt!.getTime() - T0.getTime() + 59_000))).toBeNull();
    const patch = timeoutPatch(g, new Date(g.lastMoveAt!.getTime() + 60_001))!;
    expect(patch.result).toBe("0-1");
    expect(patch.termination).toBe("timeout");
    expect(patch.whiteMs).toBe(0);
  });

  it("a move after the flag fell ends the game on time instead", () => {
    const g = play(timed({ incrementMs: 0 }), [
      ["e2", "e4"],
      ["e7", "e5"],
    ]);
    const patch = movePatch(g, W, { from: "g1", to: "f3" }, 2, new Date(g.lastMoveAt!.getTime() + 61_000));
    expect(patch.termination).toBe("timeout");
    expect(patch.moves).toBeUndefined();
  });

  it("timeout is a draw if the opponent cannot mate", () => {
    const g = timed({
      fen: "8/8/8/8/8/8/k7/6NK w - - 0 1",
      moves: ["a", "b"],
      lastMoveAt: T0,
    });
    // White to move flags, black has a lone king -> draw.
    const patch = timeoutPatch(g, at(61_000))!;
    expect(patch.result).toBe("1/2-1/2");
    expect(patch.termination).toBe("timeout_vs_insufficient_material");
  });

  it("knows who has mating material", () => {
    expect(hasMatingMaterial(START_FEN, "white")).toBe(true);
    expect(hasMatingMaterial("8/8/8/8/8/8/k7/6NK w - - 0 1", "white")).toBe(false);
    expect(hasMatingMaterial("8/8/8/8/8/8/k7/5NNK w - - 0 1", "white")).toBe(true);
    expect(hasMatingMaterial("8/8/8/8/8/8/k6p/7K w - - 0 1", "black")).toBe(true);
  });
});

describe("actions", () => {
  it("resign gives the win to the opponent", () => {
    const patch = actionPatch(game(), B, "resign", T0);
    expect(patch).toMatchObject({ status: "finished", result: "1-0", termination: "resignation" });
  });

  it("draw offer / accept / decline", () => {
    const g = game();
    expect(actionPatch(g, W, "offer_draw", T0)).toEqual({ drawOfferBy: "white" });
    expectHttp(() => actionPatch({ ...g, drawOfferBy: "white" }, W, "accept_draw", T0), 409);
    expect(actionPatch({ ...g, drawOfferBy: "white" }, B, "accept_draw", T0)).toMatchObject({
      result: "1/2-1/2",
      termination: "agreement",
    });
    expect(actionPatch({ ...g, drawOfferBy: "white" }, B, "decline_draw", T0)).toEqual({ drawOfferBy: null });
    // Offering when the opponent already offered = agreement.
    expect(actionPatch({ ...g, drawOfferBy: "white" }, B, "offer_draw", T0)).toMatchObject({
      termination: "agreement",
    });
  });

  it("abort only before both sides moved", () => {
    expect(actionPatch(game({ moves: ["e4"] }), B, "abort", T0)).toMatchObject({ status: "aborted" });
    expectHttp(() => actionPatch(game({ moves: ["e4", "e5"] }), B, "abort", T0), 409);
  });

  it("cancel only for the creator of a waiting game", () => {
    const waiting = game({ status: "waiting", blackId: null, blackName: null });
    expect(actionPatch(waiting, W, "cancel", T0)).toMatchObject({ status: "aborted" });
    expectHttp(() => actionPatch(waiting, "other", "cancel", T0), 403);
    expectHttp(() => actionPatch(game(), W, "cancel", T0), 409);
  });

  it("claim win only after the opponent is gone long enough", () => {
    const g = game({ moves: ["e4", "e5"], blackSeenAt: T0 });
    expectHttp(() => actionPatch(g, W, "claim_win", at(ABANDON_AFTER_MS - 1)), 409);
    expect(actionPatch(g, W, "claim_win", at(ABANDON_AFTER_MS + 1))).toMatchObject({
      result: "1-0",
      termination: "abandonment",
    });
  });

  it("rematch offers only after the game ends", () => {
    expectHttp(() => actionPatch(game(), W, "offer_rematch", T0), 409);
    const over = game({ status: "finished", result: "1-0" });
    expect(actionPatch(over, B, "offer_rematch", T0)).toEqual({ rematchOfferBy: "black" });
    expect(actionPatch({ ...over, rematchOfferBy: "black" }, W, "decline_rematch", T0)).toEqual({
      rematchOfferBy: null,
    });
  });

  it("spectators cannot act", () => {
    expectHttp(() => actionPatch(game(), "spectator", "resign", T0), 403);
  });
});

describe("challenges", () => {
  const challenge = (o: Partial<Game> = {}) =>
    game({ status: "waiting", blackId: null, blackName: null, pin: null, invitedUserId: B, invitedName: "Black", ...o });

  it("expire after the TTL, only while waiting and only for challenges", () => {
    expect(challengeExpiryPatch(challenge(), at(CHALLENGE_TTL_MS - 1))).toBeNull();
    expect(challengeExpiryPatch(challenge(), at(CHALLENGE_TTL_MS))).toMatchObject({
      status: "aborted",
      abortReason: "expired",
    });
    expect(challengeExpiryPatch(challenge({ status: "active" }), at(CHALLENGE_TTL_MS * 2))).toBeNull();
    expect(challengeExpiryPatch(game({ status: "waiting" }), at(CHALLENGE_TTL_MS * 2))).toBeNull();
  });

  it("describes declined and expired challenges", () => {
    expect(describeEnding({ status: "aborted", result: null, termination: null, abortReason: "declined" })).toBe(
      "Challenge declined",
    );
    expect(describeEnding({ status: "aborted", result: null, termination: null, abortReason: "expired" })).toBe(
      "Challenge expired",
    );
    expect(describeEnding({ status: "aborted", result: null, termination: null, abortReason: null })).toBe("Game aborted");
  });
});

describe("bot games", () => {
  const botGame = (o: Partial<Game> = {}) =>
    game({ blackId: "bot:leo", blackName: "Lookahead Leo", initialMs: 60_000, whiteMs: 60_000, blackMs: 60_000, ...o });

  it("the bot never flags, but the human still can", () => {
    // Black (bot) to move with its clock long gone.
    const botTurn = botGame({ moves: ["e4", "e5", "Nf3"], lastMoveAt: T0 });
    expect(timeoutPatch(botTurn, at(120_000))).toBeNull();
    const humanTurn = botGame({ moves: ["e4", "e5"], lastMoveAt: T0 });
    expect(timeoutPatch(humanTurn, at(61_000))).toMatchObject({ result: "0-1", termination: "timeout" });
  });

  it("no draw offers or abandonment claims against the computer; resign still works", () => {
    const g = botGame({ moves: ["e4", "e5"] });
    expectHttp(() => actionPatch(g, W, "offer_draw", T0), 409);
    expectHttp(() => actionPatch(g, W, "claim_win", at(ABANDON_AFTER_MS * 10)), 409);
    expect(actionPatch(g, W, "resign", T0)).toMatchObject({ result: "0-1", termination: "resignation" });
  });
});
