import { readJson, withPlayer } from "@/lib/api";
import { createBotGame } from "@/lib/game/bots";
import type { Color } from "@/lib/db/schema";

export async function POST(req: Request) {
  return withPlayer(async (me) => {
    const body = await readJson(req);
    const game = await createBotGame(me, String(body.botId ?? ""), {
      timeControlId: String(body.timeControl ?? "untimed"),
      color: String(body.color ?? "random") as Color | "random",
      rated: body.rated !== false,
    });
    return { id: game.id };
  });
}
