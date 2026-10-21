"use client";

import { TIME_CONTROLS, type TimeControl } from "@/lib/game/rules";
import { cn } from "@/components/ui/cn";
import { SpeedIcon, shortLabel, speedOf, type Speed } from "./speed";

export { SPEED_ICON, SpeedIcon, shortLabel, speedFor, speedOf, type Speed } from "./speed";

/**
 * Time controls grouped by speed, one row per speed:
 *   ⚡ Bullet     [1+0]
 *   🔥 Blitz      [3+0] [3+2] [5+0] [5+3]
 */
export function TimeControlPicker({
  value,
  onChange,
  options = TIME_CONTROLS,
}: {
  value: string;
  onChange: (id: string) => void;
  options?: TimeControl[];
}) {
  const groups: { speed: Speed; items: TimeControl[] }[] = [];
  for (const tc of options) {
    const speed = speedOf(tc);
    const g = groups.find((x) => x.speed === speed);
    if (g) g.items.push(tc);
    else groups.push({ speed, items: [tc] });
  }
  return (
    <fieldset>
      <legend className="text-sm font-medium">Time control</legend>
      <div className="mt-2 space-y-2">
        {groups.map(({ speed, items }) => (
          <div key={speed} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 sm:flex-nowrap">
            <div className="flex w-full items-center gap-1.5 text-xs font-medium text-muted-foreground sm:w-24 sm:shrink-0">
              <SpeedIcon speed={speed} className="size-3.5" />
              {speed}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {items.map((tc) => (
                <button
                  key={tc.id}
                  type="button"
                  onClick={() => onChange(tc.id)}
                  aria-pressed={value === tc.id}
                  aria-label={tc.label}
                  className={cn(
                    "h-9 min-w-16 rounded-lg border px-3 text-sm font-semibold tabular-nums transition-colors",
                    value === tc.id
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card hover:border-primary/40 hover:bg-secondary",
                  )}
                >
                  {shortLabel(tc)}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </fieldset>
  );
}
