import { NextResponse, type NextRequest } from "next/server";
import { getAuth } from "@/lib/auth/server";

const LOGIN_PATH = "/auth/sign-in";
let neonAuth: ReturnType<ReturnType<typeof getAuth>["middleware"]> | undefined;

export default async function proxy(request: NextRequest) {
  neonAuth ??= getAuth().middleware({ loginUrl: LOGIN_PATH });
  const response = await neonAuth(request);

  // Neon Auth redirects signed-out visitors to the login page but forgets where
  // they were going. Add `redirectTo` (read by the sign-in UI) so that, e.g., an
  // invite link `/dashboard?pin=123456` still works after signing in.
  const location = response.headers.get("location");
  if (location && new URL(location, request.url).pathname === LOGIN_PATH) {
    const loginUrl = new URL(LOGIN_PATH, request.url);
    loginUrl.searchParams.set("redirectTo", request.nextUrl.pathname + request.nextUrl.search);
    const redirect = NextResponse.redirect(loginUrl, response.status);
    for (const cookie of response.headers.getSetCookie()) redirect.headers.append("set-cookie", cookie);
    return redirect;
  }
  return response;
}

export const config = {
  // Pages that require a signed-in user. API routes check the session themselves
  // so they can answer with JSON instead of a redirect.
  matcher: ["/dashboard/:path*", "/game/:path*", "/account/:path*", "/friends/:path*", "/u/:path*", "/leaderboard/:path*"],
};
