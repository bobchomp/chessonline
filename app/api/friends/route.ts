import { readJson, withPlayer } from "@/lib/api";
import { friendAction, friendsOverview, type FriendAction } from "@/lib/friends/service";
import { HttpError } from "@/lib/game/rules";

const ACTIONS = new Set<FriendAction>(["request", "accept", "decline", "cancel", "remove", "block", "unblock"]);

export async function GET() {
  return withPlayer((me) => friendsOverview(me));
}

export async function POST(req: Request) {
  return withPlayer(async (me) => {
    const body = await readJson(req);
    const action = String(body.action ?? "") as FriendAction;
    const userId = String(body.userId ?? "");
    if (!ACTIONS.has(action)) throw new HttpError(400, "Unknown action.");
    if (!userId) throw new HttpError(400, "Missing userId.");
    return { relationship: await friendAction(me, action, userId) };
  });
}
