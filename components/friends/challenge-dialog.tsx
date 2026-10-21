"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Swords } from "lucide-react";
import { GameOptions, type ColorChoice } from "@/components/game-options";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

/** Pick a time control and color, then challenge a friend. */
export function ChallengeDialog({
  friendId,
  friendName,
  onClose,
}: {
  friendId: string;
  friendName: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [timeControl, setTimeControl] = useState("10+0");
  const [color, setColor] = useState<ColorChoice>("random");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/challenges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ friendId, timeControl, color }),
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
    <Dialog
      title={`Challenge ${friendName}`}
      description="They'll get a pop-up to accept. Challenges expire after 10 minutes."
      icon={<Swords />}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={send} disabled={busy}>
            {busy ? "Sending…" : "Send challenge"}
          </Button>
        </>
      }
    >
      <GameOptions timeControl={timeControl} color={color} onTimeControl={setTimeControl} onColor={setColor} />
      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
    </Dialog>
  );
}
