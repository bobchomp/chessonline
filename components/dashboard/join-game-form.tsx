"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";

/** "Have a PIN?" — join a friend's game with its 6-digit code. */
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
    <form onSubmit={join}>
      <label htmlFor="join-pin" className="text-sm font-medium">
        Have a PIN from a friend?
      </label>
      <div className="mt-2 flex gap-2">
        <input
          id="join-pin"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="6-digit PIN"
          className="h-10 min-w-0 flex-1 rounded-lg border border-input bg-background px-3 text-center font-mono text-lg tracking-[0.3em] outline-none placeholder:font-sans placeholder:text-sm placeholder:tracking-normal placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/15"
        />
        <Button type="submit" variant="outline" disabled={busy || pin.length !== 6}>
          <LogIn /> {busy ? "Joining…" : "Join"}
        </Button>
      </div>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </form>
  );
}
