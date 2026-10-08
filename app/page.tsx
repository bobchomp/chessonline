import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";

// Reads the session cookie, so it must render per request.
export const dynamic = "force-dynamic";

export default async function Home() {
  // Signed-in players go straight to the Play page; this page is for visitors.
  if (await getCurrentUser()) redirect("/dashboard");

  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center px-4 py-20 text-center">
      <div className="mb-6 text-7xl text-primary">♔</div>
      <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Play chess with a friend</h1>
      <p className="mt-4 max-w-xl text-lg text-muted-foreground">
        Create a game, send your friend the 6-digit PIN, and play in your browser. No downloads.
      </p>

      <div className="mt-10 flex flex-wrap justify-center gap-3">
        <Link
          href="/auth/sign-up"
          className="rounded-lg bg-primary px-6 py-3 font-semibold text-primary-foreground hover:opacity-90"
        >
          Create an account
        </Link>
        <Link
          href="/auth/sign-in"
          className="rounded-lg border border-border px-6 py-3 font-semibold hover:bg-secondary"
        >
          Sign in
        </Link>
      </div>

      <ol className="mt-16 grid w-full gap-4 text-left sm:grid-cols-3">
        {[
          ["1", "Create a game", "Pick a time control and your color."],
          ["2", "Share the PIN", "Your friend enters the 6-digit PIN to join."],
          ["3", "Play", "Moves sync live, with clocks, chat, and rematches."],
        ].map(([n, title, body]) => (
          <li key={n} className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="text-sm font-semibold text-primary">Step {n}</div>
            <div className="mt-1 font-semibold">{title}</div>
            <div className="mt-1 text-sm text-muted-foreground">{body}</div>
          </li>
        ))}
      </ol>
    </div>
  );
}
