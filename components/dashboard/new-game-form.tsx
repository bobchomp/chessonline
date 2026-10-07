"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { GameOptions, type ColorChoice } from "@/components/game-options";

export function NewGameForm() {
  const router = useRouter();
  const [timeControl, setTimeControl] = useState("10+0");
  const [color, setColor] = useState<ColorChoice>("random");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timeControl, color }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't create the game.");
      router.push(`/game/${data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't create the game.");
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <h2 className="text-lg font-semibold">New game</h2>

      <GameOptions timeControl={timeControl} color={color} onTimeControl={setTimeControl} onColor={setColor} />

      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

      <button
        type="button"
        onClick={create}
        disabled={busy}
        className="mt-5 w-full rounded-lg bg-primary py-2.5 font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
      >
        {busy ? "Creating…" : "Create game & get PIN"}
      </button>
    </div>
  );
}
