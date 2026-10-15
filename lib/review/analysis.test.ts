import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import {
  baseClass,
  formatEval,
  gameSummary,
  keyMoments,
  isSacrifice,
  materialBalance,
  moveAccuracy,
  reviewMoves,
  summarize,
  whiteWinPercent,
  type Eval,
  type MoveClass,
  type PositionInfo,
  type ReviewedMove,
} from "./analysis";
import { explainMove, formatLine, playLine } from "./explain";

function line(sans: string[]) {
  const chess = new Chess();
  const fens = [chess.fen()];
  const played: string[] = [];
  for (const s of sans) {
    const m = chess.move(s);
    played.push(m.from + m.to + (m.promotion ?? ""));
    fens.push(chess.fen());
  }
  return { fens, played };
}
const pos = (e: Eval, best: string | null = null, pv: string[] = [], second: Eval | null = null): PositionInfo => ({
  eval: e,
  best,
  pv: pv.length ? pv : best ? [best] : [],
  second,
});

describe("win chances, formatting, accuracy", () => {
  it("win percent: even at 0, symmetric, saturating, mate is certain", () => {
    expect(whiteWinPercent({ cp: 0 })).toBeCloseTo(50);
    expect(whiteWinPercent({ cp: 300 }) + whiteWinPercent({ cp: -300 })).toBeCloseTo(100);
    expect(whiteWinPercent({ cp: 100 })).toBeCloseTo(59.1, 0);
    expect(whiteWinPercent({ cp: 5000 })).toBe(whiteWinPercent({ cp: 1000 }));
    expect(whiteWinPercent({ mate: 3 })).toBe(100);
    expect(whiteWinPercent({ mate: -1 })).toBe(0);
  });

  it("formats evaluations", () => {
    expect(formatEval({ cp: 134 })).toBe("+1.3");
    expect(formatEval({ cp: -30 })).toBe("−0.3");
    expect(formatEval({ mate: -4 })).toBe("−M4");
  });

  it("labels by Chess.com's expected-points bands", () => {
    expect(baseClass(0, true)).toBe("best");
    expect(baseClass(1, false)).toBe("excellent");
    expect(baseClass(3, false)).toBe("good");
    expect(baseClass(7, false)).toBe("inaccuracy");
    expect(baseClass(15, false)).toBe("mistake");
    expect(baseClass(25, false)).toBe("blunder");
  });

  it("accuracy is ~100 for no loss and falls with bigger losses", () => {
    expect(moveAccuracy(0)).toBeGreaterThan(99.9);
    expect(moveAccuracy(80)).toBeLessThan(5);
  });
});

describe("special labels", () => {
  it("detects sacrifices (and not ordinary trades)", () => {
    // Italian: 4. Bxf7+ gives a bishop for a pawn.
    const { fens } = line(["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5"]);
    expect(isSacrifice(fens[6], "c4f7")).toBe(true);
    // A queen trade isn't a sacrifice.
    const t = line(["e4", "e5", "Qh5", "Qh4"]);
    expect(isSacrifice(t.fens[4], "h5h4")).toBe(false);
    // Pawn moves never count.
    expect(isSacrifice(fens[0], "e2e4")).toBe(false);
  });

  it("book moves, best, blunder, then a miss", () => {
    const { fens, played } = line(["e4", "e5", "Qh5", "Nc6", "Qxe5+"]);
    const positions = [
      pos({ cp: 20 }, "e2e4"),
      pos({ cp: 25 }, "e7e5"),
      pos({ cp: 20 }, "g1f3"),
      pos({ cp: 15 }, "b8c6"),
      pos({ cp: 30 }, "f1c4"), // after 2...Nc6, White should play Bc4; Qxe5+ drops the queen
      pos({ cp: -700 }, "c6e5"),
    ];
    const book = [true, true, false, false, false];
    const r = reviewMoves(["e4", "e5", "Qh5", "Nc6", "Qxe5+"], fens, positions, played, book);
    expect(r.map((m) => m.cls)).toEqual(["book", "book", "excellent", "best", "blunder"]);
    const ex = explainMove(r[4], fens[4], fens[5], positions[4], positions[5], null);
    expect(ex.headline).toBe("Qxe5+ is a blunder");
    expect(ex.better).toBe("Bc4");
  });

  it("great = the only good move; miss = not punishing an error", () => {
    const { fens, played } = line(["e4", "e5", "Nf3", "d6"]);
    const positions = [
      pos({ cp: 20 }, "e2e4", [], { cp: -400 }), // e4 was the only good move (2nd best far worse)
      pos({ cp: 20 }, "c7c5"),
      pos({ cp: 400 }, "d2d4"), // pretend 1...e5 was a blunder: White is now winning...
      pos({ cp: 50 }, "d7d6"), // ...but 2. Nf3 lets it slip back to about equal
      pos({ cp: 50 }),
    ];
    const r = reviewMoves(["e4", "e5", "Nf3", "d6"], fens, positions, played, []);
    expect(r[0].cls).toBe("great");
    expect(r[1].cls).toBe("blunder");
    expect(r[2].cls).toBe("miss");
    const ex = explainMove(r[2], fens[2], fens[3], positions[2], positions[3], null);
    expect(ex.detail).toContain("doesn't take advantage");
    expect(ex.better).toBe("d4");
  });

  it("summaries count labels and split accuracy by phase", () => {
    const { fens, played } = line(["e4", "e5", "Nf3", "Nc6"]);
    const positions = [pos({ cp: 20 }, "e2e4"), pos({ cp: 20 }, "e7e5"), pos({ cp: 20 }, "g1f3"), pos({ cp: 20 }, "b8c6"), pos({ cp: 20 })];
    const r = reviewMoves(["e4", "e5", "Nf3", "Nc6"], fens, positions, played, [true, true, true, true]);
    const s = summarize(r, "white");
    expect(s.counts.book).toBe(2);
    expect(s.phases.opening).toBe(100);
    expect(s.phases.endgame).toBeNull();
  });
});

describe("key moments and the game story", () => {
  it("key moments include the last book move and the big moments", () => {
    const mk = (ply: number, cls: MoveClass, color: "white" | "black", winLoss = 0, winAfter = 50): ReviewedMove => ({
      ply, san: "x", uci: "a1a2", color, cls, winBefore: 50, winAfter, winLoss, accuracy: 90, phase: "opening",
    });
    const r = [mk(1, "book", "white"), mk(2, "book", "black"), mk(3, "good", "white"), mk(4, "blunder", "black", 40, 10), mk(5, "best", "white", 0, 90)];
    expect(keyMoments(r)).toEqual([2, 4]);
    expect(gameSummary(r, "1-0", { white: "Ann", black: "Bob" })).toBe(
      "It was a close game until Bob's 2… x, which decided it in Ann's favour.",
    );
    expect(gameSummary([mk(1, "good", "white"), mk(2, "good", "black")], "1/2-1/2", { white: "A", black: "B" })).toBe(
      "A balanced game that ended in a draw.",
    );
  });
});

describe("coach text", () => {
  it("explains a mate allowed and names the better move", () => {
    const { fens, played } = line(["e4", "e5", "Bc4", "Nc6", "Qh5", "Nf6", "Qxf7#"]);
    const before = pos({ cp: 30 }, "g7g6", ["g7g6", "h5f3"]);
    const after = pos({ mate: 1 }, "h5f7", ["h5f7"]);
    const r = reviewMoves(
      ["e4", "e5", "Bc4", "Nc6", "Qh5", "Nf6", "Qxf7#"],
      fens,
      [pos({ cp: 20 }, "e2e4"), pos({ cp: 20 }, "e7e5"), pos({ cp: 20 }, "f1c4"), pos({ cp: 20 }, "b8c6"), pos({ cp: 20 }, "d1h5"), before, after, pos({ mate: 1 })],
      played,
    );
    const ex = explainMove(r[5], fens[5], fens[6], before, after, null);
    expect(ex.headline).toBe("Nf6 is a blunder");
    expect(ex.detail).toBe("This allows mate in 1.");
    expect(ex.better).toBe("g6");
    expect(explainMove(r[6], fens[6], fens[7], after, pos({ mate: 1 }), null).detail).toBe("Checkmate!");
  });

  it("explains material lost", () => {
    // 1. e4 d5 2. Qg4?? Bxg4: the queen just hangs.
    const { fens, played } = line(["e4", "d5", "Qg4"]);
    const before = pos({ cp: 30 }, "e4d5", ["e4d5"]);
    const after = pos({ cp: -900 }, "c8g4", ["c8g4"]);
    const r = reviewMoves(["e4", "d5", "Qg4"], fens, [pos({ cp: 20 }, "e2e4"), pos({ cp: 40 }, "d7d5"), before, after], played);
    const ex = explainMove(r[2], fens[2], fens[3], before, after, null);
    expect(ex.detail).toContain("loses the queen");
  });

  it("formats lines", () => {
    const start = new Chess().fen();
    const { san } = playLine(start, ["e2e4", "e7e5", "g1f3"]);
    expect(formatLine(start, san)).toBe("1. e4 e5 2. Nf3");
    const afterE4 = line(["e4"]).fens[1];
    expect(formatLine(afterE4, ["e5", "Nf3"])).toBe("1… e5 2. Nf3");
    expect(materialBalance(start, "white")).toBe(0);
  });
});
