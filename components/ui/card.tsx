import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

/** A white panel. Every boxed section on the site is one of these. */
export function Card({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <section className={cn("min-w-0 rounded-xl border border-border bg-card shadow-sm", className)} {...props} />;
}

/**
 * A card's title row: title (and optional description) on the left, an action on
 * the right. `divider` draws a line under it, for cards whose body is a list.
 */
export function CardHeader({
  title,
  description,
  action,
  icon,
  divider = false,
  as: Heading = "h2",
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  divider?: boolean;
  as?: "h1" | "h2" | "h3";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex justify-between gap-3 px-4 pt-4 sm:px-5 sm:pt-5",
        description ? "items-start" : "min-h-12 items-center sm:min-h-13",
        divider ? "border-b border-border pb-3 sm:pb-4" : "pb-0",
        className,
      )}
    >
      <div className="min-w-0">
        <Heading className="flex items-center gap-2 text-base leading-tight font-semibold">
          {icon && <span className="text-muted-foreground [&_svg]:size-4">{icon}</span>}
          {title}
        </Heading>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  );
}

/** Padded card content. Under a header without a divider it sits a little closer. */
export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-4 sm:p-5", className)} {...props} />;
}

/** A small uppercase label for groups inside a card ("Requests", "Your friends"). */
export function SectionLabel({ children, count, className }: { children: ReactNode; count?: number; className?: string }) {
  return (
    <h3 className={cn("flex items-center gap-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase", className)}>
      {children}
      {count !== undefined && count > 0 && (
        <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] leading-none font-semibold tabular-nums">{count}</span>
      )}
    </h3>
  );
}
