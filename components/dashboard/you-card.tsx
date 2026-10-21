import Link from "next/link";
import { ChevronRight, Trophy } from "lucide-react";
import type { RatingSummary } from "@/lib/ratings/queries";
import { LEADERBOARD_MIN_GAMES } from "@/lib/ratings/queries";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

/** Your rating, rank and form at a glance, linking to your profile and the leaderboard. */
export function YouCard({
  username,
  rating,
  record,
  winStreak,
}: {
  username: string;
  rating: RatingSummary | null;
  record: { wins: number; losses: number; draws: number };
  winStreak: number;
}) {
  const games = record.wins + record.losses + record.draws;
  return (
    <Card>
      <Link href={`/u/${encodeURIComponent(username)}`} className="flex items-center gap-3 rounded-t-xl px-4 pt-4 pb-3 hover:bg-secondary/40 sm:px-5 sm:pt-5">
        <Avatar name={username} size="md" />
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">{username}</div>
          <div className="text-xs text-muted-foreground">View your profile</div>
        </div>
        <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
      </Link>
      <div className="grid grid-cols-3 border-t border-border">
        <div className="px-4 py-3 sm:px-5">
          <div className="text-xs text-muted-foreground">Rating</div>
          <div className="mt-0.5 flex items-baseline gap-1.5">
            <span className="text-xl font-bold tabular-nums">{rating?.rating ?? 1500}</span>
          </div>
          {rating?.provisional && (
            <Badge className="mt-1" title="Your rating settles after a few more rated games.">
              Provisional
            </Badge>
          )}
        </div>
        <div className="border-l border-border px-4 py-3 sm:px-5">
          <div className="text-xs text-muted-foreground">Games</div>
          <div className="mt-0.5 text-xl font-bold tabular-nums">{games}</div>
          <div className="mt-1 text-xs text-muted-foreground tabular-nums">
            {record.wins}W {record.losses}L {record.draws}D
          </div>
        </div>
        <div className="border-l border-border px-4 py-3 sm:px-5">
          <div className="text-xs text-muted-foreground">Win streak</div>
          <div className="mt-0.5 text-xl font-bold tabular-nums">{winStreak}</div>
        </div>
      </div>
      <Link
        href="/leaderboard"
        className="flex items-center gap-2 rounded-b-xl border-t border-border px-4 py-3 text-sm hover:bg-secondary/40 sm:px-5"
      >
        <Trophy className="size-4 text-amber-600" aria-hidden />
        <span className="flex-1">
          {rating?.rank ? (
            <>
              <span className="font-semibold">#{rating.rank}</span> on the leaderboard
            </>
          ) : (
            <span className="text-muted-foreground">Ranked after {LEADERBOARD_MIN_GAMES} rated games</span>
          )}
        </span>
        <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
      </Link>
    </Card>
  );
}
