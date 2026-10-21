"use client";

import { Shuffle } from "lucide-react";
import type { TimeControl } from "@/lib/game/rules";
import { TimeControlPicker } from "@/components/chess/time-control";
import { cn } from "@/components/ui/cn";

export const COLOR_OPTIONS = [
  { id: "white", label: "White" },
  { id: "random", label: "Random" },
  { id: "black", label: "Black" },
] as const;

export type ColorChoice = (typeof COLOR_OPTIONS)[number]["id"];

/** A small swatch for the colour choice: a white or black disc, or shuffle arrows. */
function ColorSwatch({ color }: { color: ColorChoice }) {
  if (color === "random") return <Shuffle className="size-4" aria-hidden />;
  return (
    <span
      aria-hidden
      className={cn("size-4 rounded-full border", color === "white" ? "border-neutral-400 bg-white" : "border-neutral-800 bg-neutral-800")}
    />
  );
}

/** White / Random / Black. */
export function ColorPicker({ value, onChange }: { value: ColorChoice; onChange: (c: ColorChoice) => void }) {
  return (
    <fieldset>
      <legend className="text-sm font-medium">Play as</legend>
      <div className="mt-2 grid grid-cols-3 gap-1.5">
        {COLOR_OPTIONS.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onChange(c.id)}
            aria-pressed={value === c.id}
            className={cn(
              "flex h-10 items-center justify-center gap-2 rounded-lg border text-sm font-medium transition-colors",
              value === c.id ? "border-primary bg-primary/10 text-foreground ring-1 ring-primary" : "border-border bg-card hover:bg-secondary",
            )}
          >
            <ColorSwatch color={c.id} />
            {c.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

/** Time control + colour pickers shared by "New game" and friend challenges. */
export function GameOptions({
  timeControl,
  timeControls,
  color,
  onTimeControl,
  onColor,
}: {
  timeControl: string;
  /** Which time controls to offer (all of them by default). */
  timeControls?: TimeControl[];
  color: ColorChoice;
  onTimeControl: (id: string) => void;
  onColor: (c: ColorChoice) => void;
}) {
  return (
    <div className="space-y-5">
      <TimeControlPicker value={timeControl} onChange={onTimeControl} options={timeControls} />
      <ColorPicker value={color} onChange={onColor} />
    </div>
  );
}
