"use client";

import { useState } from "react";
import type { GameView } from "@/lib/game/view";
import { formatTimeControl } from "@/lib/game/format";

type Props = {
  game: GameView;
  busy: boolean;
  onCancel: () => void;
};

export function WaitingRoom({ game, busy, onCancel }: Props) {
  const [copied, setCopied] = useState<"pin" | "link" | null>(null);
  const pin = game.pin ?? "";

  async function copy(what: "pin" | "link") {
    const text = what === "pin" ? pin : `${window.location.origin}/dashboard?pin=${pin}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // Clipboard can be blocked; the PIN is on screen anyway.
    }
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-12 text-center">
      <p className="text-sm uppercase tracking-widest text-muted-foreground">Your game PIN</p>
      <div className="mt-3 font-mono text-6xl font-bold tracking-[0.25em] text-primary sm:text-7xl">{pin}</div>
      <p className="mt-4 text-muted-foreground">
        Send this PIN to your friend. They enter it under <span className="text-foreground">Join with a PIN</span>.
      </p>

      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={() => copy("pin")}
          className="rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground hover:opacity-90"
        >
          {copied === "pin" ? "Copied!" : "Copy PIN"}
        </button>
        <button
          type="button"
          onClick={() => copy("link")}
          className="rounded-lg border border-border px-4 py-2 font-semibold hover:bg-secondary"
        >
          {copied === "link" ? "Copied!" : "Copy invite link"}
        </button>
      </div>

      <div className="mt-8 flex items-center gap-3 text-sm text-muted-foreground">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
        </span>
        Waiting for your opponent to join…
      </div>

      <dl className="mt-8 grid w-full grid-cols-2 gap-3 text-sm">
        <div className="rounded-lg border border-border bg-card p-3">
          <dt className="text-muted-foreground">Time control</dt>
          <dd className="font-semibold">
            {formatTimeControl(game.timeControl?.initialMs ?? null, game.timeControl?.incrementMs ?? 0)}
          </dd>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <dt className="text-muted-foreground">You play</dt>
          <dd className="font-semibold capitalize">{game.myColor}</dd>
        </div>
      </dl>

      {game.isCreator && (
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="mt-8 text-sm text-muted-foreground underline-offset-4 hover:text-destructive hover:underline disabled:opacity-50"
        >
          Cancel game
        </button>
      )}
    </div>
  );
}
