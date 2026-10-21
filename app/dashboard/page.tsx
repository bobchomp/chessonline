import { redirect } from "next/navigation";
import { ChevronRight, History, Swords } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { listGames } from "@/lib/game/service";
import { getProfile } from "@/lib/users/service";
import { getRatingSummary } from "@/lib/ratings/queries";
import { computeAchievements } from "@/lib/achievements";
import { computePuzzleStats, outcomeOf, utcDay } from "@/lib/puzzles/logic";
import { getDailyPuzzle, getPuzzleRecords } from "@/lib/puzzles/service";
import { StartGame } from "@/components/dashboard/start-game";
import { GameList, isMyMove, outcomeFor } from "@/components/dashboard/game-list";
import { PuzzleCard } from "@/components/dashboard/puzzle-card";
import { YouCard } from "@/components/dashboard/you-card";
import { FriendsPanel } from "@/components/friends/friends-panel";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Page, PageHeader } from "@/components/ui/page";

// Reads the session cookie, so it must render per request.
export const dynamic = "force-dynamic";

const RECENT = 5;

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/sign-in");

  const { pin } = await searchParams;
  const [games, profile, rating, puzzleRecords] = await Promise.all([
    listGames(user.id),
    getProfile(user.id),
    getRatingSummary(user.id),
    getPuzzleRecords(user.id),
  ]);
  const today = utcDay();
  const name = profile?.username ?? user.name;

  // Games waiting on you come first.
  const ongoing = games
    .filter((g) => g.status === "waiting" || g.status === "active")
    .sort((a, b) => Number(isMyMove(b, user.id)) - Number(isMyMove(a, user.id)));
  const yourMove = ongoing.filter((g) => isMyMove(g, user.id)).length;
  const history = games.filter((g) => g.status === "finished" || g.status === "aborted");

  const finished = games.filter((g) => g.status === "finished");
  const record = { wins: 0, losses: 0, draws: 0 };
  for (const g of finished) {
    const o = outcomeFor(g, user.id);
    if (o === "win") record.wins++;
    else if (o === "loss") record.losses++;
    else if (o === "draw") record.draws++;
  }
  const { currentStreak } = computeAchievements(
    user.id,
    finished.map((g) => ({ ...g, endedAt: g.endedAt ?? g.updatedAt })),
    null,
  );

  return (
    <Page>
      <PageHeader
        title={`Welcome back, ${name}`}
        description={yourMove > 0 ? `It's your move in ${yourMove} ${yourMove === 1 ? "game" : "games"}.` : "Start a game, solve today's puzzle, or challenge a friend."}
      />

      {/* DOM order is the phone layout; on desktop the side column sits on the right. */}
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6 lg:col-start-1 lg:row-start-1">
          {ongoing.length > 0 && (
            <Card>
              <CardHeader
                title={
                  <>
                    Ongoing games <Badge>{ongoing.length}</Badge>
                  </>
                }
                icon={<Swords />}
                divider
              />
              <GameList games={ongoing} userId={user.id} />
            </Card>
          )}
          <StartGame initialPin={typeof pin === "string" ? pin : ""} />
        </div>

        <aside className="min-w-0 space-y-6 lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <YouCard username={name} rating={rating} record={record} winStreak={currentStreak} />
          <PuzzleCard
            puzzle={getDailyPuzzle(today)}
            outcome={outcomeOf(puzzleRecords.find((r) => r.day === today))}
            stats={computePuzzleStats(puzzleRecords, today)}
          />
          <FriendsPanel />
        </aside>

        <Card className="lg:col-start-1 lg:row-start-2">
          <CardHeader
            title="Recent games"
            icon={<History />}
            divider
            action={
              history.length > 0 ? (
                <ButtonLink href="/games" variant="ghost" size="sm">
                  View all <ChevronRight />
                </ButtonLink>
              ) : undefined
            }
          />
          {history.length === 0 ? (
            <EmptyState icon={<History />} title="No finished games yet" description="Your games will show up here once they're over." />
          ) : (
            <GameList games={history.slice(0, RECENT)} userId={user.id} />
          )}
        </Card>
      </div>
    </Page>
  );
}
