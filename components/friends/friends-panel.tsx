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

function SubHeading({ title, count }: { title: string; count?: number }) {
  return (
    <h3 className="flex items-center gap-2 px-4 pt-4 pb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
      {title}
      {count !== undefined && count > 0 && (
        <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-medium normal-case">{count}</span>
      )}
    </h3>
  );
}

const btn = "rounded-md px-2.5 py-1 text-sm font-medium transition disabled:opacity-50";

/** Friends: search, requests, friends list and blocked players. Lives on the Play page. */
export function FriendsPanel() {
  const { refresh: refreshBadge } = useNotifications();
  const [overview, setOverview] = useState<FriendsOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ userId: string; action: "remove" | "block" } | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
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
      setMenuFor(null);
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

  const online = overview?.friends.filter((f) => f.online).length ?? 0;

  return (
    <section id="friends" className="scroll-mt-20 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      {challenging && (
        <ChallengeDialog
          friendId={challenging.userId}
          friendName={challenging.username}
          onClose={() => setChallenging(null)}
        />
      )}
      <div className="flex items-baseline justify-between border-b border-border px-4 py-3">
        <h2 className="text-lg font-semibold">Friends</h2>
        {overview && overview.friends.length > 0 && (
          <span className="text-xs text-muted-foreground">{online} online</span>
        )}
      </div>

      <div className="px-4 pt-4">
        <input
          value={query}
          onChange={(e) => {
            const v = e.target.value.replace(/[^A-Za-z0-9_]/g, "").slice(0, 20);
            setQuery(v);
            if (v.trim().length < 2) setResults(null);
          }}
          placeholder="Find players by username…"
          aria-label="Search players by username"
          autoComplete="off"
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
        />
        {q.length >= 2 && results && (
          <ul className="mt-2 divide-y divide-border rounded-lg border border-border">
            {results.length === 0 && <li className="px-3 py-2.5 text-sm text-muted-foreground">No players found.</li>}
            {results.map((r) => (
              <li key={r.userId} className="flex items-center justify-between gap-2 px-3 py-2">
                {profileLink(r.username)}
                <FriendButton key={r.relationship} userId={r.userId} initial={r.relationship} compact onChange={() => void load()} />
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && (
        <p className="mx-4 mt-3 rounded-md bg-destructive/15 px-3 py-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      {overview && overview.incoming.length > 0 && (
        <>
          <SubHeading title="Requests" count={overview.incoming.length} />
          <ul>
            {overview.incoming.map((r) => (
              <li key={r.userId} className="flex items-center justify-between gap-2 px-4 py-2">
                {profileLink(r.username)}
                <div className="flex shrink-0 gap-1.5">
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
        </>
      )}

      <SubHeading title="Your friends" count={overview?.friends.length} />
      {!overview ? (
        <p className="px-4 py-3 text-sm text-muted-foreground">Loading…</p>
      ) : overview.friends.length === 0 ? (
        <p className="px-4 py-3 text-sm text-muted-foreground">No friends yet. Search above to send a request.</p>
      ) : (
        <ul>
          {overview.friends.map((f) => {
            const expanded = menuFor === f.userId;
            const confirming = confirm?.userId === f.userId ? confirm.action : null;
            return (
              <li key={f.userId} className="px-4 py-2">
                <div className="flex items-center gap-2.5">
                  <StatusDot online={f.online} inGame={f.inGame} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      {profileLink(f.username)}
                      {f.inGame && <span className="shrink-0 text-xs text-amber-600">In a game</span>}
                      {!f.inGame && f.online && <span className="shrink-0 text-xs text-emerald-600">Online</span>}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      <span className="font-medium tabular-nums text-foreground/80">
                        {f.rating}
                        {f.provisional && "?"}
                      </span>{" "}
                      · {formatRecord(f.headToHead)} vs you
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setChallenging(f)}
                    className={`${btn} shrink-0 bg-primary text-primary-foreground hover:opacity-90`}
                  >
                    Challenge
                  </button>
                  <button
                    type="button"
                    aria-label={`More options for ${f.username}`}
                    aria-expanded={expanded}
                    onClick={() => {
                      setMenuFor(expanded ? null : f.userId);
                      setConfirm(null);
                    }}
                    className={`${btn} shrink-0 bg-secondary px-2 hover:bg-accent`}
                  >
                    ⋯
                  </button>
                </div>
                {expanded && (
                  <div className="mt-2 ml-5 flex flex-wrap items-center gap-1.5">
                    {confirming ? (
                      <>
                        <span className="text-sm">{confirming === "block" ? `Block ${f.username}?` : `Remove ${f.username}?`}</span>
                        <button
                          type="button"
                          disabled={!!busy}
                          onClick={() => act(confirming, f.userId)}
                          className={`${btn} bg-destructive text-white hover:opacity-90`}
                        >
                          {confirming === "block" ? "Block" : "Remove"}
                        </button>
                        <button type="button" onClick={() => setConfirm(null)} className={`${btn} bg-secondary hover:bg-accent`}>
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => setConfirm({ userId: f.userId, action: "remove" })}
                          className={`${btn} bg-secondary hover:bg-accent`}
                        >
                          Remove friend
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirm({ userId: f.userId, action: "block" })}
                          className={`${btn} bg-secondary text-destructive hover:bg-accent`}
                        >
                          Block
                        </button>
                      </>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {overview && overview.outgoing.length > 0 && (
        <>
          <SubHeading title="Sent requests" count={overview.outgoing.length} />
          <ul>
            {overview.outgoing.map((r) => (
              <li key={r.userId} className="flex items-center justify-between gap-2 px-4 py-2">
                {profileLink(r.username)}
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={() => act("cancel", r.userId)}
                  className={`${btn} bg-secondary hover:bg-accent`}
                >
                  Cancel
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {overview && overview.blocked.length > 0 && (
        <details className="border-t border-border">
          <summary className="cursor-pointer px-4 py-3 text-sm text-muted-foreground hover:text-foreground">
            Blocked players ({overview.blocked.length})
          </summary>
          <ul className="pb-2">
            {overview.blocked.map((b) => (
              <li key={b.userId} className="flex items-center justify-between gap-2 px-4 py-2">
                <span className="truncate text-sm text-muted-foreground">{b.username}</span>
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
        </details>
      )}
      <div className="h-3" />
    </section>
  );
}
