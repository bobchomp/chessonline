import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getGameState } from "@/lib/game/service";
import { HttpError } from "@/lib/game/rules";
import type { GameView } from "@/lib/game/view";
import { GameClient } from "@/components/game/game-client";

// Reads the session cookie, so it must render per request.
export const dynamic = "force-dynamic";

export default async function GamePage({ params }: PageProps<"/game/[id]">) {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/sign-in");
  const { id } = await params;

  let initial: GameView;
  try {
    initial = (await getGameState(user, id, null, 0)) as GameView;
  } catch (err) {
    if (err instanceof HttpError && err.status === 404) notFound();
    throw err;
  }

  return <GameClient key={id} initial={initial} userId={user.id} />;
}
