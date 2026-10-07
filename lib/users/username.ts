export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;
export const USERNAME_CHANGE_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;

const RESERVED = new Set([
  "admin",
  "administrator",
  "anonymous",
  "api",
  "auth",
  "chess",
  "chessonline",
  "dashboard",
  "friends",
  "game",
  "help",
  "me",
  "mod",
  "moderator",
  "null",
  "official",
  "root",
  "settings",
  "staff",
  "support",
  "system",
  "undefined",
]);

/** Returns an error message, or null when the username is acceptable. */
export function usernameError(raw: string): string | null {
  const name = raw.trim();
  if (name.length < USERNAME_MIN) return `Usernames must be at least ${USERNAME_MIN} characters.`;
  if (name.length > USERNAME_MAX) return `Usernames can be at most ${USERNAME_MAX} characters.`;
  if (!/^[A-Za-z0-9_]+$/.test(name)) return "Use only letters, numbers and underscores.";
  if (RESERVED.has(name.toLowerCase())) return "That username is reserved.";
  return null;
}

/** When a user who last changed their username at `changedAt` may change it again. */
export function nextUsernameChangeAt(changedAt: Date): Date {
  return new Date(changedAt.getTime() + USERNAME_CHANGE_COOLDOWN_MS);
}
