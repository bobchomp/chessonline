import { Chess, type Square } from "chess.js";
import { materialBalance, type PositionInfo, type ReviewedMove } from "./analysis";

/**
 * Plain-English coaching for a reviewed move, worked out from the engine's best
 * lines: mates found or missed, material won or lost, and what was better.
 */
export type Explanation = {
  /** e.g. "Nf6 is a blunder" */
  headline: string;
  /** e.g. "This allows mate in 1." */
  detail: string;
  /** The engine's preferred move instead, when the played move wasn't best. */
  better: string | null;
};

/** Plays a list of UCI moves from `fen`; stops early if one is illegal. Returns the SANs and final FEN. */
export function playLine(fen: string, uci: string[]): { san: string[]; fen: string } {
  const chess = new Chess(fen);
  const san: string[] = [];
  for (const m of uci) {
    try {
      san.push(chess.move({ from: m.slice(0, 2) as Square, to: m.slice(2, 4) as Square, promotion: m[4] }).san);
    } catch {
      break;
    }
  }
  return { san, fen: chess.fen() };
}

/** "15. Nf3 Nc6 16. Bb5" from a position and a line of SANs. */
export function formatLine(fen: string, san: string[]): string {
  const [, turn, , , , full] = fen.split(" ");
  let moveNo = Number(full) || 1;
  let white = turn === "w";
  const parts: string[] = [];
  san.forEach((s, i) => {
    if (white) parts.push(`${moveNo}. ${s}`);
    else parts.push(i === 0 ? `${moveNo}… ${s}` : s);
    if (!white) moveNo++;
    white = !white;
  });
  return parts.join(" ");
}

function describeMaterial(points: number): string {
  if (points >= 8) return "the queen";
  if (points >= 5) return "a rook";
  if (points >= 3) return "a piece";
  if (points >= 2) return "two pawns";
  return "a pawn";
}

const ARTICLE: Record<string, string> = {
  brilliant: "brilliant",
  great: "a great move",
  best: "the best move",
  excellent: "excellent",
  good: "good",
  book: "a book move",
  inaccuracy: "an inaccuracy",
  mistake: "a mistake",
  miss: "a miss",
  blunder: "a blunder",
};

/**
 * Coaching for `move`. `before`/`after` are the engine's views of the positions
 * before and after it; `fenBefore`/`fenAfter` those positions.
 */
export function explainMove(
  move: ReviewedMove,
  fenBefore: string,
  fenAfter: string,
  before: PositionInfo,
  after: PositionInfo,
  openingName: string | null,
): Explanation {
  const headline = `${move.san} is ${ARTICLE[move.cls]}`;
  const mover = move.color;
  const sign = mover === "white" ? 1 : -1;
  const better =
    move.cls !== "best" && move.cls !== "book" && before.best ? (playLine(fenBefore, [before.best]).san[0] ?? null) : null;

  // How material moves along a line, from the mover's point of view.
  const startMaterial = materialBalance(fenBefore, mover);
  const afterLine = playLine(fenAfter, after.pv.slice(0, 4));
  const playedSwing = materialBalance(afterLine.fen, mover) - startMaterial;
  const bestLine = playLine(fenBefore, before.pv.slice(0, 5));
  const bestSwing = materialBalance(bestLine.fen, mover) - startMaterial;

  const mateAfter = "mate" in after.eval ? after.eval.mate * sign : null; // >0: mover mates, <0: mover gets mated
  const mateBefore = "mate" in before.eval ? before.eval.mate * sign : null;

  let detail: string;
  if (new Chess(fenAfter).isCheckmate()) {
    detail = "Checkmate!";
  } else if (move.cls === "book") {
    detail = openingName ? `Known opening theory: ${openingName}.` : "Known opening theory.";
  } else if (move.cls === "brilliant") {
    detail = "A brilliant sacrifice: it gives up material, but it's one of the best moves on the board.";
  } else if (move.cls === "great") {
    detail = "The only good move here. Everything else was much worse.";
  } else if (mateAfter !== null && mateAfter < 0) {
    detail = `This allows mate in ${-mateAfter}.`;
  } else if (mateBefore !== null && mateBefore > 0 && (mateAfter === null || mateAfter <= 0 || mateAfter > mateBefore)) {
    detail = `You missed mate in ${mateBefore}.`;
  } else if (move.cls === "best") {
    detail = mateAfter !== null && mateAfter > 0 ? `The best move, with mate in ${mateAfter} on the way.` : "The best move.";
  } else if (move.cls === "excellent") {
    detail = "Almost as strong as the best move.";
  } else if (move.cls === "good") {
    detail = "A reasonable move, but there was something a little better.";
  } else {
    const lines: string[] = [];
    if (move.cls === "miss") lines.push("Your opponent's last move was an error, and this doesn't take advantage of it.");
    if (playedSwing <= -2) lines.push(`This loses ${describeMaterial(-playedSwing)}.`);
    if (bestSwing >= 2 && bestSwing - playedSwing >= 2 && better) {
      lines.push(`${better} would have won ${describeMaterial(bestSwing)}.`);
    } else if (!lines.length) {
      lines.push(
        move.cls === "inaccuracy" ? "This gives away part of your advantage." : "This makes your position a lot worse.",
      );
    }
    detail = lines.join(" ");
  }
  return { headline, detail, better };
}
