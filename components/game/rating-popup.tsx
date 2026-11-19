"use client";

import { useEffect } from "react";
import { Handshake, TrendingDown, TrendingUp, Trophy, X } from "lucide-react";
import { cn } from "@/components/ui/cn";

/** How long the pop-up stays up. */
export const RATING_POPUP_MS = 6000;

export type RatingChange = {
  outcome: "win" | "loss" | "draw";
  before: number;
  diff: number;
};

/**
 * Shown when a game you're playing ends: the rating change, then it closes
 * itself after 6 seconds. The bar along the bottom fills up as the time runs out.
 */
export function RatingPopup({ change, onClose }: { change: RatingChange; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, RATING_POPUP_MS);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const { outcome, before, diff } = change;
  const up = diff > 0;
  const down = diff < 0;
  const Icon = outcome === "win" ? Trophy : outcome === "draw" ? Handshake : down ? TrendingDown : TrendingUp;
  const title = outcome === "win" ? "You won" : outcome === "loss" ? "You lost" : "Draw";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-[2px]" onClick={onClose}>
      <div
        role="status"
        aria-live="polite"
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-xs overflow-hidden rounded-2xl border border-border bg-card text-center shadow-xl"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-2 right-2 flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <X className="size-4" aria-hidden />
        </button>
        <div className="px-6 pt-7 pb-6">
          <span
            className={cn(
              "mx-auto flex size-12 items-center justify-center rounded-full text-white",
              up ? "bg-emerald-600" : down ? "bg-red-600" : "bg-neutral-400",
            )}
          >
            <Icon className="size-6" aria-hidden />
          </span>
          <p className="mt-3 text-sm font-medium text-muted-foreground">{title}</p>
          <p
            className={cn(
              "mt-1 text-5xl font-bold tracking-tight tabular-nums",
              up ? "text-emerald-700" : down ? "text-red-600" : "text-foreground",
            )}
          >
            {up ? `+${diff}` : down ? `−${-diff}` : "±0"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Rating <span className="tabular-nums">{before}</span> → <span className="font-semibold text-foreground tabular-nums">{before + diff}</span>
          </p>
        </div>
        {/* Fills from left to right over the 6 seconds, then the pop-up closes. */}
        <div className="h-1.5 bg-secondary" aria-hidden>
          <div
            className={cn("h-full origin-left", up ? "bg-emerald-600" : down ? "bg-red-600" : "bg-neutral-400")}
            style={{ animation: `rating-popup-timer ${RATING_POPUP_MS}ms linear forwards` }}
          />
        </div>
      </div>
    </div>
  );
}
