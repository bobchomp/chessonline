import { redirect } from "next/navigation";

/** Friends now live on the Play page. */
export default function FriendsPage() {
  redirect("/dashboard#friends");
}
