import { describe, expect, it } from "vitest";
import { DEFAULT_RATING, decayRd, isProvisional, rate, type Glicko } from "./glicko2";

describe("glicko-2", () => {
  it("matches the worked example in Glickman's paper (one game at a time)", () => {
    // Paper example: 1500/200/0.06 plays 1400/30 (win), 1550/100 (loss), 1700/300 (loss)
    // in one period and ends at 1464.06 / 151.52. Rating them one by one lands close by.
    let p: Glicko = { rating: 1500, rd: 200, vol: 0.06 };
    p = rate(p, { rating: 1400, rd: 30, vol: 0.06 }, 1);
    p = rate(p, { rating: 1550, rd: 100, vol: 0.06 }, 0);
    p = rate(p, { rating: 1700, rd: 300, vol: 0.06 }, 0);
    expect(p.rating).toBeGreaterThan(1440);
    expect(p.rating).toBeLessThan(1480);
    expect(p.rd).toBeLessThan(200);
  });

  it("single game against the paper's 1400/30 opponent", () => {
    const p = rate({ rating: 1500, rd: 200, vol: 0.06 }, { rating: 1400, rd: 30, vol: 0.06 }, 1);
    expect(p.rating).toBeCloseTo(1563.6, 0);
    expect(p.rd).toBeCloseTo(175.4, 0);
  });

  it("matches an independent implementation of the paper's formulas exactly", () => {
    // Reference values from a separate implementation written straight from Glickman's paper.
    const cases: [Glicko, Glicko, number, [number, number, number]][] = [
      [{ rating: 1500, rd: 200, vol: 0.06 }, { rating: 1400, rd: 30, vol: 0.06 }, 1, [1563.564, 175.403, 0.059997]],
      [{ rating: 900, rd: 120, vol: 0.06 }, { rating: 1800, rd: 60, vol: 0.06 }, 0.5, [940.406, 120.282, 0.060007]],
      [{ rating: 1600, rd: 80, vol: 0.07 }, { rating: 1650, rd: 90, vol: 0.06 }, 0, [1585.103, 78.999, 0.069997]],
      [{ rating: 300, rd: 250, vol: 0.06 }, { rating: 3200, rd: 60, vol: 0.06 }, 1, [654.043, 250.217, 0.060029]],
    ];
    for (const [p, o, score, [r, rd, vol]] of cases) {
      const out = rate(p, o, score);
      expect(out.rating).toBeCloseTo(r, 2);
      expect(out.rd).toBeCloseTo(rd, 2);
      expect(out.vol).toBeCloseTo(vol, 5);
    }
  });

  it("everyone starts at 250, and first games move about 80 points", () => {
    expect(DEFAULT_RATING).toEqual({ rating: 250, rd: 200, vol: 0.06 });
    const win = rate(DEFAULT_RATING, DEFAULT_RATING, 1);
    const loss = rate(DEFAULT_RATING, DEFAULT_RATING, 0);
    expect(Math.round(win.rating - 250)).toBe(79);
    expect(Math.round(250 - loss.rating)).toBe(79);
    // Losing your first game to Randy (250, fixed rating) doesn't put you on the floor.
    expect(rate(DEFAULT_RATING, { rating: 250, rd: 60, vol: 0.06 }, 0).rating).toBeGreaterThan(150);
  });

  it("new players move a lot, established players a little", () => {
    const fresh = rate(DEFAULT_RATING, DEFAULT_RATING, 1);
    const settled = rate({ rating: 1500, rd: 60, vol: 0.06 }, { rating: 1500, rd: 60, vol: 0.06 }, 1);
    expect(fresh.rating - DEFAULT_RATING.rating).toBeGreaterThan(60);
    expect(settled.rating - 1500).toBeLessThan(15);
    expect(settled.rating).toBeGreaterThan(1500);
  });

  it("is zero-sum-ish between equal players, and draws between equals change nothing", () => {
    const a = { rating: 1600, rd: 80, vol: 0.06 };
    const b = { rating: 1600, rd: 80, vol: 0.06 };
    const aWin = rate(a, b, 1), bLoss = rate(b, a, 0);
    expect(aWin.rating - 1600).toBeCloseTo(1600 - bLoss.rating, 5);
    expect(rate(a, b, 0.5).rating).toBeCloseTo(1600, 5);
  });

  it("beating a much weaker player gains almost nothing; losing to them costs a lot", () => {
    const me = { rating: 1500, rd: 80, vol: 0.06 };
    const weak = { rating: 800, rd: 60, vol: 0.06 };
    expect(rate(me, weak, 1).rating - 1500).toBeLessThan(2);
    expect(1500 - rate(me, weak, 0).rating).toBeGreaterThan(20);
  });

  it("uncertainty shrinks with games and grows back with time away", () => {
    let p: Glicko = DEFAULT_RATING;
    for (let i = 0; i < 12; i++) p = rate(p, { rating: p.rating, rd: 80, vol: 0.06 }, i % 2);
    expect(isProvisional(DEFAULT_RATING.rd)).toBe(true);
    expect(isProvisional(p.rd)).toBe(false);
    expect(decayRd(p, 0)).toBe(p.rd);
    expect(decayRd(p, 365)).toBeGreaterThan(p.rd);
    // Time away never makes you less certain than a brand-new player.
    expect(decayRd(p, 100_000)).toBe(DEFAULT_RATING.rd);
    expect(decayRd({ rating: 250, rd: 230, vol: 0.06 }, 30)).toBe(230);
  });

  it("stays within bounds", () => {
    const p = rate({ rating: 120, rd: 350, vol: 0.06 }, { rating: 3000, rd: 50, vol: 0.06 }, 0);
    expect(p.rating).toBeGreaterThanOrEqual(100);
    let q = { rating: 1500, rd: 50, vol: 0.06 };
    for (let i = 0; i < 50; i++) q = rate(q, { rating: 1500, rd: 50, vol: 0.06 }, 0.5);
    expect(q.rd).toBeGreaterThanOrEqual(45);
  });
});
