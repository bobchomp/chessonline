"use client";

import { useRouter } from "next/navigation";

/**
 * True when going back stays inside the app: we arrived from one of our own pages,
 * either by a full page load (same-origin referrer) or by in-app navigation since
 * the first load (the URL no longer matches the one the browser originally loaded).
 */
function cameFromThisApp(): boolean {
  if (window.history.length <= 1) return false;
  if (document.referrer && new URL(document.referrer).origin === window.location.origin) return true;
  const first = performance.getEntriesByType("navigation")[0];
  if (!first) return false;
  const loaded = new URL(first.name);
  return loaded.pathname + loaded.search !== window.location.pathname + window.location.search;
}

/** "← Back" pill: returns to the previous page in this app, or to `fallback` if there isn't one. */
export function BackButton({ fallback = "/dashboard", className = "" }: { fallback?: string; className?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => {
        if (cameFromThisApp()) router.back();
        else router.push(fallback);
      }}
      className={`inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-sm font-medium text-muted-foreground shadow-sm transition hover:bg-secondary hover:text-foreground ${className}`}
    >
      <span aria-hidden>←</span> Back
    </button>
  );
}
