import type { ReactNode } from "react";
import { cn } from "./cn";

/** A number with a label underneath, in a soft tile. */
export function Stat({ label, value, tone, className }: { label: ReactNode; value: ReactNode; tone?: "success" | "danger"; className?: string }) {
  return (
    <div className={cn("min-w-0 rounded-lg bg-secondary/60 px-3 py-2.5", className)}>
      <div
        className={cn(
          "truncate text-lg leading-tight font-bold tabular-nums",
          tone === "success" && "text-emerald-700",
          tone === "danger" && "text-red-600",
        )}
      >
        {value}
      </div>
      <div className="mt-0.5 truncate text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
