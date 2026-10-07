import { withPlayer } from "@/lib/api";
import { checkIn } from "@/lib/friends/service";

/** Background check-in from every signed-in page: updates "online" and returns badge counts. */
export async function GET() {
  return withPlayer((me) => checkIn(me));
}
