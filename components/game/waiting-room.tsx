"use client";

import { useState } from "react";
import { Check, Copy, Link2, Users } from "lucide-react";
import type { GameView } from "@/lib/game/view";
import { formatTimeControl } from "@/lib/game/format";
import { SideDot } from "@/components/chess/board-layout";
import { Button } from "@/components/ui/button";
import { Shell } from "./challenge-screens";

type Props = {
  game: GameView;
  busy: boolean;
  onCancel: () => void;
};

/** Your new game's PIN, while you wait for a friend to join. */
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
    <Shell icon={<Users />} title="Invite a friend">
      <p className="mt-1 text-sm text-muted-foreground">Send them this PIN, or the invite link. The game starts when they join.</p>

      <div className="mt-6 w-full rounded-xl bg-secondary/60 px-4 py-5">
        <div className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Game PIN</div>
        <div className="mt-1 font-mono text-5xl font-bold tracking-[0.2em] text-primary tabular-nums sm:text-6xl">{pin}</div>
      </div>

      <div className="mt-4 grid w-full grid-cols-2 gap-2">
        <Button onClick={() => copy("pin")}>
          {copied === "pin" ? <Check /> : <Copy />} {copied === "pin" ? "Copied" : "Copy PIN"}
        </Button>
        <Button variant="outline" onClick={() => copy("link")}>
          {copied === "link" ? <Check /> : <Link2 />} {copied === "link" ? "Copied" : "Copy link"}
        </Button>
      </div>

      <dl className="mt-6 grid w-full grid-cols-2 divide-x divide-border rounded-xl border border-border text-sm">
        <div className="px-3 py-2.5">
          <dt className="text-xs text-muted-foreground">Time control</dt>
          <dd className="font-semibold">{formatTimeControl(game.timeControl?.initialMs ?? null, game.timeControl?.incrementMs ?? 0)}</dd>
        </div>
        <div className="px-3 py-2.5">
          <dt className="text-xs text-muted-foreground">You play</dt>
          <dd className="flex items-center justify-center gap-1.5 font-semibold capitalize">
            {game.myColor && <SideDot color={game.myColor} />}
            {game.myColor}
          </dd>
        </div>
      </dl>

      <div className="mt-6 flex items-center gap-2.5 text-sm text-muted-foreground">
        <span className="relative flex size-2.5">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-75" />
          <span className="relative inline-flex size-2.5 rounded-full bg-primary" />
        </span>
        Waiting for your friend to join…
      </div>

      {game.isCreator && (
        <Button variant="ghost" size="sm" className="mt-4 hover:text-red-700" onClick={onCancel} disabled={busy}>
          Cancel game
        </Button>
      )}
    </Shell>
  );
}
