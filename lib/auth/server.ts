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
      throw new Error("NEON_AUTH_BASE_URL and NEON_AUTH_COOKIE_SECRET must be set.");
    }
    instance = createNeonAuth({ baseUrl, cookies: { secret } });
  }
  return instance;
}
