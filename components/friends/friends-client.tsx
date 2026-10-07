"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { FriendsOverview, Record3, Relationship, UserSummary } from "@/lib/friends/service";
import { useNotifications } from "@/components/notifications";
import { FriendButton, postFriendAction } from "./friend-button";
import { ChallengeDialog } from "./challenge-dialog";

type SearchResult = UserSummary & { relationship: Relationship };

export function formatRecord(r: Record3) {
  return `W ${r.wins} · L ${r.losses} · D ${r.draws}`;
}

function StatusDot({ online, inGame }: { online: boolean; inGame?: boolean }) {
  const label = inGame ? "In a game" : online ? "Online" : "Offline";
  return (
    <span
      title={label}
      aria-label={label}
      className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${
        inGame ? "bg-amber-500" : online ? "bg-emerald-500" : "bg-neutral-300"
      }`}
    />
  );
}

function Section({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card shadow-sm">
      <h2 className="flex items-center gap-2 border-b border-border px-4 py-3 font-semibold">
        {title}
        {count !== undefined && count > 0 && (
          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground">{count}</span>
        )}
      </h2>
      {children}
    </section>
  );
}

const btn = "rounded-md px-3 py-1.5 text-sm font-medium transition disabled:opacity-50";

export function FriendsClient() {
  const { refresh: refreshBadge } = useNotifications();
  const [overview, setOverview] = useState<FriendsOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ userId: string; action: "remove" | "block" } | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [challenging, setChallenging] = useState<UserSummary | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/friends", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't load your friends.");
      setOverview(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load your friends.");
    }
  }, []);

  useEffect(() => {
    const first = setTimeout(load, 0);
    const t = setInterval(() => {
      if (!document.hidden) void load();
    }, 15_000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [load]);

  const q = query.trim();
  useEffect(() => {
    if (q.length < 2) return;
    const controller = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`, { signal: controller.signal });
        const data = await res.json();
        if (res.ok) setResults(data.results);
      } catch {
        // aborted or offline
      }
    }, 250);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [q]);

  async function act(action: string, userId: string) {
    setBusy(userId + action);
    setError(null);
    try {
      await postFriendAction(action, userId);
      setConfirm(null);
      await load();
      refreshBadge();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  const profileLink = (username: string) => (
    <Link href={`/u/${username}`} className="truncate font-medium hover:underline">
      {username}
    </Link>
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      {challenging && (
        <ChallengeDialog
          friendId={challenging.userId}
          friendName={challenging.username}
          onClose={() => setChallenging(null)}
        />
      )}
      <h1 className="text-2xl font-bold">Friends</h1>

      {error && (
        <p className="rounded-md bg-destructive/15 px-3 py-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <Section title="Find players">
        <div className="p-4">
          <input
            value={query}
            onChange={(e) => {
              const v = e.target.value.replace(/[^A-Za-z0-9_]/g, "").slice(0, 20);
              setQuery(v);
              if (v.trim().length < 2) setResults(null);
            }}
            placeholder="Search by username…"
            aria-label="Search players by username"
            autoComplete="off"
            className="w-full rounded-lg border border-input bg-background px-3 py-2.5 outline-none focus:border-primary"
          />
          {q.length >= 2 && results && (
            <ul className="mt-3 divide-y divide-border">
              {results.length === 0 && <li className="py-3 text-sm text-muted-foreground">No players found.</li>}
              {results.map((r) => (
                <li key={r.userId} className="flex items-center justify-between gap-3 py-2.5">
                  {profileLink(r.username)}
                  <FriendButton
                    key={r.relationship}
                    userId={r.userId}
                    initial={r.relationship}
                    onChange={() => void load()}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </Section>

      {overview && overview.incoming.length > 0 && (
        <Section title="Friend requests" count={overview.incoming.length}>
          <ul className="divide-y divide-border">
            {overview.incoming.map((r) => (
              <li key={r.userId} className="flex items-center justify-between gap-3 px-4 py-3">
                {profileLink(r.username)}
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={!!busy}
                    onClick={() => act("accept", r.userId)}
                    className={`${btn} bg-primary text-primary-foreground hover:opacity-90`}
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    disabled={!!busy}
                    onClick={() => act("decline", r.userId)}
                    className={`${btn} bg-secondary hover:bg-accent`}
                  >
                    Decline
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Your friends" count={overview?.friends.length}>
        {!overview ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">Loading…</p>
        ) : overview.friends.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">
            No friends yet. Search for players above to send a request.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {overview.friends.map((f) => (
              <li key={f.userId} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <StatusDot online={f.online} inGame={f.inGame} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {profileLink(f.username)}
                    {f.inGame && <span className="text-xs text-amber-600">In a game</span>}
                    {!f.inGame && f.online && <span className="text-xs text-emerald-600">Online</span>}
                  </div>
                  <div className="text-xs text-muted-foreground">{formatRecord(f.headToHead)} vs you</div>
                </div>
                {confirm?.userId === f.userId ? (
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{confirm.action === "block" ? `Block ${f.username}?` : `Remove ${f.username}?`}</span>
                    <button
                      type="button"
                      disabled={!!busy}
                      onClick={() => act(confirm.action, f.userId)}
                      className={`${btn} bg-destructive text-white hover:opacity-90`}
                    >
                      {confirm.action === "block" ? "Block" : "Remove"}
                    </button>
                    <button type="button" onClick={() => setConfirm(null)} className={`${btn} bg-secondary hover:bg-accent`}>
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setChallenging(f)}
                      className={`${btn} bg-primary text-primary-foreground hover:opacity-90`}
                    >
                      Challenge
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirm({ userId: f.userId, action: "remove" })}
                      className={`${btn} bg-secondary hover:bg-accent`}
                    >
                      Remove
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirm({ userId: f.userId, action: "block" })}
                      className={`${btn} bg-secondary text-destructive hover:bg-accent`}
                    >
                      Block
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      {overview && overview.outgoing.length > 0 && (
        <Section title="Sent requests" count={overview.outgoing.length}>
          <ul className="divide-y divide-border">
            {overview.outgoing.map((r) => (
              <li key={r.userId} className="flex items-center justify-between gap-3 px-4 py-3">
                {profileLink(r.username)}
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={() => act("cancel", r.userId)}
                  className={`${btn} bg-secondary hover:bg-accent`}
                >
                  Cancel request
                </button>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {overview && overview.blocked.length > 0 && (
        <Section title="Blocked players" count={overview.blocked.length}>
          <ul className="divide-y divide-border">
            {overview.blocked.map((b) => (
              <li key={b.userId} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="font-medium text-muted-foreground">{b.username}</span>
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={() => act("unblock", b.userId)}
                  className={`${btn} bg-secondary hover:bg-accent`}
                >
                  Unblock
                </button>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}
