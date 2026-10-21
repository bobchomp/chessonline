import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Bot, ChartLine, ChevronRight, Flame, History, Puzzle, Star, Swords } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { getProfile } from "@/lib/users/service";
import { getPublicProfile } from "@/lib/friends/service";
import { formatRelative } from "@/lib/game/format";
import { ProfileActions } from "@/components/friends/profile-actions";
import { RatingChart } from "@/components/profile/rating-chart";
import { Achievements } from "@/components/profile/achievements";
import { ResultMark } from "@/components/chess/result-mark";
import { SideDot } from "@/components/chess/board-layout";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Page } from "@/components/ui/page";
import { cn } from "@/components/ui/cn";
import { LEADERBOARD_MIN_GAMES, getRatingHistory, getRatingSummary } from "@/lib/ratings/queries";

export const dynamic = "force-dynamic";

/** One figure in the profile header's stat strip. */
function HeaderStat({ label, children, href, className }: { label: string; children: React.ReactNode; href?: string; className?: string }) {
  const body = (
    <>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-lg font-bold tabular-nums">{children}</div>
    </>
  );
  return href ? (
    <Link href={href} className={cn("block border-border px-4 py-3 hover:bg-secondary/40 sm:px-5", className)}>
      {body}
    </Link>
  ) : (
    <div className={cn("border-border px-4 py-3 sm:px-5", className)}>{body}</div>
  );
}

export default async function ProfilePage({ params }: PageProps<"/u/[username]">) {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/sign-in");
  const me = await getProfile(user.id);
  // Without a username the gate popup covers the page anyway.
  if (!me) return null;

  const { username } = await params;
  const profile = await getPublicProfile({ id: user.id, name: me.username }, decodeURIComponent(username));
  if (!profile) notFound();

  const [rating, history] = await Promise.all([getRatingSummary(profile.userId), getRatingHistory(profile.userId)]);
  const { record, headToHead, botRecord, puzzles } = profile;
  const self = profile.relationship === "self";
  // The headline figures cover games against people; computer games are listed separately.
  const games = record.wins + record.losses + record.draws;
  const winRate = games ? Math.round((record.wins / games) * 100) : null;
  const botGames = botRecord.wins + botRecord.losses + botRecord.draws;

  return (
    <Page width="narrow" className="space-y-6">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4 p-4 sm:p-6">
          <div className="flex min-w-0 items-center gap-4">
            <Avatar name={profile.username} size="xl" status={self ? undefined : profile.online ? "online" : "offline"} />
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-bold tracking-tight">{profile.username}</h1>
              <p className="text-sm text-muted-foreground">
                Joined {new Date(profile.joinedAt).toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
                {!self && profile.online && <span className="text-emerald-700"> · Online now</span>}
              </p>
              {headToHead && (
                <p className="mt-1 text-sm">
                  <span className="text-muted-foreground">You vs {profile.username}: </span>
                  <span className="font-medium tabular-nums">
                    {headToHead.wins}W {headToHead.losses}L {headToHead.draws}D
                  </span>
                </p>
              )}
            </div>
          </div>
          <ProfileActions userId={profile.userId} username={profile.username} initial={profile.relationship} />
        </div>

        {/* 2×2 on phones, one row of four on wider screens. */}
        <div className="grid grid-cols-2 border-t border-border sm:grid-cols-4">
          <HeaderStat label="Rating" className="border-r border-b sm:border-b-0">
            <span className="flex items-center gap-2">
              {rating?.rating ?? 1500}
              {rating?.provisional && <Badge title="Settles after a few more rated games">Provisional</Badge>}
            </span>
          </HeaderStat>
          <HeaderStat label="Rank" href="/leaderboard" className="border-b sm:border-r sm:border-b-0">
            {rating?.rank !== null && rating?.rank !== undefined ? (
              `#${rating.rank}`
            ) : (
              <span className="text-sm font-normal text-muted-foreground" title={`Ranked after ${LEADERBOARD_MIN_GAMES} rated games`}>
                Unranked
              </span>
            )}
          </HeaderStat>
          <HeaderStat label="Games" className="border-r">
            {games}
            <span className="ml-1.5 text-xs font-normal text-muted-foreground">
              {record.wins}W {record.losses}L {record.draws}D
            </span>
          </HeaderStat>
          <HeaderStat label="Win rate">{winRate === null ? "–" : `${winRate}%`}</HeaderStat>
        </div>
      </Card>

      {rating && (
        <Card>
          <CardHeader
            title="Rating history"
            icon={<ChartLine />}
            action={
              <dl className="flex gap-5 text-right text-xs">
                <div>
                  <dt className="text-muted-foreground">Rated games</dt>
                  <dd className="text-base font-semibold tabular-nums">{rating.ratedGames}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Peak</dt>
                  <dd className="text-base font-semibold tabular-nums">
                    {rating.peak ?? (
                      <span className="text-sm font-normal text-muted-foreground" title="Recorded once the rating settles.">
                        Not yet
                      </span>
                    )}
                  </dd>
                </div>
              </dl>
            }
          />
          <CardBody>
            {history.length > 0 ? (
              <RatingChart points={history} />
            ) : (
              <p className="text-sm text-muted-foreground">No rated games yet. Everyone starts at 1500.</p>
            )}
          </CardBody>
        </Card>
      )}

      <div className="grid gap-6 sm:grid-cols-2">
        <Card>
          <CardHeader title="Daily puzzles" icon={<Puzzle />} />
          <CardBody className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-lg font-bold tabular-nums">{puzzles.solved}</div>
              <div className="text-xs text-muted-foreground">Solved</div>
            </div>
            <div>
              <div className="flex items-center justify-center gap-1 text-lg font-bold tabular-nums">
                <Star className="size-4 text-amber-500" aria-hidden />
                {puzzles.perfect}
              </div>
              <div className="text-xs text-muted-foreground">First try</div>
            </div>
            <div>
              <div className="flex items-center justify-center gap-1 text-lg font-bold tabular-nums">
                {puzzles.currentStreak > 0 && <Flame className="size-4 text-orange-500" aria-hidden />}
                {puzzles.currentStreak}
              </div>
              <div className="text-xs text-muted-foreground">Streak · best {puzzles.bestStreak}</div>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Against the computer" icon={<Bot />} />
          <CardBody className="grid grid-cols-3 gap-2 text-center">
            {botGames === 0 ? (
              <p className="col-span-3 text-sm text-muted-foreground">No computer games yet.</p>
            ) : (
              <>
                <div>
                  <div className="text-lg font-bold text-emerald-700 tabular-nums">{botRecord.wins}</div>
                  <div className="text-xs text-muted-foreground">Won</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-red-600 tabular-nums">{botRecord.losses}</div>
                  <div className="text-xs text-muted-foreground">Lost</div>
                </div>
                <div>
                  <div className="text-lg font-bold tabular-nums">{botRecord.draws}</div>
                  <div className="text-xs text-muted-foreground">Drawn</div>
                </div>
              </>
            )}
          </CardBody>
        </Card>
      </div>

      <Achievements summary={profile.achievements} />

      <Card>
        <CardHeader
          title="Recent games"
          icon={<History />}
          divider
          action={
            self && profile.recentGames.length > 0 ? (
              <ButtonLink href="/games" variant="ghost" size="sm">
                View all <ChevronRight />
              </ButtonLink>
            ) : undefined
          }
        />
        {profile.recentGames.length === 0 ? (
          <EmptyState icon={<Swords />} title="No finished games yet" />
        ) : (
          <ul className="divide-y divide-border">
            {profile.recentGames.map((g) => (
              <li key={g.id}>
                <Link href={`/game/${g.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/60 sm:px-5">
                  <Avatar name={g.opponent ?? "?"} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">vs {g.opponent ?? "Unknown"}</span>
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <SideDot color={g.color} /> Played {g.color} · {formatRelative(new Date(g.endedAt))}
                    </span>
                  </span>
                  <ResultMark outcome={g.outcome} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </Page>
  );
}
