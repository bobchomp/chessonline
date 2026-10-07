import { readJson, withUser } from "@/lib/api";
import { joinByPin } from "@/lib/game/service";

export async function POST(req: Request) {
  return withUser(async (user) => {
    const body = await readJson(req);
    const game = await joinByPin(user, String(body.pin ?? ""));
    return { id: game.id };
  });
}
