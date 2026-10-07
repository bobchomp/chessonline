import { withPlayer } from "@/lib/api";
import { relationshipWith } from "@/lib/friends/service";
import { HttpError } from "@/lib/game/rules";

export async function GET(_req: Request, ctx: RouteContext<"/api/users/[id]/relationship">) {
  const { id } = await ctx.params;
  return withPlayer(async (me) => {
    const relationship = await relationshipWith(me.id, id);
    if (!relationship) throw new HttpError(404, "User not found.");
    return { relationship };
  });
}
