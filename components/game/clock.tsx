"use client";

import { useEffect, useState } from "react";
import { formatClock } from "@/lib/game/format";

/**
 * Counts down locally from the last server snapshot. `receivedAt` is the
 * performance.now() timestamp when that snapshot arrived, so the client's
 * wall clock never matters.
 */
export function Clock({ ms, running, receivedAt }: { ms: number; running: boolean; receivedAt: number }) {
  const [now, setNow] = useState(() => performance.now());

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(performance.now()), 100);
    return () => clearInterval(t);
  }, [running]);

  const left = running ? ms - Math.max(0, now - receivedAt) : ms;
  const low = left < 20_000;

  return (
    <div
      suppressHydrationWarning
      className={`rounded-md px-3 py-1 font-mono text-xl tabular-nums transition ${
        running
          ? low
            ? "bg-red-500/90 text-white"
            : "bg-primary text-primary-foreground"
          : "bg-secondary text-muted-foreground"
      }`}
    >
      {formatClock(left)}
    </div>
  );
}
