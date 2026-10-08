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
    <form onSubmit={join} className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <h2 className="font-semibold">Join with a PIN</h2>
      <p className="text-sm text-muted-foreground">Enter the 6-digit PIN your friend got.</p>
      <div className="mt-3 flex gap-2">
        <input
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="000000"
          aria-label="Game PIN"
          className="min-w-0 flex-1 rounded-lg border border-input bg-background px-3 py-2 text-center font-mono text-xl tracking-[0.3em] outline-none focus:border-primary"
        />
        <button
          type="submit"
          disabled={busy || pin.length !== 6}
          className="shrink-0 rounded-lg bg-primary px-4 font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
        >
          {busy ? "Joining…" : "Join"}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </form>
  );
}
