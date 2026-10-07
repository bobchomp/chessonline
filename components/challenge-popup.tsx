"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { formatTimeControl } from "@/lib/game/format";
import { useNotifications } from "./notifications";

function formatCountdown(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * Incoming friend challenges pop up on any signed-in page, including during a
 * game, and wait for Accept or Decline. Several challenges are shown one at a time.
 */
export function ChallengePopup() {
  const router = useRouter();
  const pathname = usePathname();
  const { challenges, activeGameId, refresh } = useNotifications();
  const [handled, setHandled] = useState<Set<string>>(() => new Set());
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = challenges.filter((c) => !handled.has(c.gameId) && new Date(c.expiresAt).getTime() > now);
  const current = open[0];

  useEffect(() => {
    if (!current) return;
    // `now` may date from page load; refresh it as soon as a challenge appears.
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const t = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [current]);

  if (!current || pathname.startsWith("/auth/")) return null;

  const remaining = new Date(current.expiresAt).getTime() - now;
  const inOtherGame = activeGameId !== null && activeGameId !== current.gameId;

  async function respond(action: "accept" | "decline") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/challenges/${current.gameId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
      setHandled((h) => new Set(h).add(current.gameId));
      refresh();
      if (action === "accept") router.push(`/game/${current.gameId}`);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Something went wrong.";
      setError(message);
      // Expired or cancelled: let the player read why, then move on.
      if (/expired|cancelled/i.test(message)) {
        const id = current.gameId;
        setTimeout(() => {
          setHandled((h) => new Set(h).add(id));
          setError(null);
        }, 2500);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="challenge-popup-title"
        aria-describedby="challenge-popup-body"
        className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 text-center shadow-2xl"
      >
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-3xl text-primary">
          ⚔
        </div>
        <h2 id="challenge-popup-title" className="mt-4 text-xl font-semibold">
          You&apos;ve been challenged!
        </h2>
        <p id="challenge-popup-body" className="mt-2 text-muted-foreground">
          <span className="font-medium text-foreground">{current.from}</span> challenges you to a game.
        </p>

        <dl className="mt-5 grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-lg bg-secondary/60 p-2.5">
            <dt className="text-muted-foreground">Time control</dt>
            <dd className="font-semibold">
              {formatTimeControl(current.timeControl.initialMs, current.timeControl.incrementMs)}
            </dd>
          </div>
          <div className="rounded-lg bg-secondary/60 p-2.5">
            <dt className="text-muted-foreground">You play</dt>
            <dd className="font-semibold capitalize">{current.yourColor}</dd>
          </div>
        </dl>

        {inOtherGame && (
          <p className="mt-4 rounded-md bg-amber-500/15 px-3 py-2 text-sm text-amber-800">
            You&apos;re in a game right now. Accepting leaves it running on the clock.
          </p>
        )}
        {error && (
          <p className="mt-4 rounded-md bg-destructive/15 px-3 py-2 text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => respond("decline")}
            disabled={busy}
            className="rounded-lg bg-secondary px-4 py-2.5 font-medium transition hover:bg-accent disabled:opacity-50"
          >
            Decline
          </button>
          <button
            type="button"
            onClick={() => respond("accept")}
            disabled={busy}
            autoFocus
            className="rounded-lg bg-primary px-4 py-2.5 font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
          >
            Accept
          </button>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Expires in {formatCountdown(remaining)}
          {open.length > 1 && ` · ${open.length - 1} more waiting`}
        </p>
      </div>
    </div>
  );
}
