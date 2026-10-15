import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getGameState } from "@/lib/game/service";
import { HttpError } from "@/lib/game/rules";
import type { GameView } from "@/lib/game/view";
import { GameReview } from "@/components/review/game-review";

export const dynamic = "force-dynamic";

export default async function ReviewPage({ params }: PageProps<"/game/[id]/review">) {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/sign-in");
  const { id } = await params;

  let game: GameView;
  try {
    game = (await getGameState(user, id, null, 0)) as GameView;
  } catch (err) {
    if (err instanceof HttpError && err.status === 404) notFound();
    throw err;
  }
  // Only finished games with some moves can be reviewed.
  if (game.status !== "finished" || game.moves.length < 2) redirect(`/game/${id}`);

  return <GameReview game={game} />;
}
