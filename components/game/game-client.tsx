"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Chess, type Square } from "chess.js";
import { Chessboard, type PieceDropHandlerArgs, type SquareHandlerArgs } from "react-chessboard";
import type { Color } from "@/lib/db/schema";
import { ABANDON_AFTER_MS, DAY_MS, describeEnding, type ClockSnapshot } from "@/lib/game/rules";
import type { ChatView, GameView, UnchangedView } from "@/lib/game/view";
import { formatTimeControl } from "@/lib/game/format";
import { ArrowUpDown, ChartLine, CircleSlash, Eye, Flag, Handshake, Hourglass, ListOrdered, MessageCircle, Plus, RotateCcw, Trophy, Volume2, VolumeX, X } from "lucide-react";
import { BoardLayout, PlayerBar } from "@/components/chess/board-layout";
import { RatingDelta, RatingText } from "@/components/chess/result-mark";
import { SpeedIcon, speedFor } from "@/components/chess/speed";
import { Avatar } from "@/components/ui/avatar";
import { Badge, CountDot } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";
import { Dialog } from "@/components/ui/dialog";
import { Page } from "@/components/ui/page";
import { Segmented } from "@/components/ui/segmented";
import { Clock } from "./clock";
import { MoveList } from "./move-list";
import { ChatPanel } from "./chat-panel";
import { PromotionPicker } from "./promotion-picker";
import { DrawOfferDialog } from "./draw-offer-dialog";
import { FriendButton } from "@/components/friends/friend-button";
import { botThinkMs, getBot } from "@/lib/bots/definitions";
import { computeBotMove } from "@/lib/bots/play";
import { WaitingRoom } from "./waiting-room";
import { ChallengeClosed, ChallengeInvite, ChallengeWaiting, PrivateChallenge } from "./challenge-screens";
import { isMuted, playSound, setMuted as saveMuted, soundForSan, unlockAudioOnInteraction } from "@/lib/sounds";

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
  const [panel, setPanel] = useState<"moves" | "chat">("moves");
  // Messages seen while the chat tab was open; the rest count as unread.
  const [seenChat, setSeenChat] = useState(initial.chat.length);
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

  // ---- computer opponent ---------------------------------------------------------
  // Bot moves are computed here, in the human player's browser, and submitted to the
  // server, which checks they're legal and that it's the bot's turn.

  const opponentPlayer = opponentColor ? (opponentColor === "white" ? game.white : game.black) : null;
  const bot = getBot(opponentPlayer?.id);
  const [botThinking, setBotThinking] = useState(false);
  const [botRetry, setBotRetry] = useState(0);
  const botPlyRef = useRef(-1);
  const clockRef = useRef(clock);
  useEffect(() => {
    clockRef.current = clock;
  }, [clock]);

  useEffect(() => {
    if (!bot || !opponentColor || game.status !== "active" || optimisticMoves) return;
    const ply = game.moves.length;
    const botToMove = (ply % 2 === 0 ? "white" : "black") === opponentColor;
    if (!botToMove || botPlyRef.current === ply) return;
    botPlyRef.current = ply;

    const snap = clockRef.current.snap;
    const botMs = snap ? (opponentColor === "white" ? snap.whiteMs : snap.blackMs) : null;
    const think = botThinkMs(bot, game.timeControl ? botMs : null);
    const fen = game.fen;
    let started = false;

    const timer = setTimeout(async () => {
      started = true;
      setBotThinking(true);
      const t0 = performance.now();
      const move = await computeBotMove(bot, fen, think);
      const wait = think - (performance.now() - t0);
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      setBotThinking(false);
      if (!move) return;
      try {
        const res = await fetch(`/api/games/${id}/bot-move`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...move, ply, chatAfter: lastChatIdRef.current }),
        });
        if (res.ok) {
          apply(await res.json());
          return;
        }
        // 409 = the game moved on (resigned, aborted...): just resync.
        if (res.status === 409) {
          void refresh();
          return;
        }
      } catch {
        // network blip: retry below
      }
      botPlyRef.current = -1;
      setTimeout(() => setBotRetry((n) => n + 1), 2000);
    }, 0);

    return () => {
      clearTimeout(timer);
      if (!started) botPlyRef.current = -1;
    };
  }, [bot, opponentColor, game.status, game.moves.length, game.fen, game.timeControl, optimisticMoves, botRetry, id, apply, refresh]);

  const selectViewPly = useCallback(
    (ply: number) => {
      setSelected(null);
      setViewPly(ply >= moves.length ? null : ply);
    },
    [moves.length],
  );

  // ---- sounds and board orientation --------------------------------------------

  const [flipped, setFlipped] = useState(false);
  const [muted, setMuted] = useState(false);
  useEffect(() => {
    // Read the saved setting after mount so server and client render the same thing.
    const t = setTimeout(() => setMuted(isMuted()), 0);
    const stop = unlockAudioOnInteraction();
    return () => {
      clearTimeout(t);
      stop();
    };
  }, []);

  // Sounds: every new move (yours or the opponent's, even while you're looking at an
  // earlier position), and each step forward when replaying with ▶ / →.
  const soundRef = useRef({ length: moves.length, ply: shownPly });
  useEffect(() => {
    const prev = soundRef.current;
    soundRef.current = { length: moves.length, ply: shownPly };
    if (moves.length > prev.length) playSound(soundForSan(moves[moves.length - 1]));
    else if (moves.length === prev.length && shownPly > prev.ply) playSound(soundForSan(moves[shownPly - 1]));
  }, [shownPly, moves]);

  const statusRef = useRef(game.status);
  useEffect(() => {
    const prev = statusRef.current;
    statusRef.current = game.status;
    if (prev === "waiting" && game.status === "active") playSound("start");
    if (prev === "active" && game.status === "finished") playSound("end");
  }, [game.status]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowLeft") selectViewPly(Math.max(0, shownPly - 1));
      if (e.key === "ArrowRight") selectViewPly(Math.min(moves.length, shownPly + 1));
      if (e.key === "f" && !e.metaKey && !e.ctrlKey && !e.altKey) setFlipped((f) => !f);
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

  // Friend challenges that never turned into a game.
  if (game.invited && game.status === "aborted" && (!game.white || !game.black)) {
    return <ChallengeClosed game={game} />;
  }
  if (game.status === "waiting" && game.invited) {
    if (myColor) {
      return (
        <ChallengeWaiting
          game={game}
          busy={busy}
          onCancel={async () => {
            await act("cancel");
          }}
        />
      );
    }
    if (!game.isInvited) return <PrivateChallenge />;
    return (
      <ChallengeInvite
        game={game}
        busy={busy}
        error={error}
        onRespond={async (accept) => {
          setBusy(true);
          setError(null);
          const res = await fetch(`/api/challenges/${id}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: accept ? "accept" : "decline" }),
          });
          const data = await res.json().catch(() => ({}));
          setBusy(false);
          if (!res.ok) setError(data.error ?? "Something went wrong.");
          void refresh();
        }}
      />
    );
  }

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

  const orientation: Color = flipped ? (myColor === "black" ? "white" : "black") : (myColor ?? "white");
  const top: Color = orientation === "white" ? "black" : "white";
  const bottom: Color = orientation;
  const clockRunning = (c: Color) => game.status === "active" && clock.snap?.running === c && !optimisticMoves;

  const playerBar = (c: Color) => {
    const p = c === "white" ? game.white : game.black;
    const ms = c === "white" ? clock.snap?.whiteMs : clock.snap?.blackMs;
    const pBot = getBot(p?.id);
    return (
      <PlayerBar
        name={p?.name ?? (game.status === "aborted" ? "No opponent" : "Waiting…")}
        icon={p ? undefined : <Hourglass />}
        href={p && !pBot ? `/u/${encodeURIComponent(p.name)}` : undefined}
        emoji={pBot?.avatar}
        color={c}
        isYou={p?.id === userId}
        detail={
          pBot ? (
            <span>
              Computer · {pBot.rating}
              {botThinking && c === opponentColor && <span className="ml-1.5 animate-pulse">thinking…</span>}
            </span>
          ) : p ? (
            <>
              <RatingText rating={p.rating} provisional={p.provisional} />
              <RatingDelta delta={p.ratingDiff} />
            </>
          ) : null
        }
        tags={
          <>
            {p && myColor && p.id !== userId && !pBot && <FriendButton userId={p.id} compact hideWhenFriends />}
            {game.status === "active" && game.drawOfferBy === c && <Badge tone="warning">Offers a draw</Badge>}
          </>
        }
        clock={clock.snap && ms !== undefined ? <Clock ms={ms} running={clockRunning(c)} receivedAt={clock.receivedAt} /> : undefined}
      />
    );
  };

  const opponentAway = game.status === "active" && !!myColor && awayMs !== null && awayMs >= ABANDON_AFTER_MS;
  const incomingDrawOffer = game.status === "active" && !!opponentColor && game.drawOfferBy === opponentColor;
  const myTurn = game.status === "active" && !!myColor && turn === myColor;
  const daily = (game.timeControl?.initialMs ?? 0) >= DAY_MS;
  const tcLabel = formatTimeControl(game.timeControl?.initialMs ?? null, game.timeControl?.incrementMs ?? 0);
  const speed = speedFor(game.timeControl?.initialMs ?? null, game.timeControl?.incrementMs ?? 0);

  let headline: string;
  let subline: string | null = null;
  if (game.status === "active") {
    if (myColor) headline = myTurn ? "Your move" : bot ? `${bot.name} is thinking…` : "Opponent's move";
    else headline = `${turn === "white" ? "White" : "Black"} to move`;
    // Daily games have a deadline from the very first move.
    if (moves.length < 2 && game.timeControl && !daily) subline = "Clocks start after each side's first move.";
  } else {
    headline = describeEnding(game);
  }

  const showChat = !!myColor && !bot;
  const unread = panel === "chat" ? 0 : chat.slice(seenChat).filter((m) => m.userId !== userId).length;

  return (
    <>
      {incomingDrawOffer && (
        <DrawOfferDialog
          opponentName={(opponentColor === "white" ? game.white : game.black)?.name ?? "Your opponent"}
          clocks={
            clock.snap && myColor && opponentColor
              ? [opponentColor, myColor].map((c) => ({
                  label: c === myColor ? "You" : ((c === "white" ? game.white : game.black)?.name ?? "Opponent"),
                  ms: c === "white" ? clock.snap!.whiteMs : clock.snap!.blackMs,
                  running: clockRunning(c),
                }))
              : undefined
          }
          clockReceivedAt={clock.receivedAt}
          busy={busy}
          error={error}
          onAccept={() => act("accept_draw")}
          onDecline={() => act("decline_draw")}
        />
      )}
      {confirmResign && (
        <Dialog
          size="sm"
          icon={<Flag />}
          title="Resign this game?"
          description={game.rated ? "It counts as a loss and your rating will change." : "It counts as a loss."}
          onClose={() => setConfirmResign(false)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setConfirmResign(false)}>
                Keep playing
              </Button>
              <Button
                className="bg-red-600 text-white shadow-sm hover:bg-red-700"
                disabled={busy}
                onClick={async () => {
                  setConfirmResign(false);
                  await act("resign");
                }}
              >
                Resign
              </Button>
            </>
          }
        />
      )}
      <BoardLayout
        top={playerBar(top)}
        bottom={playerBar(bottom)}
        board={
          <>
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
          </>
        }
        side={
          <>
            {game.status === "finished" || game.status === "aborted" ? (
              <ResultCard
                game={game}
                myColor={myColor}
                headline={headline}
                opponentColor={opponentColor}
                isBot={!!bot}
                busy={busy}
                error={error}
                canReview={game.status === "finished" && moves.length >= 2}
                onAction={act}
              />
            ) : (
              <Card>
                <div className="p-4 sm:p-5">
                  <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <SpeedIcon speed={speed} className="size-3.5" />
                      {tcLabel}
                      {game.rated && " · Rated"}
                    </span>
                    {!myColor && (
                      <Badge>
                        <Eye /> Watching
                      </Badge>
                    )}
                  </div>
                  <p className={cn("mt-2 flex items-center gap-2 text-lg font-semibold", myTurn && "text-primary")}>
                    {myTurn && <span className="size-2.5 animate-pulse rounded-full bg-primary" aria-hidden />}
                    {headline}
                  </p>
                  {subline && <p className="mt-0.5 text-sm text-muted-foreground">{subline}</p>}

                  {error && (
                    <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                      {error}
                    </p>
                  )}
                  {opponentAway && (
                    <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
                      <p>Your opponent seems to have left the game.</p>
                      <Button size="sm" className="mt-2" onClick={() => act("claim_win")} disabled={busy}>
                        {moves.length < 2 ? "Abort game" : "Claim victory"}
                      </Button>
                    </div>
                  )}
                </div>

                {game.status === "active" && myColor && opponentColor && (
                  <div className="flex gap-2 border-t border-border px-4 py-3 sm:px-5">
                    {game.moves.length < 2 ? (
                      <Button variant="secondary" size="sm" className="flex-1" onClick={() => act("abort")} disabled={busy}>
                        <X /> Abort
                      </Button>
                    ) : bot ? (
                      <span className="flex flex-1 items-center text-xs text-muted-foreground">No draws against the computer</span>
                    ) : (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="flex-1"
                        onClick={() => act("offer_draw")}
                        disabled={busy || game.drawOfferBy === myColor || game.drawOffered[myColor]}
                        title={game.drawOffered[myColor] ? "You can offer one draw per game." : undefined}
                      >
                        <Handshake />
                        {game.drawOfferBy === myColor ? "Draw offered" : game.drawOffered[myColor] ? "Draw offer used" : "Offer draw"}
                      </Button>
                    )}
                    <Button variant="danger" size="sm" className="flex-1" onClick={() => setConfirmResign(true)} disabled={busy}>
                      <Flag /> Resign
                    </Button>
                  </div>
                )}
              </Card>
            )}

            <Card>
              <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2 sm:px-4">
                {showChat ? (
                  <Segmented
                    label="Panel"
                    value={panel}
                    onChange={(v) => {
                      setPanel(v);
                      setSeenChat(chat.length);
                    }}
                    options={[
                      { value: "moves", label: "Moves", icon: <ListOrdered /> },
                      {
                        value: "chat",
                        label: (
                          <>
                            Chat
                            {unread > 0 && <CountDot count={unread} />}
                          </>
                        ),
                        icon: <MessageCircle />,
                      },
                    ]}
                  />
                ) : (
                  <span className="flex items-center gap-2 px-1 text-sm font-semibold">
                    <ListOrdered className="size-4 text-muted-foreground" aria-hidden /> Moves
                  </span>
                )}
                <div className="flex gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setFlipped((f) => !f)}
                    aria-pressed={flipped}
                    aria-label="Flip board (F)"
                    title="Flip board (F)"
                  >
                    <ArrowUpDown />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => {
                      const next = !muted;
                      setMuted(next);
                      saveMuted(next);
                      if (!next) playSound("move");
                    }}
                    aria-pressed={!muted}
                    aria-label={muted ? "Turn sounds on" : "Turn sounds off"}
                    title={muted ? "Sounds off" : "Sounds on"}
                  >
                    {muted ? <VolumeX /> : <Volume2 />}
                  </Button>
                </div>
              </div>
              <div className="p-3 sm:p-4">
                {showChat && panel === "chat" ? (
                  <ChatPanel messages={chat} userId={userId} onSend={(body) => post("chat", { body })} />
                ) : (
                  <MoveList moves={moves} shownPly={shownPly} onSelect={selectViewPly} />
                )}
              </div>
            </Card>
          </>
        }
      />
    </>
  );
}

/** The end-of-game panel: the result, rating change, and what to do next. */
function ResultCard({
  game,
  myColor,
  opponentColor,
  headline,
  isBot,
  busy,
  error,
  canReview,
  onAction,
}: {
  game: GameView;
  myColor: Color | null;
  opponentColor: Color | null;
  headline: string;
  isBot: boolean;
  busy: boolean;
  error: string | null;
  canReview: boolean;
  onAction: (action: string) => void;
}) {
  const me = myColor ? (myColor === "white" ? game.white : game.black) : null;
  const outcome =
    game.status !== "finished" || !game.result
      ? null
      : game.result === "1/2-1/2"
        ? "draw"
        : myColor
          ? (game.result === "1-0") === (myColor === "white")
            ? "win"
            : "loss"
          : null;
  const title =
    game.status === "aborted"
      ? "Game aborted"
      : outcome === "win"
        ? "You won"
        : outcome === "loss"
          ? "You lost"
          : outcome === "draw"
            ? "Draw"
            : game.result === "1-0"
              ? "White won"
              : "Black won";
  const Icon = outcome === "win" ? Trophy : outcome === "draw" ? Handshake : outcome === "loss" ? Flag : CircleSlash;
  // "White wins by checkmate" → "by checkmate"; the title already says who won.
  const reason = game.status === "aborted" ? null : headline.replace(/^(White wins|Black wins|Draw)\s*/, "") || null;

  return (
    <Card className="overflow-hidden">
      <div
        className={cn(
          "flex items-center gap-4 p-4 sm:p-5",
          outcome === "win" ? "bg-emerald-50" : outcome === "loss" ? "bg-red-50/70" : "bg-secondary/50",
        )}
      >
        <span
          className={cn(
            "flex size-12 shrink-0 items-center justify-center rounded-full",
            outcome === "win" ? "bg-emerald-600 text-white" : outcome === "loss" ? "bg-red-600 text-white" : "bg-card text-muted-foreground",
          )}
        >
          <Icon className="size-6" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-xl font-bold">{title}</p>
          {reason && <p className="text-sm text-muted-foreground">{reason[0].toUpperCase() + reason.slice(1)}</p>}
        </div>
      </div>

      {me?.rating != null && me.ratingDiff != null && (
        <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm sm:px-5">
          <span className="text-muted-foreground">Rating</span>
          <span className="flex items-center gap-2 font-semibold tabular-nums">
            {me.rating + me.ratingDiff}
            <RatingDelta delta={me.ratingDiff} className="text-sm" />
          </span>
        </div>
      )}

      <div className="space-y-2 border-t border-border p-4 sm:p-5">
        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {error}
          </p>
        )}
        {game.status === "finished" && myColor && opponentColor && (
          <>
            {game.rematchGameId ? (
              <ButtonLink href={`/game/${game.rematchGameId}`} block>
                <RotateCcw /> Go to rematch
              </ButtonLink>
            ) : game.rematchOfferBy === opponentColor ? (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                <p className="text-sm font-medium">Your opponent wants a rematch.</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <Button size="sm" onClick={() => onAction("accept_rematch")} disabled={busy}>
                    Accept
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => onAction("decline_rematch")} disabled={busy}>
                    Decline
                  </Button>
                </div>
              </div>
            ) : (
              <Button block onClick={() => onAction("offer_rematch")} disabled={busy || game.rematchOfferBy === myColor}>
                <RotateCcw />
                {isBot ? "Play again" : game.rematchOfferBy === myColor ? "Rematch offered…" : "Rematch"}
              </Button>
            )}
          </>
        )}
        <div className="grid grid-cols-2 gap-2">
          {canReview ? (
            <ButtonLink href={`/game/${game.id}/review`} variant="outline">
              <ChartLine /> Review
            </ButtonLink>
          ) : (
            <span />
          )}
          <ButtonLink href="/dashboard" variant="outline" className={canReview ? "" : "col-span-2"}>
            <Plus /> New game
          </ButtonLink>
        </div>
      </div>
    </Card>
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
    <Page width="narrow" className="max-w-md py-12">
      <Card className="p-6 text-center sm:p-8">
        <Avatar name={host?.name ?? "?"} size="lg" className="mx-auto" />
        <h1 className="mt-4 text-xl font-bold">{host?.name ?? "Someone"} invited you to play</h1>
        <p className="mt-1 text-muted-foreground">
          {formatTimeControl(game.timeControl?.initialMs ?? null, game.timeControl?.incrementMs ?? 0)} · you play {game.white ? "black" : "white"}
        </p>
        {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
        <Button size="lg" block className="mt-6" onClick={onJoin} disabled={busy}>
          {busy ? "Joining…" : "Join game"}
        </Button>
      </Card>
    </Page>
  );
}
