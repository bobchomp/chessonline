import { describe, expect, it } from "vitest";
import { pickFairColor } from "./colors";

const W = "white" as const, B = "black" as const;

describe("pickFairColor", () => {
  it("is a 50/50 flip for a new player", () => {
    expect(pickFairColor([], null, 0.49)).toBe(W);
    expect(pickFairColor([], null, 0.51)).toBe(B);
  });

  it("never gives the same color three times in a row", () => {
    for (const roll of [0, 0.5, 0.99]) {
      expect(pickFairColor([W, W], null, roll)).toBe(B);
      expect(pickFairColor([B, B, W], null, roll)).toBe(W);
    }
  });

  it("leans towards the color the player has had less of", () => {
    const mostlyBlack = [W, B, B, W, B, B, W, B, B, B]; // 7 black, 3 white
    expect(pickFairColor(mostlyBlack, null, 0.6)).toBe(W);
    expect(pickFairColor(mostlyBlack, null, 0.7)).toBe(B);
    // Still random without a streak: a mostly-white player can get white again.
    expect(pickFairColor([W, B, W, W, B, W, W, B, W, W], null, 0.1)).toBe(W);
    expect(pickFairColor([W, B, W, W, B, W, W, B, W, W], null, 0.5)).toBe(B);
  });

  it("over many games, colors come out even with no long streaks", () => {
    let history: ("white" | "black")[] = [];
    let whites = 0, longest = 0, run = 0;
    let seed = 42;
    const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    for (let i = 0; i < 2000; i++) {
      const c = pickFairColor(history, null, rand());
      run = history[0] === c ? run + 1 : 1;
      longest = Math.max(longest, run);
      if (c === W) whites++;
      history = [c, ...history].slice(0, 10);
    }
    expect(longest).toBeLessThanOrEqual(2);
    expect(Math.abs(whites - 1000)).toBeLessThan(60);
  });

  it("challenges consider both players", () => {
    // Opponent just had black twice -> they should get white, so creator gets black.
    expect(pickFairColor([W, B], [B, B], 0)).toBe(B);
    // Both on a white streak: creator's streak breaks first.
    expect(pickFairColor([W, W], [W, W], 0)).toBe(B);
    // Creator mostly black, opponent mostly white -> creator leans white.
    expect(pickFairColor([B, W, B, B], [W, B, W, W], 0.6)).toBe(W);
    expect(pickFairColor([B, W, B, B], [W, B, W, W], 0.7)).toBe(B);
  });
});
