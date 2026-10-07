import { withUser } from "@/lib/api";
import { checkUsername } from "@/lib/users/service";

export async function GET(req: Request) {
  const username = new URL(req.url).searchParams.get("u") ?? "";
  return withUser((user) => checkUsername(user.id, username));
}
