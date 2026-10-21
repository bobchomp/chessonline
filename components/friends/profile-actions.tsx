"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Relationship } from "@/lib/friends/service";
import { FriendButton, postFriendAction } from "./friend-button";
import { ChallengeDialog } from "./challenge-dialog";
import { MoreHorizontal, ShieldBan, Swords, UserMinus } from "lucide-react";
import { Button, buttonClasses } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Menu, MenuButton } from "@/components/ui/menu";

/** Friend / unfriend / block controls on a profile page. */
export function ProfileActions({ userId, username, initial }: { userId: string; username: string; initial: Relationship }) {
  const router = useRouter();
  const [rel, setRel] = useState(initial);
  const [confirm, setConfirm] = useState<"remove" | "block" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [challenging, setChallenging] = useState(false);

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
        <Button size="sm" variant="outline" disabled={busy} onClick={() => act("unblock")}>
          Unblock
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-2">
      {challenging && <ChallengeDialog friendId={userId} friendName={username} onClose={() => setChallenging(false)} />}
      {confirm && (
        <Dialog
          size="sm"
          icon={confirm === "block" ? <ShieldBan /> : <UserMinus />}
          title={confirm === "block" ? `Block ${username}?` : `Remove ${username}?`}
          description={
            confirm === "block"
              ? "They won't be able to find you, challenge you or send friend requests."
              : "You can send them a friend request again later."
          }
          onClose={() => setConfirm(null)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setConfirm(null)}>
                Cancel
              </Button>
              <Button className="bg-red-600 text-white shadow-sm hover:bg-red-700" disabled={busy} onClick={() => act(confirm)}>
                {confirm === "block" ? "Block" : "Remove"}
              </Button>
            </>
          }
        >
          {error && <p className="text-sm text-destructive">{error}</p>}
        </Dialog>
      )}
      <div className="flex flex-wrap items-center justify-end gap-2">
        {rel === "friends" && (
          <Button size="sm" onClick={() => setChallenging(true)}>
            <Swords /> Challenge
          </Button>
        )}
        <FriendButton key={rel} userId={userId} initial={rel} compact onChange={setRel} />
        <Menu
          label={`More options for ${username}`}
          width="w-48"
          triggerClassName={buttonClasses({ variant: "outline", size: "icon-sm" })}
          trigger={<MoreHorizontal aria-hidden />}
        >
          {(close) => (
            <>
              {rel === "friends" && (
                <MenuButton
                  onClick={() => {
                    close();
                    setConfirm("remove");
                  }}
                >
                  <UserMinus /> Remove friend
                </MenuButton>
              )}
              <MenuButton
                className="text-red-700"
                onClick={() => {
                  close();
                  setConfirm("block");
                }}
              >
                <ShieldBan /> Block
              </MenuButton>
            </>
          )}
        </Menu>
      </div>
      {error && !confirm && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
