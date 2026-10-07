import { withPlayer } from "@/lib/api";
import { getNotifications } from "@/lib/notifications";

/** Background check-in from every signed-in page: updates "online", returns badges and challenges. */
export async function GET() {
  return withPlayer((me) => getNotifications(me));
}
