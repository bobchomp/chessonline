import { withUser } from "@/lib/api";
import { getProfile } from "@/lib/users/service";
import { nextUsernameChangeAt } from "@/lib/users/username";

export type MeResponse = {
  id: string;
  username: string | null;
  /** ISO date when the username may next be changed (null if it can be changed now). */
  canChangeUsernameAt: string | null;
};

export async function GET() {
  return withUser(async (user): Promise<MeResponse> => {
    const profile = await getProfile(user.id);
    const nextChange = profile ? nextUsernameChangeAt(profile.usernameChangedAt) : null;
    return {
      id: user.id,
      username: profile?.username ?? null,
      canChangeUsernameAt: nextChange && nextChange > new Date() ? nextChange.toISOString() : null,
    };
  });
}
