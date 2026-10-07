"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { MeResponse } from "@/app/api/me/route";
import { UsernameField } from "./username-field";

const fmt = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });

/** Account settings card for changing your username (once every 30 days). */
export function UsernameSettings() {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/me", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then(setMe)
      .catch(() => {});
  }, []);

  if (!me?.username) return null;
  const locked = me.canChangeUsernameAt !== null;

  return (
    <section className="mb-6 rounded-xl border border-border bg-card p-5 shadow-sm">
      <h2 className="text-lg font-semibold">Username</h2>
      <p className="mt-1 mb-4 text-sm text-muted-foreground">
        {locked
          ? `You can change your username again on ${fmt(me.canChangeUsernameAt!)}.`
          : "You can change your username once every 30 days."}
      </p>
      {saved && <p className="mb-3 text-sm text-primary">Username updated.</p>}
      <div className="max-w-sm">
        <UsernameField
          key={me.username}
          initial={me.username}
          submitLabel="Change username"
          disabled={locked}
          onSaved={async (username) => {
            setSaved(true);
            const res = await fetch("/api/me", { cache: "no-store" });
            setMe(res.ok ? await res.json() : { ...me, username });
            router.refresh();
          }}
        />
      </div>
    </section>
  );
}
