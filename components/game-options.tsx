"use client";

import { TIME_CONTROLS } from "@/lib/game/rules";

export const COLOR_OPTIONS = [
  { id: "white", label: "White", icon: "♔" },
  { id: "random", label: "Random", icon: "?" },
  { id: "black", label: "Black", icon: "♚" },
] as const;

export type ColorChoice = (typeof COLOR_OPTIONS)[number]["id"];

/** "10 + 0 (Rapid)" -> { main: "10+0", kind: "Rapid" }; "Untimed" -> { main: "∞", kind: "Untimed" }. */
function splitLabel(label: string) {
  const m = label.match(/^(.*?)\s*\((.*)\)$/);
  return m ? { main: m[1].replace(/\s+/g, ""), kind: m[2] } : { main: "∞", kind: label };
}

/** Time control + color pickers shared by "New game" and friend challenges. */
export function GameOptions({
  timeControl,
  color,
  rated,
  onTimeControl,
  onColor,
  onRated,
}: {
  timeControl: string;
  color: ColorChoice;
  rated: boolean;
  onTimeControl: (id: string) => void;
  onColor: (c: ColorChoice) => void;
  onRated: (rated: boolean) => void;
}) {
  return (
    <>
      <div className="mt-4 text-sm font-medium text-muted-foreground">Time control</div>
      <div className="mt-2 grid grid-cols-5 gap-1.5">
        {TIME_CONTROLS.map((tc) => {
          const { main, kind } = splitLabel(tc.label);
          return (
            <button
              key={tc.id}
              type="button"
              onClick={() => onTimeControl(tc.id)}
              aria-pressed={timeControl === tc.id}
              aria-label={tc.label}
              className={`flex min-w-0 flex-col items-center rounded-md border px-0.5 py-1.5 transition ${
                timeControl === tc.id ? "border-primary bg-primary/15" : "border-border hover:bg-secondary"
              }`}
            >
              <span className="text-sm font-semibold tabular-nums">{main}</span>
              <span className="text-[10px] leading-tight text-muted-foreground sm:text-[11px]">{kind}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-4 text-sm font-medium text-muted-foreground">Play as</div>
      <div className="mt-2 grid grid-cols-3 gap-1.5">
        {COLOR_OPTIONS.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onColor(c.id)}
            aria-pressed={color === c.id}
            className={`flex items-center justify-center gap-2 rounded-md border py-2 text-sm transition ${
              color === c.id ? "border-primary bg-primary/15" : "border-border hover:bg-secondary"
            }`}
          >
            <span className="text-xl leading-none">{c.icon}</span>
            {c.label}
          </button>
        ))}
      </div>

      <div className="mt-4 text-sm font-medium text-muted-foreground">Game type</div>
      <div className="mt-2 grid grid-cols-2 gap-1.5">
        {[
          { value: true, label: "Rated", hint: "Counts towards your rating" },
          { value: false, label: "Casual", hint: "Just for fun" },
        ].map((o) => (
          <button
            key={o.label}
            type="button"
            onClick={() => onRated(o.value)}
            aria-pressed={rated === o.value}
            className={`flex flex-col items-center rounded-md border px-2 py-1.5 transition ${
              rated === o.value ? "border-primary bg-primary/15" : "border-border hover:bg-secondary"
            }`}
          >
            <span className="text-sm font-medium">{o.label}</span>
            <span className="text-[11px] leading-tight text-muted-foreground">{o.hint}</span>
          </button>
        ))}
      </div>
    </>
  );
}
