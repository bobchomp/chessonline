import { readJson, withUser } from "@/lib/api";
import { postChat } from "@/lib/game/service";

export async function POST(req: Request, ctx: RouteContext<"/api/games/[id]/chat">) {
  const { id } = await ctx.params;
  return withUser(async (user) => {
    const body = await readJson(req);
    await postChat(user, id, String(body.body ?? ""));
  });
}
