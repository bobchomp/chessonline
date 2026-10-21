"use client";

import { Lock, Swords } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { GameView } from "@/lib/game/view";
import { formatCountdown, formatTimeControl } from "@/lib/game/format";
import { TIME_CONTROLS } from "@/lib/game/rules";


function tcLabel(game: GameView) {
  return formatTimeControl(game.timeControl?.initialMs ?? null, game.timeControl?.incrementMs ?? 0);
}

function useCountdown(expiresAt: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!expiresAt) return null;
  return formatCountdown(new Date(expiresAt).getTime() - now);
}

/** A centred card for the screens around a challenge. */
export function Shell({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-md px-4 py-10 sm:py-16">
      <Card className="flex flex-col items-center p-6 text-center sm:p-8">
        <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary [&_svg]:size-6">{icon}</div>
        <h1 className="mt-4 text-xl font-bold">{title}</h1>
        {children}
      </Card>
    </div>
  );
}

function Pulse() {
  return (
    <span className="relative flex size-2.5 shrink-0">
      <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-75" />
      <span className="relative inline-flex size-2.5 rounded-full bg-primary" />
    </span>
  );
}

/** The challenger's screen while waiting for their friend to accept. */
export function ChallengeWaiting({ game, busy, onCancel }: { game: GameView; busy: boolean; onCancel: () => void }) {
  const left = useCountdown(game.expiresAt);
  return (
    <Shell icon={<Swords />} title="Challenge sent">
      <p className="mt-2 text-muted-foreground">
        Waiting for <span className="font-medium text-foreground">{game.invited?.name}</span> to accept…
      </p>
      <div className="mt-6 flex items-center gap-3 text-sm text-muted-foreground">
        <Pulse />
        <span>
          {tcLabel(game)} · you play <span className="capitalize">{game.myColor}</span>
          {left && <> · expires in {left}</>}
        </span>
      </div>
      <Button variant="outline" className="mt-8" onClick={onCancel} disabled={busy}>
        Cancel challenge
      </Button>
    </Shell>
  );
}

/** Shown to the challenged player if they open the challenge page directly. */
export function ChallengeInvite({
  game,
  busy,
  error,
  onRespond,
}: {
  game: GameView;
  busy: boolean;
  error: string | null;
  onRespond: (accept: boolean) => void;
}) {
  const left = useCountdown(game.expiresAt);
  const from = game.white ?? game.black;
  return (
    <Shell icon={<Swords />} title={`${from?.name ?? "A friend"} challenges you`}>
      <p className="mt-2 text-muted-foreground">
        {tcLabel(game)} · you play {game.white ? "black" : "white"}
        {left && <> · expires in {left}</>}
      </p>
      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
      <div className="mt-8 grid w-full grid-cols-2 gap-3">
        <Button variant="secondary" onClick={() => onRespond(false)} disabled={busy}>
          Decline
        </Button>
        <Button onClick={() => onRespond(true)} disabled={busy}>
          Accept
        </Button>
      </div>
    </Shell>
  );
}

/** Someone else's private challenge. */
export function PrivateChallenge() {
  return (
    <Shell icon={<Lock />} title="Private challenge">
      <p className="mt-2 text-muted-foreground">This game is a challenge between two other players.</p>
      <ButtonLink href="/dashboard" variant="outline" className="mt-8">
        Back to Play
      </ButtonLink>
    </Shell>
  );
}

/** A challenge that ended before the game started: declined, expired or cancelled. */
export function ChallengeClosed({ game }: { game: GameView }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const creator = game.isCreator;
  const friend = creator ? game.invited : (game.white ?? game.black);

  let title: string;
  let body: string;
  if (game.abortReason === "declined") {
    title = "Challenge declined";
    body = creator ? `${friend?.name} declined your challenge.` : "You declined this challenge.";
  } else if (game.abortReason === "expired") {
    title = "Challenge expired";
    body = creator
      ? `${friend?.name} didn't respond within 10 minutes.`
      : "This challenge expired before it was accepted.";
  } else {
    title = "Challenge cancelled";
    body = creator ? "You cancelled this challenge." : `${friend?.name} cancelled the challenge.`;
  }

  async function challengeAgain() {
    if (!friend) return;
    setBusy(true);
    setError(null);
    const tc = TIME_CONTROLS.find(
      (t) => t.initialMs === (game.timeControl?.initialMs ?? null) && t.incrementMs === (game.timeControl?.incrementMs ?? 0),
    );
    try {
      const res = await fetch("/api/challenges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          friendId: friend.id,
          timeControl: tc?.id ?? "untimed",
          // The challenged player gets the opposite color of the original challenger.
          color: creator ? (game.myColor ?? "random") : game.white ? "black" : "white",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't send the challenge.");
      router.push(`/game/${data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send the challenge.");
      setBusy(false);
    }
  }

  return (
    <Shell icon={<Swords />} title={title}>
      <p className="mt-2 text-muted-foreground">{body}</p>
      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <ButtonLink href="/dashboard#friends" variant="outline">
          Back to friends
        </ButtonLink>
        {friend && (
          <Button onClick={challengeAgain} disabled={busy}>
            {creator ? "Challenge again" : `Challenge ${friend.name}`}
          </Button>
        )}
      </div>
    </Shell>
  );
}
