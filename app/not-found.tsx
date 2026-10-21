import Link from "next/link";

/** Shown for unknown addresses and anything that calls notFound(). */
export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
      <div className="text-6xl leading-none text-primary" aria-hidden>
        ♞
      </div>
      <p className="mt-6 text-sm font-semibold tracking-wide text-muted-foreground uppercase">404 · Page not found</p>
      <h1 className="mt-2 text-2xl font-bold">That square is empty</h1>
      <p className="mt-2 text-muted-foreground">
        The page you were looking for isn&apos;t on the board. It may have moved, or the link may be wrong.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/dashboard" className="rounded-lg bg-primary px-5 py-2.5 font-semibold text-primary-foreground hover:opacity-90">
          Go to Play
        </Link>
        <Link href="/" className="rounded-lg border border-border bg-card px-5 py-2.5 font-semibold hover:bg-secondary">
          Home page
        </Link>
      </div>
    </div>
  );
}
