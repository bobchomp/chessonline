import { readJson, withUser } from "@/lib/api";
import { setUsername } from "@/lib/users/service";

export async function POST(req: Request) {
  return withUser(async (user) => {
    const body = await readJson(req);
    const profile = await setUsername(user.id, String(body.username ?? ""));
    return { username: profile.username };
  });
}
