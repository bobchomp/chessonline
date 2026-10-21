import { cn } from "@/components/ui/cn";

export type Outcome = "win" | "loss" | "draw";

const STYLE: Record<Outcome, { letter: string; label: string; className: string }> = {
  win: { letter: "W", label: "Won", className: "bg-emerald-600 text-white" },
  loss: { letter: "L", label: "Lost", className: "bg-red-600 text-white" },
  draw: { letter: "D", label: "Draw", className: "bg-neutral-400 text-white" },
};

/** A small coloured square: W, L or D. */
export function ResultMark({ outcome, className }: { outcome: Outcome; className?: string }) {
  const s = STYLE[outcome];
  return (
    <span
      title={s.label}
      className={cn("flex size-6 shrink-0 items-center justify-center rounded-md text-xs font-bold", s.className, className)}
    >
      {s.letter}
    </span>
  );
}

/** "+16" in green, "−8" in red. */
export function RatingDelta({ delta, className }: { delta: number | null | undefined; className?: string }) {
  if (delta === null || delta === undefined) return null;
  return (
    <span className={cn("text-xs font-semibold tabular-nums", delta > 0 ? "text-emerald-700" : delta < 0 ? "text-red-600" : "text-muted-foreground", className)}>
      {delta > 0 ? `+${delta}` : delta < 0 ? `−${-delta}` : "±0"}
    </span>
  );
}

/** A rating, with a quiet "provisional" marker while it's still settling. */
export function RatingText({ rating, provisional, className }: { rating: number | null | undefined; provisional?: boolean; className?: string }) {
  if (rating === null || rating === undefined) return null;
  return (
    <span className={cn("tabular-nums", className)} title={provisional ? "Provisional: still settling after the first few games" : undefined}>
      {rating}
      {provisional && <span className="text-muted-foreground/70">?</span>}
    </span>
  );
}
