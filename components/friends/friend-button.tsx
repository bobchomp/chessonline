"use client";

import { useEffect, useState } from "react";
import type { Relationship } from "@/lib/friends/service";
import { useNotifications } from "@/components/notifications";

type Props = {
  userId: string;
  /** Known relationship; fetched on mount when omitted. */
  initial?: Relationship;
  compact?: boolean;
  /** Hide the button entirely once you're friends. */
  hideWhenFriends?: boolean;
  onChange?: (r: Relationship) => void;
};

export async function postFriendAction(action: string, userId: string): Promise<Relationship> {
  const res = await fetch("/api/friends", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, userId }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
  return data.relationship;
}

/** Add / requested / accept / friends button for another player. */
export function FriendButton({ userId, initial, compact, hideWhenFriends, onChange }: Props) {
  const { refresh } = useNotifications();
  const [rel, setRel] = useState<Relationship | null>(initial ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initial) return;
    let cancelled = false;
    fetch(`/api/users/${encodeURIComponent(userId)}/relationship`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d) setRel(d.relationship);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [userId, initial]);

  async function act(action: string) {
    setBusy(true);
    setError(null);
    try {
      const next = await postFriendAction(action, userId);
      setRel(next);
      onChange?.(next);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  if (!rel || rel === "self" || rel === "blocked" || (hideWhenFriends && rel === "friends")) return null;

  const size = compact ? "px-2 py-0.5 text-xs" : "px-3 py-1.5 text-sm";
  const base = `rounded-md font-medium transition disabled:opacity-50 ${size}`;

  return (
    <span className="inline-flex items-center gap-1.5" title={error ?? undefined}>
      {rel === "none" && (
        <button type="button" disabled={busy} onClick={() => act("request")} className={`${base} bg-primary text-primary-foreground hover:opacity-90`}>
          + Add friend
        </button>
      )}
      {rel === "incoming" && (
        <button type="button" disabled={busy} onClick={() => act("accept")} className={`${base} bg-primary text-primary-foreground hover:opacity-90`}>
          Accept friend request
        </button>
      )}
      {rel === "outgoing" && (
        <>
          <span className={`${base} bg-secondary text-muted-foreground`}>Request sent</span>
          <button type="button" disabled={busy} onClick={() => act("cancel")} className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
            Cancel
          </button>
        </>
      )}
      {rel === "friends" && <span className={`${base} bg-primary/10 text-primary`}>✓ Friends</span>}
      {error && <span className="text-xs text-destructive">{error}</span>}
    </span>
  );
}
