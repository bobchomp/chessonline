import type { ReactNode } from "react";
import { cn } from "./cn";

/**
 * Page container. "wide" for boards and the dashboard, "narrow" for reading
 * pages (profile, leaderboard, settings, history).
 */
export function Page({ width = "wide", className, children }: { width?: "wide" | "narrow"; className?: string; children: ReactNode }) {
  return (
    <div className={cn("mx-auto w-full px-4 py-6 sm:px-6 sm:py-8", width === "wide" ? "max-w-6xl" : "max-w-3xl", className)}>
      {children}
    </div>
  );
}

/** The title area at the top of a page: title, a line of description, and actions on the right. */
export function PageHeader({ title, description, actions, className }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <div className={cn("mb-6 flex flex-wrap items-end justify-between gap-x-4 gap-y-3", className)}>
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
