"use client";

import { TIME_CONTROLS } from "@/lib/game/rules";

export const COLOR_OPTIONS = [
  { id: "white", label: "White", icon: "♔" },
  { id: "random", label: "Random", icon: "?" },
  { id: "black", label: "Black", icon: "♚" },
] as const;

export type ColorChoice = (typeof COLOR_OPTIONS)[number]["id"];

/** Time control + color pickers shared by "New game" and friend challenges. */
export function GameOptions({
  timeControl,
  color,
  onTimeControl,
  onColor,
}: {
  timeControl: string;
  color: ColorChoice;
  onTimeControl: (id: string) => void;
  onColor: (c: ColorChoice) => void;
}) {
  return (
    <>
      <div className="mt-4 text-sm font-medium text-muted-foreground">Time control</div>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {TIME_CONTROLS.map((tc) => (
          <button
            key={tc.id}
            type="button"
            onClick={() => onTimeControl(tc.id)}
            aria-pressed={timeControl === tc.id}
            className={`rounded-md border px-2 py-2 text-sm transition ${
              timeControl === tc.id ? "border-primary bg-primary/15 text-foreground" : "border-border hover:bg-secondary"
            }`}
          >
            {tc.label}
          </button>
        ))}
      </div>

      <div className="mt-4 text-sm font-medium text-muted-foreground">Play as</div>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {COLOR_OPTIONS.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onColor(c.id)}
            aria-pressed={color === c.id}
            className={`flex flex-col items-center rounded-md border py-2 text-sm transition ${
              color === c.id ? "border-primary bg-primary/15" : "border-border hover:bg-secondary"
            }`}
          >
            <span className="text-2xl leading-none">{c.icon}</span>
            {c.label}
          </button>
        ))}
      </div>
    </>
  );
}
