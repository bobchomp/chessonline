"use client";

const PIECES = [
  { id: "q", white: "♕", black: "♛", label: "Queen" },
  { id: "r", white: "♖", black: "♜", label: "Rook" },
  { id: "b", white: "♗", black: "♝", label: "Bishop" },
  { id: "n", white: "♘", black: "♞", label: "Knight" },
] as const;

type Props = {
  color: "white" | "black";
  onPick: (piece: "q" | "r" | "b" | "n") => void;
  onCancel: () => void;
};

export function PromotionPicker({ color, onPick, onCancel }: Props) {
  return (
    <div
      className="absolute inset-0 z-20 flex items-center justify-center bg-black/25 backdrop-blur-[1px]"
      onClick={onCancel}
      role="dialog"
      aria-label="Choose a piece to promote to"
    >
      <div className="rounded-xl border border-border bg-card p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <p className="mb-3 text-center text-sm font-medium">Promote to</p>
        <div className="flex gap-2">
          {PIECES.map((p) => (
            <button
              key={p.id}
              type="button"
              title={p.label}
              aria-label={p.label}
              onClick={() => onPick(p.id)}
              className="flex h-16 w-16 items-center justify-center rounded-lg bg-[var(--board-light)] text-5xl leading-none text-black hover:ring-2 hover:ring-primary"
            >
              {p[color]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
