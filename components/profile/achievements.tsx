"use client";

import { useState } from "react";
import {
  Award,
  Brain,
  CalendarCheck,
  CalendarDays,
  ChevronDown,
  Flame,
  Handshake,
  Medal,
  Mountain,
  Puzzle,
  Sparkles,
  Star,
  Target,
  TrendingUp,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import type { Achievement, AchievementSummary } from "@/lib/achievements";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, SectionLabel } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";

const ICONS: Record<string, LucideIcon> = {
  "first-win": Trophy,
  "first-rated": TrendingUp,
  "first-friend": Handshake,
  "games-10": Target,
  "games-50": Medal,
  "games-100": Award,
  "streak-3": Sparkles,
  "streak-5": Flame,
  "streak-10": Mountain,
  "puzzle-first": Puzzle,
  "puzzle-perfect-10": Star,
  "puzzles-50": Brain,
  "puzzle-streak-7": CalendarCheck,
  "puzzle-streak-30": CalendarDays,
};

function AchievementTile({ a }: { a: Achievement }) {
  const done = a.unlockedAt !== null;
  const Icon = ICONS[a.id];
  return (
    <li
      title={done ? `${a.description} Earned ${new Date(a.unlockedAt!).toLocaleDateString()}.` : a.description}
      className={cn("flex items-center gap-3 rounded-lg border px-3 py-2.5", done ? "border-primary/25 bg-primary/[0.04]" : "border-border bg-card")}
    >
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-full",
          done ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground/70",
          !Icon && "text-lg",
          !Icon && !done && "opacity-50 grayscale",
        )}
        aria-hidden
      >
        {Icon ? <Icon className="size-4" /> : a.icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn("block truncate text-sm font-medium", !done && "text-muted-foreground")}>{a.title}</span>
        {done ? (
          <span className="block text-xs text-muted-foreground">
            {new Date(a.unlockedAt!).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
          </span>
        ) : a.progress ? (
          <span className="mt-1 flex items-center gap-2">
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
              <span className="block h-full rounded-full bg-primary/60" style={{ width: `${(a.progress.current / a.progress.target) * 100}%` }} />
            </span>
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {a.progress.current}/{a.progress.target}
            </span>
          </span>
        ) : (
          <span className="block truncate text-xs text-muted-foreground">{a.description}</span>
        )}
      </span>
    </li>
  );
}

/** Earned badges first; everything else (grouped, with progress) behind "Show all". */
export function Achievements({ summary }: { summary: AchievementSummary }) {
  const [all, setAll] = useState(false);
  const earned = summary.achievements.filter((a) => a.unlockedAt !== null);
  const groups = [...new Set(summary.achievements.map((a) => a.category))];
  return (
    <Card>
      <CardHeader
        title="Achievements"
        icon={<Award />}
        description={`${summary.unlocked} of ${summary.achievements.length} earned`}
        divider
        action={
          <dl className="flex gap-5 text-right text-xs">
            <div>
              <dt className="text-muted-foreground">Win streak</dt>
              <dd className="flex items-center justify-end gap-1 text-base font-semibold tabular-nums">
                {summary.currentStreak > 0 && <Flame className="size-4 text-orange-500" aria-hidden />}
                {summary.currentStreak}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Best</dt>
              <dd className="text-base font-semibold tabular-nums">{summary.bestStreak}</dd>
            </div>
          </dl>
        }
      />
      <CardBody className="space-y-5">
        {all ? (
          groups.map((g) => (
            <div key={g}>
              <SectionLabel>{g}</SectionLabel>
              <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                {summary.achievements
                  .filter((a) => a.category === g)
                  .map((a) => (
                    <AchievementTile key={a.id} a={a} />
                  ))}
              </ul>
            </div>
          ))
        ) : earned.length > 0 ? (
          <ul className="grid gap-2 sm:grid-cols-2">
            {earned.map((a) => (
              <AchievementTile key={a.id} a={a} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No achievements yet. Win a game or solve a daily puzzle to earn the first.</p>
        )}
        <Button variant="ghost" size="sm" block onClick={() => setAll((v) => !v)}>
          {all ? "Show earned only" : `Show all ${summary.achievements.length}`}
          <ChevronDown className={cn("transition-transform", all && "rotate-180")} />
        </Button>
      </CardBody>
    </Card>
  );
}
