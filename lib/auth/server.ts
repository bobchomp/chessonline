import { createNeonAuth, type NeonAuth } from "@neondatabase/auth/next/server";

let instance: NeonAuth | undefined;

/**
 * Lazily-created Neon Auth instance. Creating it validates the env vars, so doing
 * it at import time would break `next build` wherever the secrets aren't present
 * (Next loads every route module while collecting page data).
 */
export function getAuth(): NeonAuth {
  if (!instance) {
    const baseUrl = process.env.NEON_AUTH_BASE_URL;
    const secret = process.env.NEON_AUTH_COOKIE_SECRET;
    if (!baseUrl || !secret) {
      const missing = [!baseUrl && "NEON_AUTH_BASE_URL", !secret && "NEON_AUTH_COOKIE_SECRET"].filter(Boolean);
      // Names only, never values: helps spot env vars that exist under a different name.
      const related = Object.keys(process.env)
        .filter((k) => /NEON|AUTH|DATABASE|POSTGRES|^PG/i.test(k))
        .sort();
      throw new Error(
        `Missing env var(s): ${missing.join(", ")}. ` +
          `Related env var names visible at runtime: ${related.join(", ") || "(none)"}. ` +
          `VERCEL_ENV=${process.env.VERCEL_ENV ?? "(unset)"}.`,
      );
    }
    instance = createNeonAuth({ baseUrl, cookies: { secret } });
  }
  return instance;
}
