import type { ReactNode } from "react";
import { cn } from "./cn";

export type BadgeTone = "neutral" | "primary" | "success" | "danger" | "warning" | "info";

const TONES: Record<BadgeTone, string> = {
  neutral: "bg-secondary text-muted-foreground",
  primary: "bg-primary/10 text-primary",
  success: "bg-emerald-50 text-emerald-700",
  danger: "bg-red-50 text-red-700",
  warning: "bg-amber-50 text-amber-800",
  info: "bg-sky-50 text-sky-700",
};

/** A small rounded label: "Your move", "Provisional", "Computer". */
export function Badge({ tone = "neutral", className, title, children }: { tone?: BadgeTone; className?: string; title?: string; children: ReactNode }) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap [&_svg]:size-3",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** A red count bubble for notification icons. */
export function CountDot({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span
      className={cn(
        "flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] leading-none font-bold text-white tabular-nums",
        className,
      )}
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}
