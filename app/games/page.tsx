import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { listGames } from "@/lib/game/service";
import { isBotId } from "@/lib/bots/definitions";
import { colorOf } from "@/lib/game/rules";
import { GroupedGameList, outcomeFor } from "@/components/dashboard/game-list";
import { SPEED_ICON, speedFor, type Speed } from "@/components/chess/speed";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";
import { Page, PageHeader } from "@/components/ui/page";
import { SegmentedLinks } from "@/components/ui/segmented";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Game history · Chess Online" };

const PER_PAGE = 30;
const RESULTS = [
  { value: "all", label: "All" },
  { value: "win", label: "Won" },
  { value: "loss", label: "Lost" },
  { value: "draw", label: "Drawn" },
] as const;
const SPEEDS: Speed[] = ["Bullet", "Blitz", "Rapid", "Classical", "Daily", "Untimed"];
const OPPONENTS = [
  { value: "all", label: "Everyone" },
  { value: "people", label: "People" },
  { value: "computer", label: "Computer" },
] as const;

type Filters = { result: string; speed: string; vs: string; page: number };

function href(f: Filters, change: Partial<Filters>): string {
  const next = { ...f, page: 1, ...change };
  const q = new URLSearchParams();
  if (next.result !== "all") q.set("result", next.result);
  if (next.speed !== "all") q.set("speed", next.speed);
  if (next.vs !== "all") q.set("vs", next.vs);
  if (next.page > 1) q.set("page", String(next.page));
  const s = q.toString();
  return s ? `/games?${s}` : "/games";
}

function Chip({ href: to, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={to}
      aria-current={active ? "true" : undefined}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm font-medium whitespace-nowrap transition-colors [&_svg]:size-3.5",
        active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}

/** Every finished game, newest first, with filters. */
export default async function GamesPage({ searchParams }: PageProps<"/games">) {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/sign-in");
  const sp = await searchParams;
  const pick = (k: string, allowed: readonly string[]) => {
    const v = typeof sp[k] === "string" ? (sp[k] as string) : "all";
    return allowed.includes(v) ? v : "all";
  };
  const f: Filters = {
    result: pick("result", RESULTS.map((r) => r.value)),
    speed: pick("speed", SPEEDS.map((s) => s.toLowerCase())),
    vs: pick("vs", OPPONENTS.map((o) => o.value)),
    page: Math.max(1, Number(sp.page) || 1),
  };

  const all = (await listGames(user.id)).filter((g) => g.status === "finished");
  const record = { win: 0, loss: 0, draw: 0 };
  for (const g of all) {
    const o = outcomeFor(g, user.id);
    if (o) record[o]++;
  }
  const filtered = all.filter((g) => {
    if (f.result !== "all" && outcomeFor(g, user.id) !== f.result) return false;
    if (f.speed !== "all" && speedFor(g.initialMs, g.incrementMs).toLowerCase() !== f.speed) return false;
    if (f.vs !== "all") {
      const opp = colorOf(g, user.id) === "white" ? g.blackId : g.whiteId;
      if ((f.vs === "computer") !== isBotId(opp)) return false;
    }
    return true;
  });
  const pages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const page = Math.min(f.page, pages);
  const shown = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  return (
    <Page width="narrow">
      <PageHeader
        title="Game history"
        description={
          all.length === 0
            ? "Games you finish will show up here."
            : `${all.length} ${all.length === 1 ? "game" : "games"} · ${record.win} won, ${record.loss} lost, ${record.draw} drawn`
        }
      />

      <div className="mb-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SegmentedLinks
            label="Result"
            options={RESULTS.map((r) => ({ href: href(f, { result: r.value }), label: r.label, active: f.result === r.value }))}
          />
          <SegmentedLinks
            label="Opponent"
            options={OPPONENTS.map((o) => ({ href: href(f, { vs: o.value }), label: o.label, active: f.vs === o.value }))}
          />
        </div>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
          <Chip href={href(f, { speed: "all" })} active={f.speed === "all"}>
            All speeds
          </Chip>
          {SPEEDS.map((s) => {
            const Icon = SPEED_ICON[s];
            return (
              <Chip key={s} href={href(f, { speed: s.toLowerCase() })} active={f.speed === s.toLowerCase()}>
                <Icon aria-hidden />
                {s === "Untimed" ? "No clock" : s}
              </Chip>
            );
          })}
        </div>
      </div>

      <Card className="overflow-hidden">
        <GroupedGameList games={shown} userId={user.id} />
      </Card>

      {pages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          {page > 1 ? (
            <ButtonLink href={href(f, { page: page - 1 })} variant="outline" size="sm">
              <ChevronLeft /> Newer
            </ButtonLink>
          ) : (
            <span />
          )}
          <span className="text-sm text-muted-foreground tabular-nums">
            Page {page} of {pages}
          </span>
          {page < pages ? (
            <ButtonLink href={href(f, { page: page + 1 })} variant="outline" size="sm">
              Older <ChevronRight />
            </ButtonLink>
          ) : (
            <span />
          )}
        </div>
      )}
    </Page>
  );
}
