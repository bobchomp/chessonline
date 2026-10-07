"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { UsernameField } from "./username-field";

/**
 * Signed-in users without a username see this on every page (except the auth
 * pages) and can't dismiss it until they choose one. The server enforces the
 * same rule, so skipping the popup doesn't get around it.
 */
export function UsernameGate() {
  const router = useRouter();
  const pathname = usePathname();
  // Re-checked on every navigation, so signing in as a different account is picked up.
  const [state, setState] = useState<"unknown" | "needs" | "ok">("unknown");
  const onAuthPage = pathname.startsWith("/auth/");

  useEffect(() => {
    if (onAuthPage) return;
    let cancelled = false;
    fetch("/api/me", { cache: "no-store" })
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 401) setState("unknown"); // signed out
        else if (res.ok) setState((await res.json()).username ? "ok" : "needs");
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [pathname, onAuthPage]);

  if (onAuthPage || state !== "needs") return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="username-gate-title"
        className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl"
      >
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-3xl text-primary">
          ♞
        </div>
        <h2 id="username-gate-title" className="mt-4 text-center text-xl font-semibold">
          Choose your username
        </h2>
        <p className="mt-2 mb-5 text-center text-sm text-muted-foreground">
          It&apos;s how other players see you and find you to add as a friend.
        </p>
        <UsernameField
          submitLabel="Continue"
          onSaved={() => {
            setState("ok");
            router.refresh();
          }}
        />
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Wrong account?{" "}
          <Link href="/auth/sign-out" className="underline underline-offset-2 hover:text-foreground">
            Sign out
          </Link>
        </p>
      </div>
    </div>
  );
}
