"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { BOTS } from "@/lib/bots/definitions";
import { GameOptions, type ColorChoice } from "@/components/game-options";

export function BotPicker() {
  const router = useRouter();
  const [botId, setBotId] = useState(BOTS[2].id);
  const [timeControl, setTimeControl] = useState("untimed");
  const [color, setColor] = useState<ColorChoice>("random");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bot = BOTS.find((b) => b.id === botId) ?? BOTS[0];

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/bots/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ botId, timeControl, color }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't start the game.");
      router.push(`/game/${data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start the game.");
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm md:col-span-2">
      <h2 className="text-lg font-semibold">Play the computer</h2>
      <p className="text-sm text-muted-foreground">No waiting for an opponent. Pick a level from beginner to grandmaster.</p>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {BOTS.map((b) => (
          <button
            key={b.id}
            type="button"
            onClick={() => setBotId(b.id)}
            aria-pressed={botId === b.id}
            className={`flex items-center gap-2 rounded-md border px-2 py-2 text-left transition ${
              botId === b.id ? "border-primary bg-primary/15" : "border-border hover:bg-secondary"
            }`}
          >
            <span className="text-2xl leading-none">{b.avatar}</span>
            <span className="min-w-0">
              <span className="block text-sm font-medium leading-tight">{b.name}</span>
              <span className="block text-xs text-muted-foreground">{b.rating}</span>
            </span>
          </button>
        ))}
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{bot.name}:</span> {bot.blurb}
      </p>

      <GameOptions timeControl={timeControl} color={color} onTimeControl={setTimeControl} onColor={setColor} />

      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

      <button
        type="button"
        onClick={start}
        disabled={busy}
        className="mt-5 w-full rounded-lg bg-primary py-2.5 font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
      >
        {busy ? "Starting…" : `Play ${bot.name}`}
      </button>
    </div>
  );
}
