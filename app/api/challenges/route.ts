import { readJson, withPlayer } from "@/lib/api";
import { createChallenge } from "@/lib/game/challenges";
import type { Color } from "@/lib/db/schema";

export async function POST(req: Request) {
  return withPlayer(async (me) => {
    const body = await readJson(req);
    const game = await createChallenge(me, String(body.friendId ?? ""), {
      timeControlId: String(body.timeControl ?? "untimed"),
      color: String(body.color ?? "random") as Color | "random",
      rated: body.rated !== false,
    });
    return { id: game.id };
  });
}
