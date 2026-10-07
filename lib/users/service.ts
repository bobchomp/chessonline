import { eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { chatMessages, games, profiles, type Profile } from "@/lib/db/schema";
import { getCurrentUser, type CurrentUser } from "@/lib/auth/session";
import { HttpError } from "@/lib/game/rules";
import { nextUsernameChangeAt, usernameError } from "./username";

function isUniqueViolation(err: unknown): boolean {
  for (let e: unknown = err; e && typeof e === "object"; e = (e as { cause?: unknown }).cause) {
    if ((e as { code?: string }).code === "23505") return true;
  }
  return false;
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const [profile] = await getDb().select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
  return profile ?? null;
}

export async function findProfileByUsername(username: string): Promise<Profile | null> {
  const [profile] = await getDb()
    .select()
    .from(profiles)
    .where(sql`lower(${profiles.username}) = lower(${username.trim()})`)
    .limit(1);
  return profile ?? null;
}

export type UsernameCheck = { available: boolean; reason: string | null };

/** Whether `username` could be taken by `userId` (their own current name counts as available). */
export async function checkUsername(userId: string, username: string): Promise<UsernameCheck> {
  const error = usernameError(username);
  if (error) return { available: false, reason: error };
  const owner = await findProfileByUsername(username);
  if (owner && owner.userId !== userId) return { available: false, reason: "That username is taken." };
  return { available: true, reason: null };
}

/**
 * Sets (first time) or changes the user's username. Changes are limited to one
 * every 30 days. Game and chat rows store player names, so they're updated too,
 * which keeps the current username showing everywhere, including old games.
 */
export async function setUsername(userId: string, raw: string, now = new Date()): Promise<Profile> {
  const username = raw.trim();
  const error = usernameError(username);
  if (error) throw new HttpError(400, error);

  const existing = await getProfile(userId);
  if (existing?.username === username) return existing;
  if (existing) {
    const allowedAt = nextUsernameChangeAt(existing.usernameChangedAt);
    if (now < allowedAt) {
      throw new HttpError(
        429,
        `You can change your username again on ${allowedAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}.`,
      );
    }
  }

  const db = getDb();
  try {
    await db.batch([
      db
        .insert(profiles)
        .values({ userId, username, usernameChangedAt: now, createdAt: now })
        .onConflictDoUpdate({ target: profiles.userId, set: { username, usernameChangedAt: now } }),
      db.update(games).set({ whiteName: username }).where(eq(games.whiteId, userId)),
      db.update(games).set({ blackName: username }).where(eq(games.blackId, userId)),
      db.update(games).set({ invitedName: username }).where(eq(games.invitedUserId, userId)),
      db.update(chatMessages).set({ userName: username }).where(eq(chatMessages.userId, userId)),
    ]);
  } catch (err) {
    if (isUniqueViolation(err)) throw new HttpError(409, "That username is taken.");
    throw err;
  }
  return (await getProfile(userId))!;
}

/** A signed-in user who has chosen a username. `name` is their username. */
export type Player = CurrentUser;

/**
 * For actions that involve other people (games, chat, friends): the user must be
 * signed in and have a username. Their username becomes their display name.
 */
export async function requirePlayer(user: CurrentUser): Promise<Player> {
  const profile = await getProfile(user.id);
  if (!profile) throw new HttpError(403, "Choose a username first.");
  return { id: user.id, name: profile.username };
}

export async function getCurrentPlayer(): Promise<Player | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const profile = await getProfile(user.id);
  return profile ? { id: user.id, name: profile.username } : null;
}
