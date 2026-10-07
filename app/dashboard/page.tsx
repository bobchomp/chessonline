import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { listGames } from "@/lib/game/service";
import { getProfile } from "@/lib/users/service";
import { NewGameForm } from "@/components/dashboard/new-game-form";
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
      <p className="text-muted-foreground">Start a new game, join with a PIN, or challenge a friend.</p>

      {/* DOM order (forms, friends, games) is the phone layout; on desktop friends sit in a side column. */}
      <div className="mt-6 grid gap-x-6 gap-y-10 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid min-w-0 gap-6 md:grid-cols-2 lg:col-start-1 lg:row-start-1">
          <NewGameForm />
          <JoinGameForm initialPin={typeof pin === "string" ? pin : ""} />
        </div>

        <aside className="self-start lg:sticky lg:top-6 lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <FriendsPanel />
        </aside>

        <div className="min-w-0 space-y-10 lg:col-start-1 lg:row-start-2">
          <section>
            <h2 className="mb-3 text-lg font-semibold">Ongoing games</h2>
            <GameList games={ongoing} userId={user.id} empty="No games in progress." />
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">History</h2>
            <GameList games={history} userId={user.id} empty="Finished games will show up here." />
          </section>
        </div>
      </div>
    </div>
  );
}
