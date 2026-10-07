import { NextResponse } from "next/server";
import { getCurrentUser, type CurrentUser } from "@/lib/auth/session";
import { HttpError } from "@/lib/game/rules";
import { requirePlayer, type Player } from "@/lib/users/service";

/** Runs a route handler for a signed-in user and turns errors into JSON responses. */
export async function withUser(fn: (user: CurrentUser) => Promise<unknown>): Promise<Response> {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
    const data = await fn(user);
    return NextResponse.json(data ?? { ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    if (err instanceof HttpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error(err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}

/** Like `withUser`, but the user must also have chosen a username. */
export async function withPlayer(fn: (player: Player) => Promise<unknown>): Promise<Response> {
  return withUser(async (user) => fn(await requirePlayer(user)));
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    return body && typeof body === "object" ? body : {};
  } catch {
    throw new HttpError(400, "Invalid JSON body.");
  }
}
