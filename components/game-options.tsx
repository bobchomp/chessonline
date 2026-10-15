"use client";

import { TIME_CONTROLS, type TimeControl } from "@/lib/game/rules";

export const COLOR_OPTIONS = [
  { id: "white", label: "White", icon: "♔" },
  { id: "random", label: "Random", icon: "?" },
  { id: "black", label: "Black", icon: "♚" },
] as const;

export type ColorChoice = (typeof COLOR_OPTIONS)[number]["id"];

/** "10 + 0 (Rapid)" -> { main: "10+0", kind: "Rapid" }; "Untimed" -> { main: "∞", kind: "Untimed" }. */
function splitLabel(label: string) {
  const m = label.match(/^(.*?)\s*\((.*)\)$/);
  return m ? { main: m[1].replace(/\s*\+\s*/g, "+"), kind: m[2] } : { main: "∞", kind: label };
}

/** The grid of time-control buttons ("10+0 / Rapid"). */
export function TimeControlPicker({
  value,
  onChange,
  options = TIME_CONTROLS,
}: {
  value: string;
  onChange: (id: string) => void;
  options?: TimeControl[];
}) {
  return (
    <>
      <div className="mt-4 text-sm font-medium text-muted-foreground">Time control</div>
      <div className="mt-2 grid grid-cols-5 gap-1.5">
        {options.map((tc) => {
          const { main, kind } = splitLabel(tc.label);
          return (
            <button
              key={tc.id}
              type="button"
              onClick={() => onChange(tc.id)}
              aria-pressed={value === tc.id}
              aria-label={tc.label}
              className={`flex min-w-0 flex-col items-center rounded-md border px-0.5 py-1.5 transition ${
                value === tc.id ? "border-primary bg-primary/15" : "border-border hover:bg-secondary"
              }`}
            >
              <span className="text-sm font-semibold tabular-nums">{main}</span>
              <span className="text-[10px] leading-tight text-muted-foreground sm:text-[11px]">{kind}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}

/** Time control + color pickers shared by "New game" and friend challenges. */
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
    <>
      <TimeControlPicker value={timeControl} onChange={onTimeControl} options={timeControls} />

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

    </>
  );
}
