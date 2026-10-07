import { withUser } from "@/lib/api";
import { getGameState } from "@/lib/game/service";

export async function GET(req: Request, ctx: RouteContext<"/api/games/[id]">) {
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const v = url.searchParams.get("v");
  const chatAfter = Number(url.searchParams.get("chatAfter") ?? 0);
  return withUser((user) =>
    getGameState(user, id, v ? Number(v) : null, Number.isFinite(chatAfter) ? chatAfter : 0),
  );
}
