import { describe, expect, it } from "vitest";
import { classify, formatEval, moveAccuracy, reviewMoves, summarize, whiteWinPercent, type Eval } from "./analysis";

describe("review analysis", () => {
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
    expect(formatEval({ cp: 2 })).toBe("0.0");
    expect(formatEval({ mate: 2 })).toBe("M2");
    expect(formatEval({ mate: -4 })).toBe("−M4");
  });

  it("classifies by the drop in winning chances", () => {
    expect(classify(0, true)).toBe("best");
    expect(classify(5, false)).toBe("good");
    expect(classify(12, false)).toBe("inaccuracy");
    expect(classify(25, false)).toBe("mistake");
    expect(classify(45, false)).toBe("blunder");
  });

  it("accuracy is ~100 for no loss and falls with bigger losses", () => {
    expect(moveAccuracy(0)).toBeGreaterThan(99.9);
    expect(moveAccuracy(10)).toBeLessThan(moveAccuracy(5));
    expect(moveAccuracy(80)).toBeLessThan(5);
  });

  it("reviews moves from both sides' point of view", () => {
    // 1. e4 (best, even) 1... Qh4 (Black blunders a queen-ish swing) 2. Qh5 (White misses it, mistake-sized)
    const evals: Eval[] = [{ cp: 20 }, { cp: 25 }, { cp: 600 }, { cp: 200 }];
    const best = ["e2e4", "e7e5", "g2g3", null];
    const played = ["e2e4", "d8h4", "d1h5"];
    const r = reviewMoves(["e4", "Qh4", "Qh5"], evals, best, played);
    expect(r.map((m) => m.cls)).toEqual(["best", "blunder", "mistake"]);
    expect(r[1].color).toBe("black");
    const white = summarize(r, "white"), black = summarize(r, "black");
    expect(white).toMatchObject({ mistakes: 1, best: 1, blunders: 0 });
    expect(black).toMatchObject({ blunders: 1 });
    expect(white.accuracy).toBeGreaterThan(black.accuracy);
  });

  it("a perfect game scores 100", () => {
    const evals: Eval[] = [{ cp: 20 }, { cp: 20 }, { cp: 20 }];
    const r = reviewMoves(["e4", "e5"], evals, ["e2e4", "e7e5"], ["e2e4", "e7e5"]);
    expect(summarize(r, "white").accuracy).toBeGreaterThan(99.9);
  });
});
