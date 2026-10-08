import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getProfile } from "@/lib/users/service";
import { LEADERBOARD_MIN_GAMES, getLeaderboard, getRatingHistories, getRatingSummary } from "@/lib/ratings/queries";
import { RatingChart } from "@/components/profile/rating-chart";
import { BackButton } from "@/components/back-button";

/** How many recent rated games each player's mini chart covers. */
const CHART_GAMES = 30;

export const dynamic = "force-dynamic";

const SCOPES = [
  { id: "all", label: "Everyone" },
  { id: "friends", label: "Friends" },
] as const;

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
    <div className="relative mx-auto max-w-6xl px-4 py-8">
      {/* Phones: above the heading. Wide screens: in the left margin, lined up with the logo. */}
      <BackButton className="mb-4 lg:absolute lg:top-8 lg:left-4 lg:mb-0" />
      <div className="mx-auto max-w-3xl">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Leaderboard</h1>
            <p className="text-muted-foreground">
              The top 10 by Glicko-2 rating. Players appear after {LEADERBOARD_MIN_GAMES} rated games.
            </p>
          </div>
          <nav aria-label="Leaderboard scope" className="flex rounded-lg bg-secondary p-1 text-sm">
            {SCOPES.map((s) => (
              <Link
                key={s.id}
                href={s.id === "all" ? "/leaderboard" : "/leaderboard?scope=friends"}
                aria-current={scope === s.id ? "page" : undefined}
                className={`rounded-md px-3 py-1.5 font-medium transition ${
                  scope === s.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {s.label}
              </Link>
            ))}
          </nav>
        </div>

        {mine && (
          <p className="mt-4 rounded-lg bg-secondary/60 px-4 py-3 text-sm">
            Your rating:{" "}
            <span className="font-semibold tabular-nums">
              {mine.rating}
              {mine.provisional && "?"}
            </span>
            {mine.rank !== null
              ? ` · #${mine.rank} overall`
              : ` · play ${gamesToGo} more rated game${gamesToGo === 1 ? "" : "s"} to be ranked`}
            {mine.provisional && <span className="text-muted-foreground"> · {'"?" means it\'s still settling'}</span>}
          </p>
        )}

        {rows.length === 0 ? (
          <p className="mt-6 rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
            {scope === "friends"
              ? "None of your friends are ranked yet. Rated games against each other or the computer count."
              : "Nobody is ranked yet. Play some rated games to be the first!"}
          </p>
        ) : (
          <ol className="mt-6 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            {rows.map((r) => {
              const history = histories.get(r.userId) ?? [];
              return (
                <li key={r.userId} className={r.userId === user.id ? "bg-primary/10" : undefined}>
                  <Link
                    href={`/u/${encodeURIComponent(r.username)}`}
                    className="flex items-center gap-4 px-4 pt-3 pb-1 hover:bg-secondary"
                  >
                    <span
                      className={`w-8 text-right text-sm font-semibold tabular-nums ${
                        r.rank <= 3 ? "text-primary" : "text-muted-foreground"
                      }`}
                    >
                      {r.rank <= 3 ? ["🥇", "🥈", "🥉"][r.rank - 1] : r.rank}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {r.username}
                      {r.userId === user.id && <span className="ml-1.5 text-xs text-muted-foreground">(you)</span>}
                    </span>
                    <span className="text-xs text-muted-foreground tabular-nums">{r.ratedGames} games</span>
                    <span className="w-16 text-right font-semibold tabular-nums">
                      {r.rating}
                      {r.provisional && "?"}
                    </span>
                  </Link>
                  <div className="pr-4 pb-2 pl-14">
                    {history.length > 1 ? (
                      <RatingChart points={history} compact />
                    ) : (
                      <p className="py-2 text-xs text-muted-foreground">Not enough rated games for a chart yet.</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}
