"use client";

import { authClient } from "@/lib/auth/client";

/** Whether someone is signed in. `pending` while the session is still loading. */
export function useSignedIn(): { signedIn: boolean; pending: boolean } {
  const { data, isPending } = authClient.useSession();
  return { signedIn: !!data?.user, pending: isPending };
}

export async function signOut(): Promise<void> {
  await authClient.signOut();
}
