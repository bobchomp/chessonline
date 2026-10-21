import { CalendarDays, Flame, Hourglass, Infinity as InfinityIcon, Timer, Zap, type LucideIcon } from "lucide-react";
import { TIME_CONTROLS, type TimeControl } from "@/lib/game/rules";
import { cn } from "@/components/ui/cn";

export type Speed = "Untimed" | "Bullet" | "Blitz" | "Rapid" | "Classical" | "Daily";

export const SPEED_ICON: Record<Speed, LucideIcon> = {
  Untimed: InfinityIcon,
  Bullet: Zap,
  Blitz: Flame,
  Rapid: Timer,
  Classical: Hourglass,
  Daily: CalendarDays,
};

/** "10 + 0 (Rapid)" → Rapid. */
export function speedOf(tc: Pick<TimeControl, "label">): Speed {
  return (tc.label.match(/\((.*)\)$/)?.[1] as Speed | undefined) ?? "Untimed";
}

/** The speed for a game's clock settings. */
export function speedFor(initialMs: number | null, incrementMs: number): Speed {
  const tc = TIME_CONTROLS.find((t) => t.initialMs === initialMs && t.incrementMs === incrementMs);
  if (tc) return speedOf(tc);
  if (initialMs === null) return "Untimed";
  const est = initialMs + 40 * incrementMs; // Lichess's estimate of a game's length
  if (initialMs >= 86_400_000) return "Daily";
  if (est < 3 * 60_000) return "Bullet";
  if (est < 8 * 60_000) return "Blitz";
  if (est < 25 * 60_000) return "Rapid";
  return "Classical";
}

/** "10+0", "3 days", "∞". */
export function shortLabel(tc: Pick<TimeControl, "label">): string {
  const main = tc.label.replace(/\s*\(.*\)$/, "");
  if (main === "Untimed") return "No clock";
  return main.replace(/\s*\+\s*/g, "+");
}

export function SpeedIcon({ speed, className }: { speed: Speed; className?: string }) {
  const Icon = SPEED_ICON[speed];
  return <Icon className={cn("size-4 shrink-0", className)} aria-hidden />;
}
