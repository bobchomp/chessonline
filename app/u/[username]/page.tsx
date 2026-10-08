import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getProfile } from "@/lib/users/service";
import { getPublicProfile } from "@/lib/friends/service";
import { formatRelative } from "@/lib/game/format";
import { ProfileActions } from "@/components/friends/profile-actions";
import { RatingChart } from "@/components/profile/rating-chart";
import { LEADERBOARD_MIN_GAMES, getRatingHistory, getRatingSummary } from "@/lib/ratings/queries";

export const dynamic = "force-dynamic";

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-lg bg-secondary/60 px-4 py-3 text-center">
      <div className={`text-2xl font-bold ${tone ?? ""}`}>{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
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
  const { record, headToHead } = profile;
  // The stat tiles cover games against people; computer games are listed separately.
  const games = record.wins + record.losses + record.draws;

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              {profile.username}
              {profile.relationship !== "self" && (
                <span
                  className={`inline-block h-2.5 w-2.5 rounded-full ${profile.online ? "bg-emerald-500" : "bg-neutral-300"}`}
                  title={profile.online ? "Online" : "Offline"}
                />
              )}
            </h1>
            <p className="text-sm text-muted-foreground">
              Joined {new Date(profile.joinedAt).toLocaleDateString(undefined, { month: "long", year: "numeric" })}
              {profile.relationship !== "self" && (profile.online ? " · Online now" : "")}
            </p>
          </div>
          <ProfileActions userId={profile.userId} username={profile.username} initial={profile.relationship} />
        </div>

        <div className="mt-6 grid grid-cols-4 gap-2">
          <Stat label="Games" value={games} />
          <Stat label="Wins" value={record.wins} tone="text-emerald-700" />
          <Stat label="Losses" value={record.losses} tone="text-red-600" />
          <Stat label="Draws" value={record.draws} />
        </div>

        {profile.botRecord.wins + profile.botRecord.losses + profile.botRecord.draws > 0 && (
          <p className="mt-4 text-sm text-muted-foreground">
            Against the computer:{" "}
            <span className="font-medium text-foreground">
              {profile.botRecord.wins} W · {profile.botRecord.losses} L · {profile.botRecord.draws} D
            </span>
          </p>
        )}

        {headToHead && (
          <p className="mt-4 text-sm text-muted-foreground">
            Your record against {profile.username}:{" "}
            <span className="font-medium text-foreground">
              {headToHead.wins} W · {headToHead.losses} L · {headToHead.draws} D
            </span>
          </p>
        )}
      </section>

      {rating && (
        <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-sm font-medium text-muted-foreground">Rating</h2>
              <div className="text-4xl font-bold tabular-nums">
                {rating.rating}
                {rating.provisional && <span className="text-muted-foreground">?</span>}
              </div>
              {rating.provisional && (
                <p className="text-xs text-muted-foreground">Provisional: it settles after a few more rated games.</p>
              )}
            </div>
            <dl className="flex gap-6 text-sm">
              <div>
                <dt className="text-muted-foreground">Rated games</dt>
                <dd className="font-semibold tabular-nums">{rating.ratedGames}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Peak</dt>
                <dd className="font-semibold tabular-nums">{rating.peak ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Rank</dt>
                <dd className="font-semibold tabular-nums">
                  {rating.rank !== null ? (
                    <Link href="/leaderboard" className="text-primary hover:underline">
                      #{rating.rank}
                    </Link>
                  ) : (
                    <span title={`Ranked after ${LEADERBOARD_MIN_GAMES} rated games`}>—</span>
                  )}
                </dd>
              </div>
            </dl>
          </div>
          {history.length > 0 ? (
            <div className="mt-5">
              <RatingChart points={history} />
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">No rated games yet. Everyone starts at 1500.</p>
          )}
        </section>
      )}

      <section className="rounded-xl border border-border bg-card shadow-sm">
        <h2 className="border-b border-border px-4 py-3 font-semibold">Recent games</h2>
        {profile.recentGames.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">No finished games yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {profile.recentGames.map((g) => (
              <li key={g.id}>
                <Link href={`/game/${g.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-secondary">
                  <span className="text-xl leading-none">{g.color === "white" ? "♔" : "♚"}</span>
                  <span className="min-w-0 flex-1 truncate">vs {g.opponent ?? "Unknown"}</span>
                  <span className="text-xs text-muted-foreground">{formatRelative(new Date(g.endedAt))}</span>
                  <span
                    className={`w-12 text-right text-sm font-medium ${
                      g.outcome === "win" ? "text-emerald-700" : g.outcome === "loss" ? "text-red-600" : "text-muted-foreground"
                    }`}
                  >
                    {g.outcome === "win" ? "Won" : g.outcome === "loss" ? "Lost" : "Draw"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
