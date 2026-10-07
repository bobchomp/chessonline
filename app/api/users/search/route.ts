import { withPlayer } from "@/lib/api";
import { searchUsers } from "@/lib/friends/service";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q") ?? "";
  return withPlayer(async (me) => ({ results: await searchUsers(me, q) }));
}
