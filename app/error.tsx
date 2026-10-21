"use client"; // Error boundaries must be Client Components

import Link from "next/link";
import { useEffect } from "react";

/** Shown when a page fails to load, instead of a blank screen. */
export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
      <div className="text-6xl leading-none text-primary" aria-hidden>
        ♞
      </div>
      <h1 className="mt-6 text-2xl font-bold">Something went wrong</h1>
      <p className="mt-2 text-muted-foreground">
        This page didn&apos;t load properly. Trying again usually fixes it.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={() => retry()}
          className="rounded-lg bg-primary px-5 py-2.5 font-semibold text-primary-foreground hover:opacity-90"
        >
          Try again
        </button>
        <Link href="/dashboard" className="rounded-lg border border-border bg-card px-5 py-2.5 font-semibold hover:bg-secondary">
          Go to Play
        </Link>
      </div>
    </div>
  );
}
