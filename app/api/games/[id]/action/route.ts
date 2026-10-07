import { readJson, withUser } from "@/lib/api";
import { getGameState, performAction } from "@/lib/game/service";
import { HttpError, type GameAction } from "@/lib/game/rules";

const ACTIONS = new Set<string>([
  "resign",
  "offer_draw",
  "accept_draw",
  "decline_draw",
  "abort",
  "cancel",
  "claim_win",
  "offer_rematch",
  "decline_rematch",
  "accept_rematch",
]);

export async function POST(req: Request, ctx: RouteContext<"/api/games/[id]/action">) {
  const { id } = await ctx.params;
  return withUser(async (user) => {
    const body = await readJson(req);
    const action = String(body.action ?? "");
    if (!ACTIONS.has(action)) throw new HttpError(400, "Unknown action.");
    await performAction(user, id, action as GameAction | "accept_rematch");
    return getGameState(user, id, null, Number(body.chatAfter ?? 0) || 0);
  });
}
