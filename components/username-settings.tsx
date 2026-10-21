"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { MeResponse } from "@/app/api/me/route";
import { AtSign } from "lucide-react";
import { Card, CardBody, CardHeader } from "./ui/card";
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
    <Card className="mb-6">
      <CardHeader
        title="Username"
        icon={<AtSign />}
        description={
          locked ? `You can change your username again on ${fmt(me.canChangeUsernameAt!)}.` : "You can change your username once every 30 days."
        }
      />
      <CardBody className="max-w-sm">
        {saved && <p className="mb-3 text-sm text-primary">Username updated.</p>}
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
      </CardBody>
    </Card>
  );
}
