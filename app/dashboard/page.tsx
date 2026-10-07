import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { listGames } from "@/lib/game/service";
import { NewGameForm } from "@/components/dashboard/new-game-form";
import { JoinGameForm } from "@/components/dashboard/join-game-form";
import { GameList } from "@/components/dashboard/game-list";

// Reads the session cookie, so it must render per request.
export const dynamic = "force-dynamic";

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/sign-in");

  const { pin } = await searchParams;
  const games = await listGames(user.id);
  const ongoing = games.filter((g) => g.status === "waiting" || g.status === "active");
  const history = games.filter((g) => g.status === "finished" || g.status === "aborted");

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-bold">Hi, {user.name}</h1>
      <p className="text-muted-foreground">Start a new game or join a friend&apos;s.</p>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <NewGameForm />
        <JoinGameForm initialPin={typeof pin === "string" ? pin : ""} />
      </div>

      <section className="mt-10">
        <h2 className="mb-3 text-lg font-semibold">Ongoing games</h2>
        <GameList games={ongoing} userId={user.id} empty="No games in progress." />
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-lg font-semibold">History</h2>
        <GameList games={history} userId={user.id} empty="Finished games will show up here." />
      </section>
    </div>
  );
}
