"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Chess, type Square } from "chess.js";
import { Chessboard, type PieceDropHandlerArgs, type SquareHandlerArgs } from "react-chessboard";
import type { Color } from "@/lib/db/schema";
import { ABANDON_AFTER_MS, describeEnding, type ClockSnapshot } from "@/lib/game/rules";
import type { ChatView, GameView, UnchangedView } from "@/lib/game/view";
import { formatTimeControl } from "@/lib/game/format";
import { Clock } from "./clock";
import { MoveList } from "./move-list";
import { ChatPanel } from "./chat-panel";
import { PromotionPicker } from "./promotion-picker";
import { DrawOfferDialog } from "./draw-offer-dialog";
import { WaitingRoom } from "./waiting-room";

const HIGHLIGHT = "rgba(246, 246, 105, 0.6)";
const SELECTED = "rgba(246, 246, 105, 0.85)";

/** How often to poll, tuned so the wait for an opponent's move is short but idle tabs stay cheap. */
function pollInterval(game: GameView, hidden: boolean): number {
  if (hidden) return 15_000;
  switch (game.status) {
    case "waiting":
      return 1_500;
    case "active": {
      if (!game.myColor) return 2_000;
      const turn: Color = game.moves.length % 2 === 0 ? "white" : "black";
      return turn === game.myColor ? 2_500 : 1_000;
    }
    case "finished":
      return 3_000;
    default:
      return 10_000;
  }
}

type Props = { initial: GameView; userId: string };

export function GameClient({ initial, userId }: Props) {
  const router = useRouter();
  const id = initial.id;

  const [game, setGame] = useState(initial);
  const [chat, setChat] = useState<ChatView[]>(initial.chat);
  const [clock, setClock] = useState<{ snap: ClockSnapshot | null; receivedAt: number }>(() => ({
    snap: initial.clock,
    receivedAt: performance.now(),
  }));
  const [awayMs, setAwayMs] = useState(initial.opponentAwayMs);
  const [optimisticMoves, setOptimisticMoves] = useState<string[] | null>(null);
  const [viewPly, setViewPly] = useState<number | null>(null);
  const [selected, setSelected] = useState<Square | null>(null);
  const [promotion, setPromotion] = useState<{ from: Square; to: Square } | null>(null);
  const [confirmResign, setConfirmResign] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const gameRef = useRef(initial);
  const versionRef = useRef(initial.version);
  const lastChatIdRef = useRef(initial.chat.at(-1)?.id ?? 0);

  // ---- syncing with the server -------------------------------------------------

  const apply = useCallback((data: GameView | UnchangedView) => {
    const receivedAt = performance.now();
    if ("unchanged" in data) {
      if (data.version !== versionRef.current) return;
      setClock({ snap: data.clock, receivedAt });
      setAwayMs(data.opponentAwayMs);
      return;
    }
    if (data.version < versionRef.current) return; // stale response
    versionRef.current = data.version;
    gameRef.current = data;
    setGame(data);
    setClock({ snap: data.clock, receivedAt });
    setAwayMs(data.opponentAwayMs);
    const fresh = data.chat.filter((m) => m.id > lastChatIdRef.current);
    if (fresh.length) {
      lastChatIdRef.current = fresh.at(-1)!.id;
      setChat((c) => [...c, ...fresh]);
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/games/${id}?v=${versionRef.current}&chatAfter=${lastChatIdRef.current}`, {
        cache: "no-store",
      });
      if (res.ok) apply(await res.json());
    } catch {
      // Network blip; the next poll will catch up.
    }
  }, [id, apply]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let inFlight = false;
    let cancelled = false;

    const schedule = (ms: number) => {
      clearTimeout(timer);
      timer = setTimeout(run, ms);
    };
    const run = async () => {
      if (inFlight || cancelled) return;
      inFlight = true;
      await refresh();
      inFlight = false;
      if (!cancelled) schedule(pollInterval(gameRef.current, document.hidden));
    };
    const onVisibility = () => {
      if (!document.hidden) schedule(0);
    };

    schedule(pollInterval(gameRef.current, document.hidden));
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refresh]);

  const post = useCallback(
    async (path: string, body: object): Promise<boolean> => {
      setBusy(true);
      setError(null);
      try {
        const res = await fetch(`/api/games/${id}/${path}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...body, chatAfter: lastChatIdRef.current }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error ?? "Something went wrong.");
          void refresh();
          return false;
        }
        if (typeof data.version === "number") apply(data);
        else void refresh();
        return true;
      } catch {
        setError("Network error. Check your connection.");
        return false;
      } finally {
        setBusy(false);
      }
    },
    [id, apply, refresh],
  );

  const act = (action: string) => post("action", { action });

  // When a rematch starts while we're watching, follow it to the new game.
  useEffect(() => {
    if (game.rematchGameId && game.rematchGameId !== initial.rematchGameId) {
      router.push(`/game/${game.rematchGameId}`);
    }
  }, [game.rematchGameId, initial.rematchGameId, router]);

  // ---- derived board state -----------------------------------------------------

  const moves = optimisticMoves ?? game.moves;
  const { fens, history } = useMemo(() => {
    const chess = new Chess();
    const fens = [chess.fen()];
    const history: { from: Square; to: Square }[] = [];
    for (const san of moves) {
      const m = chess.move(san);
      fens.push(chess.fen());
      history.push({ from: m.from, to: m.to });
    }
    return { fens, history };
  }, [moves]);

  const isLive = viewPly === null || viewPly >= moves.length;
  const shownPly = isLive ? moves.length : viewPly;
  const shownFen = fens[shownPly];
  const liveChess = useMemo(() => new Chess(fens[fens.length - 1]), [fens]);

  const myColor = game.myColor;
  const opponentColor: Color | null = myColor ? (myColor === "white" ? "black" : "white") : null;
  const turn: Color = moves.length % 2 === 0 ? "white" : "black";
  const canMove =
    game.status === "active" && !!myColor && turn === myColor && isLive && !optimisticMoves && !promotion;

  const selectViewPly = useCallback(
    (ply: number) => {
      setSelected(null);
      setViewPly(ply >= moves.length ? null : ply);
    },
    [moves.length],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowLeft") selectViewPly(Math.max(0, shownPly - 1));
      if (e.key === "ArrowRight") selectViewPly(Math.min(moves.length, shownPly + 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectViewPly, shownPly, moves.length]);

  useEffect(() => {
    const base = "Chess Online";
    document.title = canMove ? `● Your move · ${base}` : base;
    return () => {
      document.title = base;
    };
  }, [canMove]);

  // ---- making moves ------------------------------------------------------------

  async function submitMove(from: Square, to: Square, promo?: string) {
    const chess = new Chess(liveChess.fen());
    let san: string;
    try {
      san = chess.move({ from, to, promotion: promo }).san;
    } catch {
      return false;
    }
    setSelected(null);
    setOptimisticMoves([...game.moves, san]);
    await post("move", { from, to, promotion: promo, ply: game.moves.length });
    setOptimisticMoves(null);
    return true;
  }

  function tryMove(from: Square, to: Square): boolean {
    const legal = liveChess.moves({ square: from, verbose: true }).filter((m) => m.to === to);
    if (legal.length === 0) return false;
    if (legal.some((m) => m.promotion)) {
      setSelected(null);
      setPromotion({ from, to });
      return false;
    }
    void submitMove(from, to);
    return true;
  }

  const myPrefix = myColor === "white" ? "w" : "b";

  function onPieceDrop({ sourceSquare, targetSquare }: PieceDropHandlerArgs): boolean {
    if (!canMove || !targetSquare || sourceSquare === targetSquare) return false;
    return tryMove(sourceSquare as Square, targetSquare as Square);
  }

  function onSquareClick({ square, piece }: SquareHandlerArgs) {
    if (!canMove) return;
    const sq = square as Square;
    if (selected && selected !== sq) {
      const isTarget = liveChess.moves({ square: selected, verbose: true }).some((m) => m.to === sq);
      if (isTarget) {
        tryMove(selected, sq);
        return;
      }
    }
    if (piece && piece.pieceType.startsWith(myPrefix) && selected !== sq) setSelected(sq);
    else setSelected(null);
  }

  const squareStyles = useMemo(() => {
    const styles: Record<string, CSSProperties> = {};
    const last = history[shownPly - 1];
    if (last) {
      styles[last.from] = { backgroundColor: HIGHLIGHT };
      styles[last.to] = { backgroundColor: HIGHLIGHT };
    }
    const shown = new Chess(shownFen);
    if (shown.isCheck()) {
      const kingColor = shown.turn();
      for (const row of shown.board()) {
        for (const sq of row) {
          if (sq && sq.type === "k" && sq.color === kingColor) {
            styles[sq.square] = {
              ...styles[sq.square],
              backgroundImage:
                "radial-gradient(circle, rgba(239,68,68,0.95) 0%, rgba(239,68,68,0.5) 45%, transparent 75%)",
            };
          }
        }
      }
    }
    if (selected) {
      styles[selected] = { backgroundColor: SELECTED };
      for (const m of liveChess.moves({ square: selected, verbose: true })) {
        styles[m.to] = {
          ...styles[m.to],
          backgroundImage: m.captured
            ? "radial-gradient(circle, transparent 58%, rgba(0,0,0,0.18) 60%)"
            : "radial-gradient(circle, rgba(0,0,0,0.18) 22%, transparent 24%)",
        };
      }
    }
    return styles;
  }, [history, shownPly, shownFen, selected, liveChess]);

  // ---- render ------------------------------------------------------------------

  if (game.status === "waiting") {
    if (myColor) {
      return (
        <WaitingRoom
          game={game}
          busy={busy}
          onCancel={async () => {
            if (await act("cancel")) router.push("/dashboard");
          }}
        />
      );
    }
    return (
      <JoinPrompt
        game={game}
        busy={busy}
        error={error}
        onJoin={async () => {
          setBusy(true);
          setError(null);
          const res = await fetch("/api/games/join", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pin: game.pin }),
          });
          const data = await res.json().catch(() => ({}));
          setBusy(false);
          if (!res.ok) setError(data.error ?? "Couldn't join.");
          else void refresh();
        }}
      />
    );
  }

  const orientation: Color = myColor ?? "white";
  const top: Color = orientation === "white" ? "black" : "white";
  const bottom: Color = orientation;
  const clockRunning = (c: Color) => game.status === "active" && clock.snap?.running === c && !optimisticMoves;

  const playerBar = (c: Color) => {
    const p = c === "white" ? game.white : game.black;
    const ms = c === "white" ? clock.snap?.whiteMs : clock.snap?.blackMs;
    return (
      <div className="flex items-center justify-between gap-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={`inline-block h-3.5 w-3.5 shrink-0 rounded-full border border-neutral-400 ${
              c === "white" ? "bg-white" : "bg-neutral-900"
            }`}
          />
          <span className="truncate font-semibold">{p?.name ?? "—"}</span>
          {p?.id === userId && <span className="text-xs text-muted-foreground">(you)</span>}
          {game.status === "active" && game.drawOfferBy === c && (
            <span className="rounded bg-secondary px-1.5 py-0.5 text-xs text-muted-foreground">offers draw</span>
          )}
        </div>
        {clock.snap && ms !== undefined && (
          <Clock ms={ms} running={clockRunning(c)} receivedAt={clock.receivedAt} />
        )}
      </div>
    );
  };

  let status: string;
  if (game.status === "active") {
    if (myColor) status = turn === myColor ? "Your move" : "Waiting for your opponent…";
    else status = `${turn === "white" ? "White" : "Black"} to move`;
    if (moves.length < 2 && game.timeControl) status += " · clocks start after each side's first move";
  } else {
    status = describeEnding(game);
    if (myColor && game.result) {
      if (game.result !== "1/2-1/2") {
        status = (game.result === "1-0") === (myColor === "white") ? `You won! ${status}` : `You lost. ${status}`;
      }
    }
  }

  const opponentAway = game.status === "active" && !!myColor && awayMs !== null && awayMs >= ABANDON_AFTER_MS;
  const incomingDrawOffer = game.status === "active" && !!opponentColor && game.drawOfferBy === opponentColor;

  return (
    <>
      {incomingDrawOffer && (
        <DrawOfferDialog
          opponentName={(opponentColor === "white" ? game.white : game.black)?.name ?? "Your opponent"}
          busy={busy}
          error={error}
          onAccept={() => act("accept_draw")}
          onDecline={() => act("decline_draw")}
        />
      )}
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="mx-auto w-full max-w-[min(100%,calc(100vh-12rem))]">
          {playerBar(top)}
          <div className="relative aspect-square w-full overflow-hidden rounded-md shadow-lg shadow-black/15 ring-1 ring-black/5">
            <Chessboard
              options={{
                id: `game-${id}`,
                position: shownFen,
                boardOrientation: orientation,
                allowDragging: canMove,
                canDragPiece: ({ piece }) => canMove && piece.pieceType.startsWith(myPrefix),
                onPieceDrop,
                onSquareClick,
                squareStyles,
                lightSquareStyle: { backgroundColor: "var(--board-light)" },
                darkSquareStyle: { backgroundColor: "var(--board-dark)" },
                animationDurationInMs: 180,
              }}
            />
            {promotion && myColor && (
              <PromotionPicker
                color={myColor}
                onCancel={() => setPromotion(null)}
                onPick={(piece) => {
                  const { from, to } = promotion;
                  setPromotion(null);
                  void submitMove(from, to, piece);
                }}
              />
            )}
          </div>
          {playerBar(bottom)}
        </div>

        <aside className="flex flex-col gap-4">
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{formatTimeControl(game.timeControl?.initialMs ?? null, game.timeControl?.incrementMs ?? 0)}</span>
              {!myColor && <span>Spectating</span>}
            </div>
            <p
              className={`mt-1 font-semibold ${
                game.status === "active" && myColor && turn === myColor ? "text-primary" : ""
              }`}
            >
              {status}
            </p>

            {error && (
              <p className="mt-2 rounded-md bg-destructive/15 px-3 py-2 text-sm text-destructive" role="alert">
                {error}
              </p>
            )}

            {game.status === "active" && myColor && opponentColor && (
              <div className="mt-3 space-y-3">
                {opponentAway && (
                  <Banner text="Your opponent seems to have left the game.">
                    <SmallButton onClick={() => act("claim_win")} disabled={busy} primary>
                      {moves.length < 2 ? "Abort game" : "Claim victory"}
                    </SmallButton>
                  </Banner>
                )}
                <div className="grid grid-cols-2 gap-2">
                  {game.moves.length < 2 ? (
                    <SmallButton onClick={() => act("abort")} disabled={busy}>
                      Abort
                    </SmallButton>
                  ) : (
                    <SmallButton
                      onClick={() => act("offer_draw")}
                      disabled={busy || game.drawOfferBy === myColor}
                    >
                      {game.drawOfferBy === myColor ? "Draw offered" : "Offer draw"}
                    </SmallButton>
                  )}
                  {confirmResign ? (
                    <SmallButton
                      danger
                      disabled={busy}
                      onClick={async () => {
                        setConfirmResign(false);
                        await act("resign");
                      }}
                    >
                      Confirm resign
                    </SmallButton>
                  ) : (
                    <SmallButton
                      onClick={() => {
                        setConfirmResign(true);
                        setTimeout(() => setConfirmResign(false), 4000);
                      }}
                      disabled={busy}
                    >
                      Resign
                    </SmallButton>
                  )}
                </div>
              </div>
            )}

            {game.status === "finished" && myColor && opponentColor && (
              <div className="mt-3 space-y-3">
                {game.rematchGameId ? (
                  <Link
                    href={`/game/${game.rematchGameId}`}
                    className="block rounded-md bg-primary py-2 text-center text-sm font-semibold text-primary-foreground"
                  >
                    Go to rematch
                  </Link>
                ) : game.rematchOfferBy === opponentColor ? (
                  <Banner text="Your opponent wants a rematch.">
                    <SmallButton onClick={() => act("accept_rematch")} disabled={busy} primary>
                      Accept
                    </SmallButton>
                    <SmallButton onClick={() => act("decline_rematch")} disabled={busy}>
                      Decline
                    </SmallButton>
                  </Banner>
                ) : (
                  <SmallButton
                    primary
                    onClick={() => act("offer_rematch")}
                    disabled={busy || game.rematchOfferBy === myColor}
                  >
                    {game.rematchOfferBy === myColor ? "Rematch offered…" : "Offer rematch"}
                  </SmallButton>
                )}
              </div>
            )}

            {(game.status === "finished" || game.status === "aborted") && (
              <Link
                href="/dashboard"
                className="mt-3 block rounded-md border border-border py-2 text-center text-sm hover:bg-secondary"
              >
                Back to lobby
              </Link>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="mb-2 text-sm font-semibold">Moves</div>
            <MoveList moves={moves} shownPly={shownPly} onSelect={selectViewPly} />
          </div>

          {myColor && (
            <ChatPanel
              messages={chat}
              userId={userId}
              onSend={async (body) => {
                const ok = await post("chat", { body });
                return ok;
              }}
            />
          )}
        </aside>
      </div>
    </>
  );
}

function Banner({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-primary/40 bg-primary/10 p-3">
      <p className="text-sm">{text}</p>
      <div className="mt-2 flex gap-2">{children}</div>
    </div>
  );
}

function SmallButton({
  children,
  onClick,
  disabled,
  primary,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
  danger?: boolean;
}) {
  const tone = danger
    ? "bg-destructive text-white hover:opacity-90"
    : primary
      ? "bg-primary text-primary-foreground hover:opacity-90"
      : "bg-secondary hover:bg-accent";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-full rounded-md px-3 py-2 text-sm font-medium transition disabled:opacity-50 ${tone}`}
    >
      {children}
    </button>
  );
}

function JoinPrompt({
  game,
  busy,
  error,
  onJoin,
}: {
  game: GameView;
  busy: boolean;
  error: string | null;
  onJoin: () => void;
}) {
  const host = game.white ?? game.black;
  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="text-2xl font-bold">{host?.name ?? "Someone"} invited you to play</h1>
      <p className="mt-2 text-muted-foreground">
        {formatTimeControl(game.timeControl?.initialMs ?? null, game.timeControl?.incrementMs ?? 0)} · you play{" "}
        {game.white ? "black" : "white"}
      </p>
      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
      <button
        type="button"
        onClick={onJoin}
        disabled={busy}
        className="mt-6 rounded-lg bg-primary px-6 py-3 font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
      >
        {busy ? "Joining…" : "Join game"}
      </button>
    </div>
  );
}
