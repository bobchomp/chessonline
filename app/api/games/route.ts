import { readJson, withUser } from "@/lib/api";
import { createGame } from "@/lib/game/service";
import type { Color } from "@/lib/db/schema";

export async function POST(req: Request) {
  return withUser(async (user) => {
    const body = await readJson(req);
    const game = await createGame(user, {
      timeControlId: String(body.timeControl ?? "untimed"),
      color: String(body.color ?? "random") as Color | "random",
    });
    return { id: game.id, pin: game.pin };
  });
}
