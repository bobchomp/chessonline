import { cn } from "./cn";

/** A grey placeholder block that pulses while a page loads. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-secondary", className)} aria-hidden />;
}

/** Placeholder cards in the dashboard's two-column layout. */
export function PageSkeleton({ width = "wide" }: { width?: "wide" | "narrow" }) {
  return (
    <div className={cn("mx-auto w-full px-4 py-6 sm:px-6 sm:py-8", width === "wide" ? "max-w-6xl" : "max-w-3xl")} role="status" aria-label="Loading">
      <Skeleton className="h-9 w-64" />
      <Skeleton className="mt-3 h-5 w-80 max-w-full" />
      <div className={cn("mt-8 grid gap-6", width === "wide" && "lg:grid-cols-[minmax(0,1fr)_340px]")}>
        <div className="space-y-6">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
        {width === "wide" && (
          <div className="space-y-6">
            <Skeleton className="h-36 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-64 rounded-xl" />
          </div>
        )}
      </div>
    </div>
  );
}

/** Placeholder for board pages: the board and its side column. */
export function BoardSkeleton() {
  return (
    <div className="mx-auto grid max-w-6xl items-start gap-6 px-4 py-4 sm:px-6 sm:py-6 lg:grid-cols-[minmax(0,1fr)_360px]" role="status" aria-label="Loading">
      <div className="mx-auto w-full max-w-[min(100%,calc(100dvh-10.5rem))]">
        <Skeleton className="my-3 h-8 w-48" />
        <Skeleton className="aspect-square w-full" />
        <Skeleton className="my-3 h-8 w-48" />
      </div>
      <div className="space-y-4">
        <Skeleton className="h-36 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    </div>
  );
}
