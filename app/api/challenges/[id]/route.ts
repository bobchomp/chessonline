import { readJson, withPlayer } from "@/lib/api";
import { respondToChallenge } from "@/lib/game/challenges";
import { HttpError } from "@/lib/game/rules";

export async function POST(req: Request, ctx: RouteContext<"/api/challenges/[id]">) {
  const { id } = await ctx.params;
  return withPlayer(async (me) => {
    const body = await readJson(req);
    const action = String(body.action ?? "");
    if (action !== "accept" && action !== "decline") throw new HttpError(400, "Unknown action.");
    const game = await respondToChallenge(me, id, action === "accept");
    return { id: game.id, status: game.status };
  });
}
