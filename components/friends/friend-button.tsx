"use client";

import { useEffect, useState } from "react";
import type { Relationship } from "@/lib/friends/service";
import { Check, UserCheck, UserPlus } from "lucide-react";
import { useNotifications } from "@/components/notifications";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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

  const size = compact ? "sm" : "md";

  return (
    <span className="inline-flex items-center gap-1.5" title={error ?? undefined}>
      {rel === "none" && (
        <Button size={size} disabled={busy} onClick={() => act("request")}>
          <UserPlus /> Add friend
        </Button>
      )}
      {rel === "incoming" && (
        <Button size={size} disabled={busy} onClick={() => act("accept")}>
          <UserCheck /> Accept request
        </Button>
      )}
      {rel === "outgoing" && (
        <>
          <Badge>Request sent</Badge>
          <Button variant="ghost" size="sm" disabled={busy} onClick={() => act("cancel")}>
            Cancel
          </Button>
        </>
      )}
      {rel === "friends" && (
        <Badge tone="primary">
          <Check /> Friends
        </Badge>
      )}
      {error && <span className="text-xs text-destructive">{error}</span>}
    </span>
  );
}
