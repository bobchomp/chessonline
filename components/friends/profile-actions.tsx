"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Relationship } from "@/lib/friends/service";
import { FriendButton, postFriendAction } from "./friend-button";

const btn = "rounded-md px-3 py-1.5 text-sm font-medium transition disabled:opacity-50";

/** Friend / unfriend / block controls on a profile page. */
export function ProfileActions({ userId, username, initial }: { userId: string; username: string; initial: Relationship }) {
  const router = useRouter();
  const [rel, setRel] = useState(initial);
  const [confirm, setConfirm] = useState<"remove" | "block" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (rel === "self") return null;

  async function act(action: string) {
    setBusy(true);
    setError(null);
    try {
      setRel(await postFriendAction(action, userId));
      setConfirm(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  if (rel === "blocked") {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">You blocked {username}.</span>
        <button type="button" disabled={busy} onClick={() => act("unblock")} className={`${btn} bg-secondary hover:bg-accent`}>
          Unblock
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <FriendButton key={rel} userId={userId} initial={rel} onChange={setRel} />
        {confirm ? (
          <>
            <span className="text-sm">{confirm === "block" ? `Block ${username}?` : `Remove ${username}?`}</span>
            <button type="button" disabled={busy} onClick={() => act(confirm)} className={`${btn} bg-destructive text-white hover:opacity-90`}>
              {confirm === "block" ? "Block" : "Remove"}
            </button>
            <button type="button" onClick={() => setConfirm(null)} className={`${btn} bg-secondary hover:bg-accent`}>
              Cancel
            </button>
          </>
        ) : (
          <>
            {rel === "friends" && (
              <button type="button" onClick={() => setConfirm("remove")} className={`${btn} bg-secondary hover:bg-accent`}>
                Remove friend
              </button>
            )}
            <button type="button" onClick={() => setConfirm("block")} className={`${btn} bg-secondary text-destructive hover:bg-accent`}>
              Block
            </button>
          </>
        )}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
