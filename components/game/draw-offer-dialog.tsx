"use client";

type Props = {
  opponentName: string;
  busy: boolean;
  error: string | null;
  onAccept: () => void;
  onDecline: () => void;
};

/**
 * Blocking popup for an incoming draw offer. There's deliberately no way to
 * dismiss it (no close button, backdrop click or Escape): the player has to
 * accept or decline before they can keep playing.
 */
export function DrawOfferDialog({ opponentName, busy, error, onAccept, onDecline }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="draw-offer-title"
        aria-describedby="draw-offer-body"
        className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 text-center shadow-2xl"
      >
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-2xl font-bold text-primary">
          ½
        </div>
        <h2 id="draw-offer-title" className="mt-4 text-xl font-semibold">
          Draw offered
        </h2>
        <p id="draw-offer-body" className="mt-2 text-muted-foreground">
          <span className="font-medium text-foreground">{opponentName}</span> offers a draw. Do you accept?
        </p>

        {error && (
          <p className="mt-4 rounded-md bg-destructive/15 px-3 py-2 text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onDecline}
            disabled={busy}
            className="rounded-lg bg-secondary px-4 py-2.5 font-medium transition hover:bg-accent disabled:opacity-50"
          >
            Decline
          </button>
          <button
            type="button"
            onClick={onAccept}
            disabled={busy}
            autoFocus
            className="rounded-lg bg-primary px-4 py-2.5 font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
          >
            Accept draw
          </button>
        </div>
      </div>
    </div>
  );
}
