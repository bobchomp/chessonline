"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { QUICK_MATCH_TIME_CONTROLS } from "@/lib/game/rules";
import { Bot, Search } from "lucide-react";
import { TimeControlPicker } from "@/components/chess/time-control";
import { Button } from "@/components/ui/button";

/** After this long without an opponent, offer a computer game instead. */
const OFFER_BOT_AFTER_MS = 30_000;
const CHECK_IN_MS = 1_500;

type Searching = {
  since: number;
  rating: number;
  bot: { id: string; name: string; rating: string; avatar: string };
};

function formatWait(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Pick a time control, then search for a game against someone near your rating. */
export function QuickMatch() {
  const router = useRouter();
  const [timeControl, setTimeControl] = useState("10+0");
  const [searching, setSearching] = useState<Searching | null>(null);
  const [active, setActive] = useState(false);
  const [now, setNow] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const activeRef = useRef(false);

  const goTo = useCallback(
    (gameId: string) => {
      activeRef.current = false;
      router.push(`/game/${gameId}`);
    },
    [router],
  );

  // Check in every ~1.5s while searching; the server pairs us or keeps us on the list.
  useEffect(() => {
    if (!active) return;
    activeRef.current = true;
    let timer: ReturnType<typeof setTimeout>;
    const checkIn = async () => {
      try {
        const res = await fetch("/api/quickmatch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ timeControl }),
        });
        const data = await res.json();
        if (!activeRef.current) return;
        if (!res.ok) {
          // A real refusal (not signed in, no username...): stop rather than retry forever.
          activeRef.current = false;
          setActive(false);
          setSearching(null);
          setError(data.error ?? "Couldn't search for a game.");
          return;
        }
        if (data.status === "matched") return goTo(data.gameId);
        setSearching({ since: Date.parse(data.since), rating: data.rating, bot: data.bot });
      } catch (e) {
        if (!activeRef.current) return;
        setError(e instanceof Error ? e.message : "Couldn't search for a game.");
      }
      // A little jitter so searchers don't all check in on the same beat.
      timer = setTimeout(checkIn, CHECK_IN_MS + Math.random() * 300);
    };
    void checkIn();
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearTimeout(timer);
      clearInterval(tick);
    };
  }, [active, timeControl, goTo]);

  // Leaving the page stops the search (a closed tab also drops off the list within seconds).
  useEffect(
    () => () => {
      if (activeRef.current) void fetch("/api/quickmatch", { method: "DELETE", keepalive: true });
    },
    [],
  );

  async function stop(): Promise<string | null> {
    activeRef.current = false;
    setActive(false);
    setSearching(null);
    const res = await fetch("/api/quickmatch", { method: "DELETE" }).catch(() => null);
    const data = await res?.json().catch(() => null);
    return data?.gameId ?? null;
  }

  async function playBot() {
    if (!searching) return;
    setBusy(true);
    const bot = searching.bot;
    // If someone paired with us at the last moment, take that game instead.
    const matched = await stop();
    if (matched) return goTo(matched);
    try {
      const res = await fetch("/api/bots/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ botId: bot.id, timeControl, color: "random" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't start the game.");
      router.push(`/game/${data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start the game.");
      setBusy(false);
    }
  }

  const waited = searching && now ? Math.max(0, now - searching.since) : 0;
  const tc = QUICK_MATCH_TIME_CONTROLS.find((t) => t.id === timeControl);

  if (active) {
    return (
      <div className="rounded-xl border border-border bg-secondary/40 px-5 py-8 text-center" aria-live="polite">
        <div className="mx-auto size-10 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
        <p className="mt-4 font-semibold">Looking for an opponent{searching ? ` near ${searching.rating}` : ""}…</p>
        <p className="mt-1 text-sm text-muted-foreground tabular-nums">
          {tc?.label} · {formatWait(waited)}
        </p>

        {searching && waited >= OFFER_BOT_AFTER_MS && (
          <div className="mx-auto mt-5 max-w-sm rounded-xl border border-border bg-card p-4 text-sm">
            <p>Nobody near your rating is searching right now.</p>
            <Button className="mt-3" onClick={playBot} disabled={busy}>
              <Bot /> Play {searching.bot.name} ({searching.bot.rating}) instead
            </Button>
            <p className="mt-2 text-xs text-muted-foreground">We&apos;ll keep searching until you choose.</p>
          </div>
        )}

        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        <Button variant="outline" className="mt-5" onClick={() => void stop().then((matched) => matched && goTo(matched))}>
          Cancel search
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <TimeControlPicker value={timeControl} onChange={setTimeControl} options={QUICK_MATCH_TIME_CONTROLS} />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button
        size="lg"
        block
        onClick={() => {
          setError(null);
          setSearching(null);
          setNow(Date.now());
          setActive(true);
        }}
      >
        <Search /> Find a game
      </Button>
    </div>
  );
}
