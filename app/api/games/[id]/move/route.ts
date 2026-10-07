import { readJson, withPlayer } from "@/lib/api";
import { getGameState, makeMove } from "@/lib/game/service";

export async function POST(req: Request, ctx: RouteContext<"/api/games/[id]/move">) {
  const { id } = await ctx.params;
  return withPlayer(async (user) => {
    const body = await readJson(req);
    await makeMove(
      user,
      id,
      {
        from: String(body.from ?? ""),
        to: String(body.to ?? ""),
        promotion: body.promotion ? String(body.promotion) : undefined,
      },
      Number(body.ply),
    );
    return getGameState(user, id, null, Number(body.chatAfter ?? 0) || 0);
  });
}
