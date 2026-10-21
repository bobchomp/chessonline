"use client";

import { Handshake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Clock } from "./clock";

export type DialogClock = { label: string; ms: number; running: boolean };

type Props = {
  opponentName: string;
  busy: boolean;
  error: string | null;
  /** Live clocks for timed games (omitted for untimed). */
  clocks?: DialogClock[];
  clockReceivedAt?: number;
  onAccept: () => void;
  onDecline: () => void;
};

/**
 * Blocking popup for an incoming draw offer. There's deliberately no way to
 * dismiss it (no close button, backdrop click or Escape): the player has to
 * accept or decline before they can keep playing.
 */
export function DrawOfferDialog({ opponentName, busy, error, clocks, clockReceivedAt = 0, onAccept, onDecline }: Props) {
  return (
    <Dialog
      size="sm"
      icon={<Handshake />}
      title="Draw offered"
      description={
        <>
          <span className="font-medium text-foreground">{opponentName}</span> offers a draw. Do you accept?
        </>
      }
      footer={
        <>
          <Button variant="secondary" onClick={onDecline} disabled={busy}>
            Decline
          </Button>
          <Button onClick={onAccept} disabled={busy} autoFocus>
            Accept draw
          </Button>
        </>
      }
    >
      {clocks && clocks.length > 0 && (
        <div className="space-y-2 rounded-xl bg-secondary/60 p-3">
          {clocks.map((c, i) => (
            <div key={i} className="flex items-center justify-between gap-3">
              <span className="truncate text-sm font-medium">{c.label}</span>
              <Clock ms={c.ms} running={c.running} receivedAt={clockReceivedAt} />
            </div>
          ))}
        </div>
      )}
      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
    </Dialog>
  );
}
