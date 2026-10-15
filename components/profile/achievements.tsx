import type { Achievement, AchievementSummary } from "@/lib/achievements";

function Badge({ a }: { a: Achievement }) {
  const done = a.unlockedAt !== null;
  return (
    <li
      title={done ? `${a.description} Earned ${new Date(a.unlockedAt!).toLocaleDateString()}.` : a.description}
      className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${
        done ? "border-primary/30 bg-primary/5" : "border-border bg-secondary/40"
      }`}
    >
      <span className={`text-2xl leading-none ${done ? "" : "opacity-40 grayscale"}`} aria-hidden>
        {a.icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-sm font-medium ${done ? "" : "text-muted-foreground"}`}>{a.title}</span>
        {done ? (
          <span className="block text-xs text-muted-foreground">
            {new Date(a.unlockedAt!).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
          </span>
        ) : a.progress ? (
          <span className="mt-1 flex items-center gap-2">
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-border">
              <span
                className="block h-full rounded-full bg-primary/60"
                style={{ width: `${(a.progress.current / a.progress.target) * 100}%` }}
              />
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

/** Win streaks plus achievement badges, grouped by category. */
export function Achievements({ summary }: { summary: AchievementSummary }) {
  const groups = [...new Set(summary.achievements.map((a) => a.category))];
  return (
    <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h2 className="text-lg font-semibold">
          Achievements{" "}
          <span className="text-sm font-normal text-muted-foreground tabular-nums">
            {summary.unlocked} / {summary.achievements.length}
          </span>
        </h2>
        <dl className="flex gap-6 text-sm">
          <div>
            <dt className="text-muted-foreground">Current win streak</dt>
            <dd className="font-semibold tabular-nums">
              {summary.currentStreak > 0 ? `🔥 ${summary.currentStreak}` : "0"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Best win streak</dt>
            <dd className="font-semibold tabular-nums">{summary.bestStreak}</dd>
          </div>
        </dl>
      </div>
      {groups.map((g) => (
        <div key={g} className="mt-5">
          <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{g}</h3>
          <ul className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
            {summary.achievements
              .filter((a) => a.category === g)
              .map((a) => (
                <Badge key={a.id} a={a} />
              ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
