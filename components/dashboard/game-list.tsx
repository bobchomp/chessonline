import Link from "next/link";
import type { Game } from "@/lib/db/schema";
import { colorOf, turnOf } from "@/lib/game/rules";
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

export function GameList({ games, userId, empty }: { games: Game[]; userId: string; empty: string }) {
  if (games.length === 0) {
    return <p className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">{empty}</p>;
  }
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      {games.map((g) => {
        const me = colorOf(g, userId);
        const opponent = (me === "white" ? g.blackName : g.whiteName) ?? g.invitedName;
        const { label, tone } = outcome(g, userId);
        return (
          <li key={g.id}>
            <Link href={`/game/${g.id}`} className="flex items-center gap-4 px-4 py-3 hover:bg-secondary">
              <span className="text-2xl leading-none" title={`You played ${me}`}>
                {me === "white" ? "♔" : "♚"}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{opponent ? `vs ${opponent}` : "Waiting for opponent"}</div>
                <div className="text-xs text-muted-foreground">
                  {formatTimeControl(g.initialMs, g.incrementMs)} · {Math.ceil(g.moves.length / 2)} moves ·{" "}
                  {formatRelative(g.updatedAt)}
                </div>
              </div>
              <span className={`text-sm ${tone}`}>{label}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
