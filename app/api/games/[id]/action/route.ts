import { readJson, withPlayer } from "@/lib/api";
import { getGameState, loadGame, performAction } from "@/lib/game/service";
import { isBotGame, rematchBotGame } from "@/lib/game/bots";
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
  return withPlayer(async (user) => {
    const body = await readJson(req);
    const action = String(body.action ?? "");
    if (!ACTIONS.has(action)) throw new HttpError(400, "Unknown action.");
    if ((action === "offer_rematch" || action === "accept_rematch") && isBotGame(await loadGame(id))) {
      await rematchBotGame(user, id);
    } else {
      await performAction(user, id, action as GameAction | "accept_rematch");
    }
    return getGameState(user, id, null, Number(body.chatAfter ?? 0) || 0);
  });
}
