"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { GameOptions, type ColorChoice } from "@/components/game-options";

/** Pick a time control and color, then challenge a friend. */
export function ChallengeDialog({
  friendId,
  friendName,
  onClose,
}: {
  friendId: string;
  friendName: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [timeControl, setTimeControl] = useState("10+0");
  const [color, setColor] = useState<ColorChoice>("random");
  const [rated, setRated] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/challenges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ friendId, timeControl, color, rated }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't send the challenge.");
      router.push(`/game/${data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send the challenge.");
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="challenge-title"
        onClick={(e) => e.stopPropagation()}
        className="max-h-full w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-2xl"
      >
        <h2 id="challenge-title" className="text-xl font-semibold">
          Challenge {friendName}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">They&apos;ll get a popup to accept. Challenges expire after 10 minutes.</p>
        <GameOptions
          timeControl={timeControl}
          color={color}
          rated={rated}
          onTimeControl={setTimeControl}
          onColor={setColor}
          onRated={setRated}
        />
        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button type="button" onClick={onClose} className="rounded-lg bg-secondary py-2.5 font-medium hover:bg-accent">
            Cancel
          </button>
          <button
            type="button"
            onClick={send}
            disabled={busy}
            className="rounded-lg bg-primary py-2.5 font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            {busy ? "Sending…" : "Send challenge"}
          </button>
        </div>
      </div>
    </div>
  );
}
