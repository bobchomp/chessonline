"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { BOTS } from "@/lib/bots/definitions";
import { GameOptions, type ColorChoice } from "@/components/game-options";

type Mode = "friend" | "computer";

const MODES: { id: Mode; label: string; hint: string }[] = [
  { id: "friend", label: "Play a friend", hint: "Get a 6-digit PIN to share. Or challenge someone from your friends list." },
  { id: "computer", label: "Play the computer", hint: "No waiting. Pick a level from beginner to grandmaster." },
];

/** One card for starting any game: online with a PIN, or against a computer opponent. */
export function StartGame() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("friend");
  // Each mode keeps its own time control: people tend to play the computer untimed.
  const [timeControl, setTimeControl] = useState<Record<Mode, string>>({ friend: "10+0", computer: "untimed" });
  const [color, setColor] = useState<ColorChoice>("random");
  const [botId, setBotId] = useState(BOTS[2].id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bot = BOTS.find((b) => b.id === botId) ?? BOTS[0];

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(mode === "friend" ? "/api/games" : "/api/bots/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timeControl: timeControl[mode], color, ...(mode === "computer" && { botId }) }),
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
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Start a game</h2>
        <div role="tablist" aria-label="Opponent" className="flex rounded-lg bg-secondary p-1 text-sm">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={mode === m.id}
              onClick={() => {
                setMode(m.id);
                setError(null);
              }}
              className={`rounded-md px-3 py-1.5 font-medium transition ${
                mode === m.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{MODES.find((m) => m.id === mode)!.hint}</p>

      {mode === "computer" && (
        <>
          <div className="mt-4 text-sm font-medium text-muted-foreground">Opponent</div>
          <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            {BOTS.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setBotId(b.id)}
                aria-pressed={botId === b.id}
                className={`flex items-center gap-2 rounded-md border px-2 py-1.5 text-left transition ${
                  botId === b.id ? "border-primary bg-primary/15" : "border-border hover:bg-secondary"
                }`}
              >
                <span className="w-6 shrink-0 text-center text-xl leading-none">{b.avatar}</span>
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
        </>
      )}

      <GameOptions
        timeControl={timeControl[mode]}
        color={color}
        onTimeControl={(id) => setTimeControl((t) => ({ ...t, [mode]: id }))}
        onColor={setColor}
      />

      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

      <button
        type="button"
        onClick={start}
        disabled={busy}
        className="mt-5 w-full rounded-lg bg-primary py-2.5 font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
      >
        {busy ? "Starting…" : mode === "friend" ? "Create game & get PIN" : `Play ${bot.name}`}
      </button>
    </section>
  );
}
