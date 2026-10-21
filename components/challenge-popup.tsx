"use client";

import { Swords } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { formatCountdown, formatTimeControl } from "@/lib/game/format";
import { useNotifications } from "./notifications";

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
    <Dialog
      size="sm"
      icon={<Swords />}
      title="You've been challenged!"
      description={
        <>
          <span className="font-medium text-foreground">{current.from}</span> challenges you to a game.
        </>
      }
      footer={
        <>
          <Button variant="secondary" onClick={() => respond("decline")} disabled={busy}>
            Decline
          </Button>
          <Button onClick={() => respond("accept")} disabled={busy} autoFocus>
            Accept
          </Button>
        </>
      }
    >
      <dl className="grid grid-cols-2 divide-x divide-border rounded-xl border border-border text-sm">
        <div className="px-3 py-2.5">
          <dt className="text-xs text-muted-foreground">Time control</dt>
          <dd className="font-semibold">{formatTimeControl(current.timeControl.initialMs, current.timeControl.incrementMs)}</dd>
        </div>
        <div className="px-3 py-2.5">
          <dt className="text-xs text-muted-foreground">You play</dt>
          <dd className="font-semibold capitalize">{current.yourColor}</dd>
        </div>
      </dl>
      {inOtherGame && (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          You&apos;re in a game right now. Accepting leaves it running on the clock.
        </p>
      )}
      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
      <p className="mt-3 text-xs text-muted-foreground">
        Expires in {formatCountdown(remaining)}
        {open.length > 1 && ` · ${open.length - 1} more waiting`}
      </p>
    </Dialog>
  );
}
