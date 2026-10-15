/**
 * Turning engine evaluations into a game review: win chances, move labels and
 * accuracy. Uses the same formulas as Lichess (lichess.org/page/accuracy).
 * Pure functions, so they're unit tested and safe to run anywhere.
 */

/** An engine evaluation from White's point of view: centipawns, or mate in N (negative = Black mates). */
export type Eval = { cp: number } | { mate: number };

export type MoveClass = "best" | "good" | "inaccuracy" | "mistake" | "blunder";

export type ReviewedMove = {
  ply: number; // 1-based
  san: string;
  color: "white" | "black";
  cls: MoveClass;
  /** How much the mover's winning chances dropped, in percentage points. */
  winLoss: number;
  /** 0-100, how close to best the move was. */
  accuracy: number;
};

export type PlayerSummary = {
  accuracy: number;
  inaccuracies: number;
  mistakes: number;
  blunders: number;
  best: number;
};

/** Win chance for White (0-100) from an evaluation. */
export function whiteWinPercent(e: Eval): number {
  if ("mate" in e) return e.mate > 0 ? 100 : e.mate < 0 ? 0 : 50;
  const cp = Math.max(-1000, Math.min(1000, e.cp));
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
}

/** How an evaluation reads to a person: "+1.4", "−0.3", "M3", "−M2". */
export function formatEval(e: Eval): string {
  if ("mate" in e) return e.mate === 0 ? "#" : e.mate > 0 ? `M${e.mate}` : `−M${-e.mate}`;
  const pawns = e.cp / 100;
  if (Math.abs(pawns) < 0.05) return "0.0";
  return pawns > 0 ? `+${pawns.toFixed(1)}` : `−${(-pawns).toFixed(1)}`;
}

/** Lichess's thresholds on the drop in winning chances. */
export function classify(winLoss: number, isBest: boolean): MoveClass {
  if (isBest || winLoss < 2) return isBest ? "best" : "good";
  if (winLoss >= 30) return "blunder";
  if (winLoss >= 20) return "mistake";
  if (winLoss >= 10) return "inaccuracy";
  return "good";
}

/** Per-move accuracy from the drop in winning chances (Lichess formula). */
export function moveAccuracy(winLoss: number): number {
  const raw = 103.1668 * Math.exp(-0.04354 * Math.max(0, winLoss)) - 3.1669;
  return Math.max(0, Math.min(100, raw));
}

/**
 * Review every move. `evals[i]` is the evaluation of the position after `i`
 * moves (so there are moves.length + 1 of them); `best[i]` is the engine's best
 * move (UCI, e.g. "e2e4") in that position, and `played[i]` the move actually
 * played from it.
 */
export function reviewMoves(moves: string[], evals: Eval[], best: (string | null)[], played: string[]): ReviewedMove[] {
  return moves.map((san, i) => {
    const color = i % 2 === 0 ? "white" : "black";
    const before = whiteWinPercent(evals[i]);
    const after = whiteWinPercent(evals[i + 1]);
    const winLoss = Math.max(0, color === "white" ? before - after : after - before);
    const isBest = !!best[i] && best[i] === played[i];
    return { ply: i + 1, san, color, cls: classify(winLoss, isBest), winLoss, accuracy: moveAccuracy(winLoss) };
  });
}

/** Overall accuracy: the average of the plain mean and the harmonic mean, which punishes big mistakes more. */
export function summarize(reviewed: ReviewedMove[], color: "white" | "black"): PlayerSummary {
  const mine = reviewed.filter((m) => m.color === color);
  const accs = mine.map((m) => m.accuracy);
  const mean = accs.length ? accs.reduce((a, b) => a + b, 0) / accs.length : 100;
  const harmonic = accs.length ? accs.length / accs.reduce((a, b) => a + 1 / Math.max(1, b), 0) : 100;
  const count = (c: MoveClass) => mine.filter((m) => m.cls === c).length;
  return {
    accuracy: Math.round(((mean + harmonic) / 2) * 10) / 10,
    inaccuracies: count("inaccuracy"),
    mistakes: count("mistake"),
    blunders: count("blunder"),
    best: count("best"),
  };
}

export const CLASS_LABELS: Record<MoveClass, { label: string; symbol: string }> = {
  best: { label: "Best move", symbol: "★" },
  good: { label: "Good", symbol: "" },
  inaccuracy: { label: "Inaccuracy", symbol: "?!" },
  mistake: { label: "Mistake", symbol: "?" },
  blunder: { label: "Blunder", symbol: "??" },
};
