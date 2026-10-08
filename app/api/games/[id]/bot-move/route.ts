import { readJson, withPlayer } from "@/lib/api";
import { playBotMove } from "@/lib/game/bots";
import { getGameState } from "@/lib/game/service";

export async function POST(req: Request, ctx: RouteContext<"/api/games/[id]/bot-move">) {
  const { id } = await ctx.params;
  return withPlayer(async (me) => {
    const body = await readJson(req);
    await playBotMove(
      me,
      id,
      {
        from: String(body.from ?? ""),
        to: String(body.to ?? ""),
        promotion: body.promotion ? String(body.promotion) : undefined,
      },
      Number(body.ply),
    );
    return getGameState(me, id, null, Number(body.chatAfter ?? 0) || 0);
  });
}
