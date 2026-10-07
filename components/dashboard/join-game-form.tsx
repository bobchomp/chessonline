"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function JoinGameForm({ initialPin }: { initialPin: string }) {
  const router = useRouter();
  const [pin, setPin] = useState(initialPin.replace(/\D/g, "").slice(0, 6));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function join(e: FormEvent) {
    e.preventDefault();
    if (pin.length !== 6) {
      setError("Enter all 6 digits.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/games/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't join that game.");
      router.push(`/game/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't join that game.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={join} className="flex flex-col rounded-xl border border-border bg-card p-5 shadow-sm">
      <h2 className="text-lg font-semibold">Join with a PIN</h2>
      <p className="mt-1 text-sm text-muted-foreground">Ask your friend for the 6-digit PIN they got.</p>

      <input
        value={pin}
        onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
        inputMode="numeric"
        autoComplete="one-time-code"
        placeholder="000000"
        aria-label="Game PIN"
        className="mt-6 w-full rounded-lg border border-input bg-background px-4 py-4 text-center font-mono text-4xl tracking-[0.5em] outline-none focus:border-primary"
      />

      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

      <button
        type="submit"
        disabled={busy || pin.length !== 6}
        className="mt-5 w-full rounded-lg bg-primary py-2.5 font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
      >
        {busy ? "Joining…" : "Join game"}
      </button>
    </form>
  );
}
