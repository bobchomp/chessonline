import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Medal, Trophy, Users } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { getProfile } from "@/lib/users/service";
import { LEADERBOARD_MIN_GAMES, getLeaderboard, getRatingHistories, getRatingSummary } from "@/lib/ratings/queries";
import { RatingChart } from "@/components/profile/rating-chart";
import { RatingText } from "@/components/chess/result-mark";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";
import { EmptyState } from "@/components/ui/empty-state";
import { Page, PageHeader } from "@/components/ui/page";
import { SegmentedLinks } from "@/components/ui/segmented";

/** How many recent rated games each player's mini chart covers. */
const CHART_GAMES = 30;

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Leaderboard · Chess Online" };

const MEDAL = ["text-amber-500", "text-neutral-400", "text-orange-700"];

export default async function LeaderboardPage({ searchParams }: PageProps<"/leaderboard">) {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/sign-in");
  const me = await getProfile(user.id);
  if (!me) return null; // the username gate covers the page

  const { scope: raw } = await searchParams;
  const scope = raw === "friends" ? "friends" : "all";
  const [rows, mine] = await Promise.all([getLeaderboard(user.id, scope), getRatingSummary(user.id)]);
  const histories = await getRatingHistories(
    rows.map((r) => r.userId),
    CHART_GAMES,
  );
  const gamesToGo = mine ? Math.max(0, LEADERBOARD_MIN_GAMES - mine.ratedGames) : LEADERBOARD_MIN_GAMES;

  return (
    <Page width="narrow">
      <PageHeader
        title="Leaderboard"
        description={`The top 10 by rating. Players appear after ${LEADERBOARD_MIN_GAMES} rated games.`}
        actions={
          <SegmentedLinks
            label="Leaderboard scope"
            options={[
              { href: "/leaderboard", label: "Everyone", active: scope === "all", icon: <Trophy /> },
              { href: "/leaderboard?scope=friends", label: "Friends", active: scope === "friends", icon: <Users /> },
            ]}
          />
        }
      />

      {mine && (
        <Card className="mb-4 flex items-center gap-3 px-4 py-3 sm:px-5">
          <Avatar name={me.username} size="md" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold">Your rating</div>
            <div className="text-xs text-muted-foreground">
              {mine.rank !== null
                ? `#${mine.rank} overall`
                : `Play ${gamesToGo} more rated game${gamesToGo === 1 ? "" : "s"} to be ranked`}
            </div>
          </div>
          {mine.provisional && <Badge title="Your rating settles after a few more rated games.">Provisional</Badge>}
          <span className="text-2xl font-bold tabular-nums">{mine.rating}</span>
        </Card>
      )}

      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState
            icon={<Trophy />}
            title={scope === "friends" ? "None of your friends are ranked yet" : "Nobody is ranked yet"}
            description={
              scope === "friends"
                ? "Rated games against each other or the computer count."
                : "Play some rated games to be the first on the board."
            }
          />
        ) : (
          <ol className="divide-y divide-border">
            {rows.map((r) => {
              const history = histories.get(r.userId) ?? [];
              const you = r.userId === user.id;
              return (
                <li key={r.userId} className={cn(you && "bg-primary/[0.05]")}>
                  <Link href={`/u/${encodeURIComponent(r.username)}`} className="block px-4 py-3 hover:bg-secondary/50 sm:px-5">
                    <div className="flex items-center gap-3">
                      <span className="flex w-7 shrink-0 justify-center text-sm font-semibold text-muted-foreground tabular-nums">
                        {r.rank <= 3 ? <Medal className={cn("size-5", MEDAL[r.rank - 1])} aria-label={`#${r.rank}`} /> : r.rank}
                      </span>
                      <Avatar name={r.username} size="sm" />
                      <span className="min-w-0 flex-1 truncate font-medium">
                        {r.username}
                        {you && <span className="ml-1.5 text-xs font-normal text-muted-foreground">(you)</span>}
                      </span>
                      <span className="hidden text-xs text-muted-foreground tabular-nums sm:inline">{r.ratedGames} games</span>
                      <RatingText rating={r.rating} provisional={r.provisional} className="w-16 text-right text-lg font-bold" />
                    </div>
                    <div className="mt-1 pl-[5.5rem]">
                      {history.length > 1 ? (
                        <RatingChart points={history} compact />
                      ) : (
                        <p className="py-1 text-xs text-muted-foreground">Not enough rated games for a chart yet.</p>
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ol>
        )}
      </Card>
      <p className="mt-3 text-xs text-muted-foreground">A ? after a rating means it&apos;s provisional: still settling after the first few games.</p>
    </Page>
  );
}
