"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { KeyRound, LogIn } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/** Join a friend's game with its 6-digit PIN (invite links fill it in). */
export function JoinGameForm({ initialPin }: { initialPin: string }) {
  const router = useRouter();
  const [pin, setPin] = useState(initialPin.replace(/\D/g, "").slice(0, 6));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cardRef = useRef<HTMLElement>(null);

  // Arriving from an invite link: bring the filled-in PIN into view.
  useEffect(() => {
    if (initialPin) cardRef.current?.scrollIntoView({ block: "center" });
  }, [initialPin]);

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
    <Card id="join" ref={cardRef}>
      <CardHeader
        title="Join a game"
        icon={<KeyRound />}
        description="Got a 6-digit PIN from a friend? Enter it here."
      />
      <CardBody>
        <form onSubmit={join}>
          <label htmlFor="join-pin" className="sr-only">
            Game PIN
          </label>
          <div className="flex gap-2">
            <input
              id="join-pin"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="6-digit PIN"
              className="h-10 min-w-0 flex-1 rounded-lg border border-input bg-background px-3 text-center font-mono text-lg tracking-[0.3em] outline-none placeholder:font-sans placeholder:text-sm placeholder:tracking-normal placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
            <Button type="submit" disabled={busy || pin.length !== 6}>
              <LogIn /> {busy ? "Joining…" : "Join"}
            </Button>
          </div>
          {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
        </form>
      </CardBody>
    </Card>
  );
}
