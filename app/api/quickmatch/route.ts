import { readJson, withPlayer } from "@/lib/api";
import { cancelQuickMatch, quickMatch } from "@/lib/game/quickmatch";

/** Check in while searching: returns "searching" or the matched game. */
export async function POST(req: Request) {
  return withPlayer(async (me) => {
    const body = await readJson(req);
    return quickMatch(me, String(body.timeControl ?? ""));
  });
}

export async function DELETE() {
  return withPlayer(async (me) => ({ gameId: await cancelQuickMatch(me) }));
}
