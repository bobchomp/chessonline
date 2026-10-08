import Link from "next/link";
import type { Game } from "@/lib/db/schema";
import { colorOf, turnOf } from "@/lib/game/rules";
import { getBot } from "@/lib/bots/definitions";
import { formatRelative, formatTimeControl } from "@/lib/game/format";

function outcome(game: Game, userId: string): { label: string; tone: string } {
  const me = colorOf(game, userId);
  if (game.status === "waiting" && game.invitedUserId) return { label: "Challenge sent", tone: "text-primary" };
  if (game.status === "waiting") return { label: `Waiting · PIN ${game.pin}`, tone: "text-primary" };
  if (game.status === "aborted") return { label: "Aborted", tone: "text-muted-foreground" };
  if (game.status === "active") {
    return turnOf(game) === me
      ? { label: "Your move", tone: "text-primary font-semibold" }
      : { label: "Their move", tone: "text-muted-foreground" };
  }
  if (game.result === "1/2-1/2") return { label: "Draw", tone: "text-muted-foreground" };
  const won = (game.result === "1-0" && me === "white") || (game.result === "0-1" && me === "black");
  return won ? { label: "Won", tone: "text-emerald-700 font-medium" } : { label: "Lost", tone: "text-red-600 font-medium" };
}

function GameRow({ game: g, userId }: { game: Game; userId: string }) {
  const me = colorOf(g, userId);
  const opponent = (me === "white" ? g.blackName : g.whiteName) ?? g.invitedName;
  const bot = getBot(me === "white" ? g.blackId : g.whiteId);
  const { label, tone } = outcome(g, userId);
  const diff = me === "white" ? g.whiteRatingDiff : g.blackRatingDiff;
  return (
    <li>
      <Link href={`/game/${g.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-secondary">
        <span className="text-xl leading-none" title={`You played ${me}`}>
          {me === "white" ? "♔" : "♚"}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">
            {opponent ? `vs ${opponent}` : "Waiting for opponent"}
            {bot && <span className="ml-1.5 text-xs font-normal text-muted-foreground">{bot.avatar} computer</span>}
          </div>
          <div className="text-xs text-muted-foreground">
            {formatTimeControl(g.initialMs, g.incrementMs)} · {Math.ceil(g.moves.length / 2)} moves ·{" "}
            {formatRelative(g.updatedAt)}
          </div>
        </div>
        <span className={`shrink-0 text-right text-sm ${tone}`}>
          {label}
          {diff != null && (
            <span className="block text-xs font-normal tabular-nums text-muted-foreground">
              {diff > 0 ? `+${diff}` : diff < 0 ? `−${-diff}` : "±0"}
            </span>
          )}
        </span>
      </Link>
    </li>
  );
}

const listClass = "divide-y divide-border";

/** Games as a list. With `limit`, the rest are tucked behind a "Show more" toggle. */
export function GameList({
  games,
  userId,
  empty,
  limit,
}: {
  games: Game[];
  userId: string;
  empty: string;
  limit?: number;
}) {
  if (games.length === 0) {
    return <p className="rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">{empty}</p>;
  }
  const shown = limit ? games.slice(0, limit) : games;
  const rest = limit ? games.slice(limit) : [];
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <ul className={listClass}>
        {shown.map((g) => (
          <GameRow key={g.id} game={g} userId={userId} />
        ))}
      </ul>
      {rest.length > 0 && (
        <details className="group border-t border-border">
          <summary className="cursor-pointer list-none px-4 py-2.5 text-center text-sm font-medium text-primary hover:bg-secondary group-open:border-b group-open:border-border [&::-webkit-details-marker]:hidden">
            <span className="group-open:hidden">Show {rest.length} more</span>
            <span className="hidden group-open:inline">Show fewer</span>
          </summary>
          <ul className={listClass}>
            {rest.map((g) => (
              <GameRow key={g.id} game={g} userId={userId} />
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
