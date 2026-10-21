import Link from "next/link";
import { History, Hourglass } from "lucide-react";
import type { Game, Termination } from "@/lib/db/schema";
import { clockAt, colorOf, isDaily, turnOf } from "@/lib/game/rules";
import { getBot } from "@/lib/bots/definitions";
import { dayLabel, formatClock, formatRelative, formatTimeControl } from "@/lib/game/format";
import { RatingDelta, ResultMark, type Outcome } from "@/components/chess/result-mark";
import { SpeedIcon, speedFor } from "@/components/chess/speed";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/components/ui/cn";
import { EmptyState } from "@/components/ui/empty-state";

const ENDINGS: Record<Termination, string> = {
  checkmate: "Checkmate",
  resignation: "Resigned",
  timeout: "On time",
  abandonment: "Abandoned",
  stalemate: "Stalemate",
  threefold_repetition: "Repetition",
  fifty_move_rule: "50-move rule",
  insufficient_material: "Insufficient material",
  agreement: "Agreed",
  timeout_vs_insufficient_material: "Time vs insufficient material",
};

/** Won, lost or drawn from `userId`'s side; null if unfinished. */
export function outcomeFor(game: Game, userId: string): Outcome | null {
  if (game.status !== "finished" || !game.result) return null;
  if (game.result === "1/2-1/2") return "draw";
  const me = colorOf(game, userId);
  return (game.result === "1-0") === (me === "white") ? "win" : "loss";
}

/** Whose move it is, the PIN, or "challenge sent", as a badge. */
function OngoingStatus({ game, userId }: { game: Game; userId: string }) {
  if (game.status === "waiting") {
    return game.invitedUserId ? <Badge tone="info">Challenge sent</Badge> : <Badge tone="info">PIN {game.pin}</Badge>;
  }
  const mine = turnOf(game) === colorOf(game, userId);
  // Daily games: how long until the move deadline.
  const clock = isDaily(game) ? clockAt(game, new Date()) : null;
  const left = clock?.running ? formatClock(clock.running === "white" ? clock.whiteMs : clock.blackMs) : null;
  return mine ? (
    <Badge tone="primary" className="font-semibold">
      Your move{left && ` · ${left}`}
    </Badge>
  ) : (
    <Badge>Their move{left && ` · ${left}`}</Badge>
  );
}

export function isMyMove(game: Game, userId: string): boolean {
  return game.status === "active" && turnOf(game) === colorOf(game, userId);
}

/** One game: opponent, clock settings and moves, and the result or status. */
export function GameRow({ game: g, userId, showDate = true }: { game: Game; userId: string; showDate?: boolean }) {
  const me = colorOf(g, userId);
  const opponentId = me === "white" ? g.blackId : g.whiteId;
  const opponent = (me === "white" ? g.blackName : g.whiteName) ?? g.invitedName;
  const opponentRating = me === "white" ? g.blackRating : g.whiteRating;
  const bot = getBot(opponentId);
  const outcome = outcomeFor(g, userId);
  const ongoing = g.status === "waiting" || g.status === "active";
  const diff = me === "white" ? g.whiteRatingDiff : g.blackRatingDiff;
  const speed = speedFor(g.initialMs, g.incrementMs);
  const moves = Math.ceil(g.moves.length / 2);
  const detail = [
    formatTimeControl(g.initialMs, g.incrementMs),
    moves ? `${moves} ${moves === 1 ? "move" : "moves"}` : null,
    g.status === "finished" && g.termination ? ENDINGS[g.termination] : null,
    g.status === "aborted" ? "Aborted" : null,
    showDate ? formatRelative(g.endedAt ?? g.updatedAt) : null,
  ].filter(Boolean);

  return (
    <li>
      <Link
        href={`/game/${g.id}`}
        className={cn(
          "flex items-center gap-3 px-4 py-3 transition-colors hover:bg-secondary/60 sm:px-5",
          ongoing && isMyMove(g, userId) && "bg-primary/[0.04]",
        )}
      >
        <Avatar name={opponent ?? "?"} emoji={bot?.avatar} icon={opponent ? undefined : <Hourglass />} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold">{opponent ?? "Waiting for an opponent"}</span>
            {opponentRating != null && !bot && <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{opponentRating}</span>}
            {bot && <Badge className="hidden sm:inline-flex">Computer · {bot.rating}</Badge>}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <SpeedIcon speed={speed} className="size-3.5" />
            <span className="truncate">{detail.join(" · ")}</span>
          </div>
        </div>
        {ongoing ? (
          <OngoingStatus game={g} userId={userId} />
        ) : outcome ? (
          <div className="flex shrink-0 items-center gap-3">
            <RatingDelta delta={diff} />
            <ResultMark outcome={outcome} />
          </div>
        ) : (
          <span className="shrink-0 text-xs text-muted-foreground">Aborted</span>
        )}
      </Link>
    </li>
  );
}

/** A plain list of games (the dashboard's ongoing and recent games). */
export function GameList({ games, userId, showDate }: { games: Game[]; userId: string; showDate?: boolean }) {
  return (
    <ul className="divide-y divide-border">
      {games.map((g) => (
        <GameRow key={g.id} game={g} userId={userId} showDate={showDate} />
      ))}
    </ul>
  );
}

/** Finished games grouped under day headings ("Today", "Yesterday", …). */
export function GroupedGameList({ games, userId, now = new Date() }: { games: Game[]; userId: string; now?: Date }) {
  if (games.length === 0) {
    return <EmptyState icon={<History />} title="No games here" description="Games you finish will show up here." />;
  }
  const groups: { label: string; games: Game[] }[] = [];
  for (const g of games) {
    const label = dayLabel(g.endedAt ?? g.updatedAt, now);
    const last = groups[groups.length - 1];
    if (last?.label === label) last.games.push(g);
    else groups.push({ label, games: [g] });
  }
  return (
    <div>
      {groups.map((group) => (
        <div key={group.label}>
          <h3 className="border-y border-border bg-secondary/40 px-4 py-1.5 text-xs font-semibold text-muted-foreground first:border-t-0 sm:px-5">
            {group.label}
          </h3>
          <GameList games={group.games} userId={userId} showDate={false} />
        </div>
      ))}
    </div>
  );
}
