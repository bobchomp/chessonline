import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { listGames } from "@/lib/game/service";
import { getProfile } from "@/lib/users/service";
import { StartGame } from "@/components/dashboard/start-game";
import { JoinGameForm } from "@/components/dashboard/join-game-form";
import { GameList } from "@/components/dashboard/game-list";
import { FriendsPanel } from "@/components/friends/friends-panel";

// Reads the session cookie, so it must render per request.
export const dynamic = "force-dynamic";

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/sign-in");

  const { pin } = await searchParams;
  const [games, profile] = await Promise.all([listGames(user.id), getProfile(user.id)]);
  const ongoing = games.filter((g) => g.status === "waiting" || g.status === "active");
  const history = games.filter((g) => g.status === "finished" || g.status === "aborted");

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-bold">Hi, {profile?.username ?? user.name}</h1>
      <p className="text-muted-foreground">Start a game, join one with a PIN, or challenge a friend.</p>

      {/* DOM order (start, join + friends, games) is the phone layout; on desktop join + friends sit in a side column. */}
      <div className="mt-6 grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 lg:col-start-1 lg:row-start-1">
          <StartGame />
        </div>

        <aside className="space-y-6 lg:sticky lg:top-6 lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <JoinGameForm initialPin={typeof pin === "string" ? pin : ""} />
          <FriendsPanel />
        </aside>

        <div className="min-w-0 space-y-8 lg:col-start-1 lg:row-start-2">
          <GameSection title="Ongoing games" count={ongoing.length}>
            <GameList games={ongoing} userId={user.id} empty="No games in progress." />
          </GameSection>
          <GameSection title="History" count={history.length}>
            <GameList games={history} userId={user.id} empty="Finished games will show up here." limit={8} />
          </GameSection>
        </div>
      </div>
    </div>
  );
}

function GameSection({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold">
        {title}
        {count > 0 && (
          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground">{count}</span>
        )}
      </h2>
      {children}
    </section>
  );
}
