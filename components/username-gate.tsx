"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AtSign } from "lucide-react";
import { Dialog } from "./ui/dialog";
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
    <div className="relative z-[60]">
      <Dialog
        size="sm"
        icon={<AtSign />}
        title="Choose your username"
        description="It's how other players see you and find you to add as a friend."
      >
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
      </Dialog>
    </div>
  );
}
