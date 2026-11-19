import type { CapturablePiece, SideMaterial } from "@/lib/game/material";
import { cn } from "@/components/ui/cn";

const GLYPHS: Record<"white" | "black", Record<CapturablePiece, string>> = {
  white: { p: "♙", n: "♘", b: "♗", r: "♖", q: "♕" },
  black: { p: "♟", n: "♞", b: "♝", r: "♜", q: "♛" },
};
const NAMES: Record<CapturablePiece, string> = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen" };

/**
 * The pieces a player has taken (drawn in the opponent's colour, same pieces
 * overlapping like a small stack) and "+3" when they're ahead on material.
 */
export function CapturedPieces({ material, takenColor, className }: { material: SideMaterial; takenColor: "white" | "black"; className?: string }) {
  if (material.captured.length === 0 && material.advantage === 0) return null;
  const groups: { piece: CapturablePiece; n: number }[] = [];
  for (const p of material.captured) {
    const last = groups[groups.length - 1];
    if (last?.piece === p) last.n++;
    else groups.push({ piece: p, n: 1 });
  }
  const label = [
    groups.map((g) => `${g.n} ${NAMES[g.piece]}${g.n === 1 ? "" : "s"}`).join(", "),
    material.advantage ? `up ${material.advantage}` : "",
  ]
    .filter(Boolean)
    .join(", ");
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1.5", className)} title={`Captured: ${label}`} aria-label={`Captured ${label}`}>
      <span className="flex items-center gap-1 text-[17px] leading-none text-foreground/80" aria-hidden>
        {groups.map((g) => (
          <span key={g.piece} className="flex">
            {Array.from({ length: g.n }, (_, i) => (
              <span key={i} className={i > 0 ? "-ml-1" : undefined}>
                {GLYPHS[takenColor][g.piece]}
              </span>
            ))}
          </span>
        ))}
      </span>
      {material.advantage > 0 && <span className="text-xs font-semibold text-muted-foreground tabular-nums">+{material.advantage}</span>}
    </span>
  );
}
