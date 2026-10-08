import { Chess } from "chess.js";
import { describe, expect, it } from "vitest";
import { BOTS, botThinkMs, getBot, isBotId } from "./definitions";
import { greedyMove, lookaheadMove, randomMove } from "./simple";

const legal = (fen: string, m: { from: string; to: string; promotion?: string } | null) => {
  if (!m) return false;
  try {
    new Chess(fen).move(m);
    return true;
  } catch {
    return false;
  }
};

describe("definitions", () => {
  it("ids are unique and prefixed", () => {
    expect(new Set(BOTS.map((b) => b.id)).size).toBe(BOTS.length);
    expect(BOTS.every((b) => isBotId(b.id))).toBe(true);
    expect(isBotId("some-user-uuid")).toBe(false);
    expect(getBot("bot:leo")?.name).toBe("Lookahead Leo");
  });

  it("think time shrinks when the bot's clock is low", () => {
    const bot = getBot("bot:gus")!;
    expect(botThinkMs(bot, null)).toBe(1200);
    expect(botThinkMs(bot, 600_000)).toBe(1200);
    expect(botThinkMs(bot, 9_000)).toBe(300);
    expect(botThinkMs(bot, 1_000)).toBe(150);
  });
});

describe("simple bots", () => {
  const start = new Chess().fen();

  it("always return legal moves, and null when there are none", () => {
    let fen = start;
    const chess = new Chess();
    for (let i = 0; i < 40 && !chess.isGameOver(); i++) {
      const bot = [randomMove, greedyMove, lookaheadMove][i % 3];
      const m = bot(fen);
      expect(legal(fen, m)).toBe(true);
      chess.move(m!);
      fen = chess.fen();
    }
    const mated = "rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3";
    expect(randomMove(mated)).toBeNull();
    expect(greedyMove(mated)).toBeNull();
    expect(lookaheadMove(mated)).toBeNull();
  });

  it("Greta takes the queen over a pawn", () => {
    // White knight on d5 can take a queen on c7 or a pawn on e7.
    const fen = "4k3/2q1p3/8/3N4/8/8/8/4K3 w - - 0 1";
    expect(greedyMove(fen)).toMatchObject({ from: "d5", to: "c7" });
  });

  it("Greta and Leo find mate in one", () => {
    const fen = "6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1"; // Ra8#
    expect(greedyMove(fen)).toMatchObject({ from: "a1", to: "a8" });
    expect(lookaheadMove(fen)).toMatchObject({ from: "a1", to: "a8" });
  });

  it("Leo won't grab a defended pawn with his queen", () => {
    // Qxd5 wins a pawn but loses the queen to exd5.
    const fen = "4k3/8/4p3/3p4/8/8/8/3QK3 w - - 0 1";
    for (let i = 0; i < 10; i++) {
      const m = lookaheadMove(fen)!;
      expect(m.to === "d5" && m.from === "d1").toBe(false);
    }
  });
});
