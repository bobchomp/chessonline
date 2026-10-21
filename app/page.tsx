import { ArrowRight, Bot, ChartLine, Puzzle, Sparkles, Trophy, Users, Zap } from "lucide-react";
import { HeroBoard } from "@/components/landing/hero-board";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";

// Reads the session cookie, so it must render per request.
export const dynamic = "force-dynamic";

export default async function Home() {
  // Signed-in players go straight to the Play page; this page is for visitors.
  let signedIn: boolean;
  try {
    signedIn = (await getCurrentUser()) !== null;
  } catch {
    // A session that needs refreshing makes Neon Auth set a cookie, which a page
    // can't do. /dashboard goes through the proxy, which refreshes it (or sends a
    // signed-out visitor to sign in).
    signedIn = true;
  }
  if (signedIn) redirect("/dashboard");

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <section className="grid items-center gap-10 py-12 sm:py-16 lg:grid-cols-[1.1fr_1fr] lg:gap-16 lg:py-20">
        <div className="text-center lg:text-left">
          <Badge tone="primary" className="mb-4">
            <Sparkles /> Free · No downloads · No ads
          </Badge>
          <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl">Play chess online, your way</h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground lg:mx-0">
            Challenge a friend with a 6-digit PIN, find an opponent near your rating, or take on the computer. Then
            review your game with Stockfish and keep sharp with a daily puzzle.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3 lg:justify-start">
            <ButtonLink href="/auth/sign-up" size="lg">
              Create a free account <ArrowRight />
            </ButtonLink>
            <ButtonLink href="/auth/sign-in" size="lg" variant="outline">
              Sign in
            </ButtonLink>
          </div>
        </div>
        <div className="mx-auto w-full max-w-md lg:max-w-none">
          <HeroBoard />
        </div>
      </section>

      <section className="border-t border-border py-12 sm:py-16">
        <h2 className="text-center text-2xl font-bold tracking-tight">Everything in one place</h2>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <li key={title}>
              <Card className="h-full p-5">
                <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="size-5" aria-hidden />
                </span>
                <h3 className="mt-4 font-semibold">{title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{body}</p>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-16 rounded-2xl bg-primary px-6 py-10 text-center text-primary-foreground sm:px-10">
        <h2 className="text-2xl font-bold tracking-tight">Ready for a game?</h2>
        <p className="mt-2 text-primary-foreground/80">It takes a few seconds to sign up, then you&apos;re on the board.</p>
        <ButtonLink href="/auth/sign-up" size="lg" variant="secondary" className="mt-6 bg-white text-foreground hover:bg-white/90">
          Create a free account
        </ButtonLink>
      </section>
    </div>
  );
}

const FEATURES = [
  { icon: Users, title: "Play your friends", body: "Share a 6-digit PIN or challenge someone from your friends list, with chat and rematches." },
  { icon: Zap, title: "Quick match", body: "Pick a time control and get paired with someone online near your rating." },
  { icon: Bot, title: "Eight computer opponents", body: "From a beginner who moves at random to full-strength Stockfish." },
  { icon: Puzzle, title: "Daily puzzle", body: "A new puzzle every day, getting harder through the week. Keep your streak going." },
  { icon: ChartLine, title: "Game review", body: "Accuracy, mistakes explained, key moments and the best lines, after every game." },
  { icon: Trophy, title: "Ratings and leaderboard", body: "Every game is rated. Climb the leaderboard and earn achievements." },
];
