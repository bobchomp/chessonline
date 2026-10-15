import { Chess, type Square } from "chess.js";

/**
 * Turning engine evaluations into a game review: win chances, move labels and
 * accuracy. Win chances and accuracy use Lichess's published formulas
 * (lichess.org/page/accuracy); the labels follow Chess.com's Game Review
 * (expected-points bands of 0.02 / 0.05 / 0.10 / 0.20, plus Book, Great,
 * Brilliant and Miss). Pure functions, unit tested.
 */

/** An engine evaluation from White's point of view: centipawns, or mate in N (negative = Black mates). */
export type Eval = { cp: number } | { mate: number };

/** What the engine said about one position. */
export type PositionInfo = {
  eval: Eval;
  /** Best move (UCI), null when the game is over. */
  best: string | null;
  /** Principal variation from this position (UCI), starting with `best`. */
  pv: string[];
  /** Evaluation of the second-best move, when there is one (for "only move" detection). */
  second: Eval | null;
};

export type MoveClass =
  | "brilliant"
  | "great"
  | "best"
  | "excellent"
  | "good"
  | "book"
  | "inaccuracy"
  | "mistake"
  | "miss"
  | "blunder";

export type Phase = "opening" | "middlegame" | "endgame";

export type ReviewedMove = {
  ply: number; // 1-based
  san: string;
  uci: string;
  color: "white" | "black";
  cls: MoveClass;
  /** Mover's winning chances before and after the move (0-100). */
  winBefore: number;
  winAfter: number;
  /** How much the mover's winning chances dropped, in percentage points. */
  winLoss: number;
  /** 0-100, how close to best the move was. */
  accuracy: number;
  phase: Phase;
};

export type PlayerSummary = {
  accuracy: number;
  counts: Record<MoveClass, number>;
  phases: Record<Phase, number | null>;
};

export const PIECE_VALUES: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

/** Win chance for White (0-100) from an evaluation. */
export function whiteWinPercent(e: Eval): number {
  if ("mate" in e) return e.mate > 0 ? 100 : e.mate < 0 ? 0 : 50;
  const cp = Math.max(-1000, Math.min(1000, e.cp));
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
}

function moverWin(e: Eval, color: "white" | "black"): number {
  const w = whiteWinPercent(e);
  return color === "white" ? w : 100 - w;
}

/** How an evaluation reads to a person: "+1.4", "−0.3", "M3", "−M2". */
export function formatEval(e: Eval): string {
  if ("mate" in e) return e.mate === 0 ? "#" : e.mate > 0 ? `M${e.mate}` : `−M${-e.mate}`;
  const pawns = e.cp / 100;
  if (Math.abs(pawns) < 0.05) return "0.0";
  return pawns > 0 ? `+${pawns.toFixed(1)}` : `−${(-pawns).toFixed(1)}`;
}

/** Label from the drop in winning chances alone (Chess.com's expected-points bands, in %). */
export function baseClass(winLoss: number, isBest: boolean): MoveClass {
  if (isBest) return "best";
  if (winLoss < 2) return "excellent";
  if (winLoss < 5) return "good";
  if (winLoss < 10) return "inaccuracy";
  if (winLoss < 20) return "mistake";
  return "blunder";
}

/** Per-move accuracy from the drop in winning chances (Lichess formula). */
export function moveAccuracy(winLoss: number): number {
  const raw = 103.1668 * Math.exp(-0.04354 * Math.max(0, winLoss)) - 3.1669;
  return Math.max(0, Math.min(100, raw));
}

/** Material on the board, not counting pawns or kings. Drives the endgame cut-off. */
function pieceMaterial(chess: Chess): number {
  let total = 0;
  for (const row of chess.board()) for (const sq of row) if (sq && sq.type !== "p") total += PIECE_VALUES[sq.type];
  return total;
}

/** Material balance from `color`'s point of view (pawns included). */
export function materialBalance(fen: string, color: "white" | "black"): number {
  const c = color === "white" ? "w" : "b";
  let total = 0;
  for (const row of new Chess(fen).board()) {
    for (const sq of row) if (sq) total += (sq.color === c ? 1 : -1) * PIECE_VALUES[sq.type];
  }
  return total;
}

/**
 * Does this move offer up material? True when a non-pawn piece lands where the
 * opponent can take it and, even after recapturing, the mover ends up at least
 * two points down. That's the "sacrifice" half of a Brilliant move.
 */
export function isSacrifice(fenBefore: string, uci: string): boolean {
  const chess = new Chess(fenBefore);
  const from = uci.slice(0, 2) as Square;
  const to = uci.slice(2, 4) as Square;
  const piece = chess.get(from);
  if (!piece || piece.type === "p" || piece.type === "k") return false;
  const captured = chess.get(to);
  const gained = captured ? PIECE_VALUES[captured.type] : 0;
  try {
    chess.move({ from, to, promotion: uci[4] });
  } catch {
    return false;
  }
  const takers = chess.moves({ verbose: true }).filter((m) => m.to === to && m.captured);
  if (takers.length === 0) return false;
  const cheapest = Math.min(...takers.map((m) => (m.piece === "k" ? 100 : PIECE_VALUES[m.piece])));
  const moverColor = piece.color;
  const defended = cheapest < 100 && chess.isAttacked(to, moverColor);
  const net = gained - PIECE_VALUES[piece.type] + (defended ? cheapest : 0);
  return net <= -2;
}

/**
 * Review every move.
 * - `fens[i]`: the position after i moves (moves.length + 1 of them)
 * - `positions[i]`: the engine's view of fens[i]
 * - `played[i]`: the move played from fens[i] (UCI)
 * - `book[i]`: whether fens[i + 1] is known opening theory
 */
export function reviewMoves(
  moves: string[],
  fens: string[],
  positions: PositionInfo[],
  played: string[],
  book: boolean[] = [],
): ReviewedMove[] {
  let lastBookPly = 0;
  const out: ReviewedMove[] = [];
  moves.forEach((san, i) => {
    const color = i % 2 === 0 ? "white" : "black";
    const before = positions[i];
    const after = positions[i + 1];
    const winBefore = moverWin(before.eval, color);
    const winAfter = moverWin(after.eval, color);
    const winLoss = Math.max(0, winBefore - winAfter);
    const isBest = !!before.best && before.best === played[i];
    let cls = baseClass(winLoss, isBest);

    const inBook = !!book[i] && i < 30 && lastBookPly === i;
    if (inBook) {
      cls = "book";
      lastBookPly = i + 1;
    } else {
      // Great: the only good move, i.e. the best move when the second choice is far worse.
      if (cls === "best" && before.second) {
        const gap = winBefore - moverWin(before.second, color);
        if (gap >= 15 && winBefore > 5 && winBefore < 95) cls = "great";
      }
      // Brilliant: a (near-)best piece sacrifice that leaves you fine, when you weren't already winning easily.
      if ((cls === "best" || cls === "great" || cls === "excellent") && winAfter >= 50 && winBefore < 90) {
        if (isSacrifice(fens[i], played[i])) cls = "brilliant";
      }
      // Miss (Chess.com's definition): the opponent just erred, you had a winning position,
      // and this move lets it slip back to equal or worse. Moves that go on to lose stay blunders.
      const prev = out[i - 1];
      if (
        prev &&
        (prev.cls === "mistake" || prev.cls === "blunder") &&
        (cls === "inaccuracy" || cls === "mistake" || cls === "blunder") &&
        winBefore >= 65 &&
        winAfter < 60 &&
        winAfter >= 35
      ) {
        cls = "miss";
      }
    }

    const chess = new Chess(fens[i + 1]);
    const phase: Phase =
      pieceMaterial(chess) <= 26 ? "endgame" : i + 1 <= Math.max(16, lastBookPly) ? "opening" : "middlegame";

    out.push({
      ply: i + 1,
      san,
      uci: played[i],
      color,
      cls,
      winBefore,
      winAfter,
      winLoss,
      accuracy: inBook ? 100 : moveAccuracy(winLoss),
      phase,
    });
  });
  return out;
}

function aggregate(accs: number[]): number | null {
  if (!accs.length) return null;
  const mean = accs.reduce((a, b) => a + b, 0) / accs.length;
  const harmonic = accs.length / accs.reduce((a, b) => a + 1 / Math.max(1, b), 0);
  return Math.round(((mean + harmonic) / 2) * 10) / 10;
}

export const ALL_CLASSES: MoveClass[] = [
  "brilliant",
  "great",
  "best",
  "excellent",
  "good",
  "book",
  "inaccuracy",
  "mistake",
  "miss",
  "blunder",
];

/** Overall and per-phase accuracy (average of the plain and harmonic means), plus label counts. */
export function summarize(reviewed: ReviewedMove[], color: "white" | "black"): PlayerSummary {
  const mine = reviewed.filter((m) => m.color === color);
  const counts = Object.fromEntries(ALL_CLASSES.map((c) => [c, 0])) as Record<MoveClass, number>;
  for (const m of mine) counts[m.cls]++;
  const phaseAcc = (p: Phase) => aggregate(mine.filter((m) => m.phase === p).map((m) => m.accuracy));
  return {
    accuracy: aggregate(mine.map((m) => m.accuracy)) ?? 100,
    counts,
    phases: { opening: phaseAcc("opening"), middlegame: phaseAcc("middlegame"), endgame: phaseAcc("endgame") },
  };
}

/**
 * Moves worth jumping to: the last book move (where the opening is introduced, as on
 * Chess.com), the big errors and the standout good moves.
 */
export function keyMoments(reviewed: ReviewedMove[]): number[] {
  const lastBook = reviewed.findLastIndex((m) => m.cls === "book");
  return reviewed
    .filter((m, i) => i === lastBook || ["brilliant", "great", "miss", "mistake", "blunder"].includes(m.cls))
    .map((m) => m.ply);
}

/** A one-line story of the game, like the coach's summary on Chess.com's highlights screen. */
export function gameSummary(
  reviewed: ReviewedMove[],
  result: "1-0" | "0-1" | "1/2-1/2" | null,
  names: { white: string; black: string },
): string {
  if (!reviewed.length) return "";
  const name = (c: "white" | "black") => (c === "white" ? names.white : names.black);
  const moveName = (m: ReviewedMove) => `${Math.ceil(m.ply / 2)}${m.color === "white" ? "." : "…"} ${m.san}`;
  const worst = [...reviewed].sort((a, b) => b.winLoss - a.winLoss)[0];
  const decisive = worst && worst.winLoss >= 20 ? worst : null;
  // White's winning chances after each move, to see who was in charge.
  const whiteWin = reviewed.map((m) => (m.color === "white" ? m.winAfter : 100 - m.winAfter));
  const half = Math.floor(whiteWin.length / 2);
  const early = whiteWin.slice(0, Math.max(1, half));
  const avgEarly = early.reduce((a, b) => a + b, 0) / early.length;

  if (result === "1/2-1/2") {
    return decisive
      ? `A draw, though ${moveName(decisive)} by ${name(decisive.color)} gave the other side real chances.`
      : "A balanced game that ended in a draw.";
  }
  if (!result) return "";
  const winner = result === "1-0" ? "white" : "black";
  const loser = winner === "white" ? "black" : "white";
  const winnerAheadEarly = winner === "white" ? avgEarly > 60 : avgEarly < 40;
  if (decisive && decisive.color === loser) {
    return winnerAheadEarly
      ? `${name(winner)} was in control, and ${name(loser)}'s ${moveName(decisive)} sealed it.`
      : `It was a close game until ${name(loser)}'s ${moveName(decisive)}, which decided it in ${name(winner)}'s favour.`;
  }
  if (decisive && decisive.color === winner) {
    return `${name(winner)} won despite ${moveName(decisive)}, a big chance for ${name(loser)} that went begging.`;
  }
  return winnerAheadEarly
    ? `${name(winner)} took control early and never let go.`
    : `A tight game that ${name(winner)} edged at the end.`;
}

export const CLASS_INFO: Record<MoveClass, { label: string; symbol: string; color: string }> = {
  brilliant: { label: "Brilliant", symbol: "!!", color: "#0d9488" },
  great: { label: "Great move", symbol: "!", color: "#2563eb" },
  best: { label: "Best move", symbol: "★", color: "#16a34a" },
  excellent: { label: "Excellent", symbol: "👍", color: "#65a30d" },
  good: { label: "Good", symbol: "✓", color: "#71717a" },
  book: { label: "Book", symbol: "📖", color: "#a16207" },
  inaccuracy: { label: "Inaccuracy", symbol: "?!", color: "#d97706" },
  mistake: { label: "Mistake", symbol: "?", color: "#ea580c" },
  miss: { label: "Miss", symbol: "✗", color: "#db2777" },
  blunder: { label: "Blunder", symbol: "??", color: "#dc2626" },
};
