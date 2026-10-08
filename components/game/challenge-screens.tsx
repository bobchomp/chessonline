"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { GameView } from "@/lib/game/view";
import { formatTimeControl } from "@/lib/game/format";
import { TIME_CONTROLS } from "@/lib/game/rules";

const primary = "rounded-lg bg-primary px-5 py-2.5 font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60";
const secondary = "rounded-lg border border-border px-5 py-2.5 font-semibold hover:bg-secondary";

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
  const s = Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function Shell({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-3xl text-primary">{icon}</div>
      <h1 className="mt-4 text-2xl font-bold">{title}</h1>
      {children}
    </div>
  );
}

/** The challenger's screen while waiting for their friend to accept. */
export function ChallengeWaiting({ game, busy, onCancel }: { game: GameView; busy: boolean; onCancel: () => void }) {
  const left = useCountdown(game.expiresAt);
  return (
    <Shell icon="⚔" title="Challenge sent">
      <p className="mt-2 text-muted-foreground">
        Waiting for <span className="font-medium text-foreground">{game.invited?.name}</span> to accept…
      </p>
      <div className="mt-6 flex items-center gap-3 text-sm text-muted-foreground">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
        </span>
        <span>
          {tcLabel(game)} · you play <span className="capitalize">{game.myColor}</span>
          {left && <> · expires in {left}</>}
        </span>
      </div>
      <button type="button" onClick={onCancel} disabled={busy} className={`mt-8 ${secondary}`}>
        Cancel challenge
      </button>
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
    <Shell icon="⚔" title={`${from?.name ?? "A friend"} challenges you`}>
      <p className="mt-2 text-muted-foreground">
        {tcLabel(game)} · you play {game.white ? "black" : "white"}
        {left && <> · expires in {left}</>}
      </p>
      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
      <div className="mt-8 flex gap-3">
        <button type="button" onClick={() => onRespond(false)} disabled={busy} className={secondary}>
          Decline
        </button>
        <button type="button" onClick={() => onRespond(true)} disabled={busy} className={primary}>
          Accept
        </button>
      </div>
    </Shell>
  );
}

/** Someone else's private challenge. */
export function PrivateChallenge() {
  return (
    <Shell icon="🔒" title="Private challenge">
      <p className="mt-2 text-muted-foreground">This game is a challenge between two other players.</p>
      <Link href="/dashboard" className={`mt-8 ${secondary}`}>
        Back to lobby
      </Link>
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
          rated: game.rated,
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
    <Shell icon="⚔" title={title}>
      <p className="mt-2 text-muted-foreground">{body}</p>
      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/dashboard#friends" className={secondary}>
          Back to friends
        </Link>
        {friend && (
          <button type="button" onClick={challengeAgain} disabled={busy} className={primary}>
            {creator ? "Challenge again" : `Challenge ${friend.name}`}
          </button>
        )}
      </div>
    </Shell>
  );
}
