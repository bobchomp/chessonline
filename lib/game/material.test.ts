import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import { materialFromFen } from "./material";

function after(sans: string[]) {
  const c = new Chess();
  for (const s of sans) c.move(s);
  return c.fen();
}

describe("captured material", () => {
  it("is empty and level at the start", () => {
    expect(materialFromFen(new Chess().fen())).toEqual({
      white: { captured: [], advantage: 0 },
      black: { captured: [], advantage: 0 },
    });
  });

  it("lists what each side has taken and who is ahead", () => {
    // 1. e4 d5 2. exd5 Qxd5 3. Nc3 Qxa2?? 4. Rxa2: White has taken a pawn and the queen (10), Black two pawns (2).
    const m = materialFromFen(after(["e4", "d5", "exd5", "Qxd5", "Nc3", "Qxa2", "Rxa2"]));
    expect(m.white).toEqual({ captured: ["p", "q"], advantage: 8 });
    expect(m.black).toEqual({ captured: ["p", "p"], advantage: 0 });
  });

  it("counts a promoted pawn as its new piece, not a capture", () => {
    // White has two queens (one promoted) and seven pawns; nothing was captured from Black.
    const m = materialFromFen("4k3/8/8/8/8/8/PPPPPPP1/Q3K2Q w - - 0 1");
    expect(m.black.captured).toEqual(["n", "n", "b", "b", "r", "r"]);
    expect(m.white.captured).toEqual(["p", "p", "p", "p", "p", "p", "p", "p", "n", "n", "b", "b", "r", "r", "q"]);
    expect(m.white.advantage).toBe(25);
  });
});
