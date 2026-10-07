import { auth } from "./server";

export type CurrentUser = {
  id: string;
  name: string;
};

/** Returns the signed-in user, or null when there is no valid session. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const { data: session } = await auth.getSession();
  const user = session?.user;
  if (!user) return null;
  const name = user.name?.trim() || user.email?.split("@")[0] || "Player";
  return { id: user.id, name: name.slice(0, 40) };
}
