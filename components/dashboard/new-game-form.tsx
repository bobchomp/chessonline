"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { TIME_CONTROLS } from "@/lib/game/rules";

const COLORS = [
  { id: "white", label: "White", icon: "♔" },
  { id: "random", label: "Random", icon: "?" },
  { id: "black", label: "Black", icon: "♚" },
] as const;

export function NewGameForm() {
  const router = useRouter();
  const [timeControl, setTimeControl] = useState("10+0");
  const [color, setColor] = useState<(typeof COLORS)[number]["id"]>("random");
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

      <div className="mt-4 text-sm font-medium text-muted-foreground">Time control</div>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {TIME_CONTROLS.map((tc) => (
          <button
            key={tc.id}
            type="button"
            onClick={() => setTimeControl(tc.id)}
            className={`rounded-md border px-2 py-2 text-sm transition ${
              timeControl === tc.id
                ? "border-primary bg-primary/15 text-foreground"
                : "border-border hover:bg-secondary"
            }`}
          >
            {tc.label}
          </button>
        ))}
      </div>

      <div className="mt-4 text-sm font-medium text-muted-foreground">Play as</div>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {COLORS.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setColor(c.id)}
            className={`flex flex-col items-center rounded-md border py-2 text-sm transition ${
              color === c.id ? "border-primary bg-primary/15" : "border-border hover:bg-secondary"
            }`}
          >
            <span className="text-2xl leading-none">{c.icon}</span>
            {c.label}
          </button>
        ))}
      </div>

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
