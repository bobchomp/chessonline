"use client";

import { Chessboard } from "react-chessboard";

// A position from the Italian Game, with the engine's idea drawn as an arrow.
const FEN = "r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2P2N2/PP1P1PPP/RNBQK2R w KQkq - 3 5";

/** A static board for the home page. */
export function HeroBoard() {
  return (
    <div className="overflow-hidden rounded-xl shadow-xl ring-1 ring-black/5">
      <Chessboard
        options={{
          id: "hero",
          position: FEN,
          allowDragging: false,
          showNotation: false,
          arrows: [{ startSquare: "d2", endSquare: "d4", color: "rgba(21, 128, 61, 0.8)" }],
          lightSquareStyle: { backgroundColor: "var(--board-light)" },
          darkSquareStyle: { backgroundColor: "var(--board-dark)" },
        }}
      />
    </div>
  );
}
