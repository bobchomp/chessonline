import { Chess, type Move, type PieceSymbol } from "chess.js";

/** The beginner bots: cheap, hand-written move pickers (no engine). */

export type BotMove = { from: string; to: string; promotion?: string };

const VALUE: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const MATE = 1000;

type Rand = () => number;

function pick<T>(items: T[], rand: Rand): T {
  return items[Math.floor(rand() * items.length)];
}

function toBotMove(m: Move): BotMove {
  return { from: m.from, to: m.to, promotion: m.promotion };
}

function gain(m: Move): number {
  return (m.captured ? VALUE[m.captured] : 0) + (m.promotion ? VALUE[m.promotion] - 1 : 0);
}

/** Randy: any legal move. */
export function randomMove(fen: string, rand: Rand = Math.random): BotMove | null {
  const moves = new Chess(fen).moves({ verbose: true });
  return moves.length ? toBotMove(pick(moves, rand)) : null;
}

/** Greta: mates if she can, otherwise takes the most valuable thing on offer, otherwise random. */
export function greedyMove(fen: string, rand: Rand = Math.random): BotMove | null {
  const chess = new Chess(fen);
  const moves = chess.moves({ verbose: true });
  if (!moves.length) return null;
  const mate = moves.find((m) => m.san.endsWith("#"));
  if (mate) return toBotMove(mate);
  const best = Math.max(...moves.map(gain));
  return toBotMove(pick(moves.filter((m) => gain(m) === best), rand));
}

/** Material balance from the point of view of `color`. */
function material(chess: Chess, color: "w" | "b"): number {
  let score = 0;
  for (const row of chess.board()) {
    for (const sq of row) if (sq) score += sq.color === color ? VALUE[sq.type] : -VALUE[sq.type];
  }
  return score;
}

/**
 * Leo: looks two plies deep (his move, then your best reply) on material, so he
 * stops hanging pieces and spots one-move mates, with a little noise to vary play.
 */
export function lookaheadMove(fen: string, rand: Rand = Math.random): BotMove | null {
  const chess = new Chess(fen);
  const me = chess.turn();
  const moves = chess.moves({ verbose: true });
  if (!moves.length) return null;

  let bestScore = -Infinity;
  let best: Move[] = [];
  for (const m of moves) {
    chess.move(m);
    let score: number;
    if (chess.isCheckmate()) score = MATE;
    else if (chess.isDraw()) score = 0;
    else {
      // Opponent picks the reply that's worst for us.
      score = Infinity;
      for (const reply of chess.moves({ verbose: true })) {
        chess.move(reply);
        const s = chess.isCheckmate() ? -MATE : chess.isDraw() ? 0 : material(chess, me);
        chess.undo();
        if (s < score) score = s;
      }
    }
    chess.undo();
    score += rand() * 0.5; // small noise so equal moves vary between games
    if (score > bestScore + 1e-9) {
      bestScore = score;
      best = [m];
    } else if (Math.abs(score - bestScore) < 1e-9) best.push(m);
  }
  return toBotMove(pick(best, rand));
}
