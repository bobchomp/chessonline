/**
 * Captured pieces and the material balance for a position, worked out from the
 * board alone (what's missing from each side's starting set), so it's right for
 * any position, including when stepping back through a game.
 */

export type CapturablePiece = "p" | "n" | "b" | "r" | "q";

/** Usual piece values: pawn 1, knight and bishop 3, rook 5, queen 9. */
export const PIECE_POINTS: Record<CapturablePiece, number> = { p: 1, n: 3, b: 3, r: 5, q: 9 };
const START: Record<CapturablePiece, number> = { p: 8, n: 2, b: 2, r: 2, q: 1 };
/** Display order: pawns first, then up to the queen. */
export const CAPTURE_ORDER: CapturablePiece[] = ["p", "n", "b", "r", "q"];

export type SideMaterial = {
  /** Opponent pieces this side has taken, in display order (e.g. ["p", "p", "n"]). */
  captured: CapturablePiece[];
  /** How many points this side is ahead by (0 if level or behind). */
  advantage: number;
};

export function materialFromFen(fen: string): { white: SideMaterial; black: SideMaterial } {
  const count = { w: { p: 0, n: 0, b: 0, r: 0, q: 0 }, b: { p: 0, n: 0, b: 0, r: 0, q: 0 } };
  for (const ch of fen.split(" ")[0]) {
    const lower = ch.toLowerCase() as CapturablePiece;
    if (!(lower in START)) continue;
    count[ch === lower ? "b" : "w"][lower]++;
  }

  // A promoted pawn shows up as an extra queen (say) and a missing pawn. Count it as
  // the piece it became, so it isn't also listed as a captured pawn.
  const missing = (side: "w" | "b") => {
    const have = { ...count[side] };
    for (const piece of ["q", "r", "b", "n"] as const) {
      const extra = have[piece] - START[piece];
      if (extra > 0) {
        have[piece] -= extra;
        have.p += extra;
      }
    }
    const out: CapturablePiece[] = [];
    for (const piece of CAPTURE_ORDER) for (let i = have[piece]; i < START[piece]; i++) out.push(piece);
    return out;
  };

  const points = (side: "w" | "b") => CAPTURE_ORDER.reduce((sum, p) => sum + count[side][p] * PIECE_POINTS[p], 0);
  const diff = points("w") - points("b");
  return {
    white: { captured: missing("b"), advantage: Math.max(0, diff) },
    black: { captured: missing("w"), advantage: Math.max(0, -diff) },
  };
}
