import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { FriendsClient } from "@/components/friends/friends-client";

export const dynamic = "force-dynamic";

export default async function FriendsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/sign-in");
  return <FriendsClient />;
}
