"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { FriendsOverview, Record3, Relationship, UserSummary } from "@/lib/friends/service";
import { useNotifications } from "@/components/notifications";
import { FriendButton, postFriendAction } from "./friend-button";
import { ChallengeDialog } from "./challenge-dialog";
import { Eye, MoreHorizontal, Search, ShieldBan, Swords, User, UserMinus, Users } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, SectionLabel } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Menu, MenuButton, MenuDivider, MenuLink } from "@/components/ui/menu";
import { RatingText } from "@/components/chess/result-mark";

type SearchResult = UserSummary & { relationship: Relationship };

export function formatRecord(r: Record3) {
  return `${r.wins}W ${r.losses}L ${r.draws}D`;
}

/** A row in one of the friends lists: avatar, name and details, then actions. */
function PersonRow({
  username,
  status,
  detail,
  children,
}: {
  username: string;
  status?: "online" | "offline" | "playing";
  detail?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      <Avatar name={username} status={status} />
      <div className="min-w-0 flex-1">
        <Link href={`/u/${username}`} className="block truncate text-sm font-medium hover:underline">
          {username}
        </Link>
        {detail && <div className="truncate text-xs text-muted-foreground">{detail}</div>}
      </div>
      {children && <div className="flex shrink-0 items-center gap-1">{children}</div>}
    </div>
  );
}

/** Friends: search, requests, friends list and blocked players. Lives on the Play page. */
export function FriendsPanel() {
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

  const online = overview?.friends.filter((f) => f.online).length ?? 0;
  const friendCount = overview?.friends.length ?? 0;

  return (
    <Card id="friends" className="scroll-mt-20">
      {challenging && (
        <ChallengeDialog friendId={challenging.userId} friendName={challenging.username} onClose={() => setChallenging(null)} />
      )}
      <CardHeader
        title="Friends"
        icon={<Users />}
        divider
        action={friendCount > 0 ? <span className="text-xs text-muted-foreground">{online} online</span> : undefined}
      />

      <div className="space-y-5 p-4 sm:p-5">
        <div>
          <label className="relative block">
            <span className="sr-only">Search players by username</span>
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              value={query}
              onChange={(e) => {
                const v = e.target.value.replace(/[^A-Za-z0-9_]/g, "").slice(0, 20);
                setQuery(v);
                if (v.trim().length < 2) setResults(null);
              }}
              placeholder="Find players by username"
              autoComplete="off"
              className="h-10 w-full rounded-lg border border-input bg-background pr-3 pl-9 text-sm outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
          </label>
          {q.length >= 2 && results && (
            <ul className="mt-2 space-y-2 rounded-lg border border-border p-2">
              {results.length === 0 && <li className="px-1 py-1 text-sm text-muted-foreground">No players found.</li>}
              {results.map((r) => (
                <li key={r.userId} className="px-1">
                  <PersonRow username={r.username}>
                    <FriendButton key={r.relationship} userId={r.userId} initial={r.relationship} compact onChange={() => void load()} />
                  </PersonRow>
                </li>
              ))}
            </ul>
          )}
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {error}
          </p>
        )}

        {overview && overview.incoming.length > 0 && (
          <div>
            <SectionLabel count={overview.incoming.length}>Requests</SectionLabel>
            <ul className="mt-3 space-y-3">
              {overview.incoming.map((r) => (
                <li key={r.userId}>
                  <PersonRow username={r.username} detail="Friend request">
                    <Button size="sm" disabled={!!busy} onClick={() => act("accept", r.userId)}>
                      Accept
                    </Button>
                    <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => act("decline", r.userId)}>
                      Decline
                    </Button>
                  </PersonRow>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div>
          {(overview?.incoming.length ?? 0) > 0 && <SectionLabel count={friendCount}>Your friends</SectionLabel>}
          {!overview ? (
            <p className="py-2 text-sm text-muted-foreground">Loading…</p>
          ) : friendCount === 0 ? (
            <EmptyState icon={<Users />} title="No friends yet" description="Search for a username above to send a friend request." className="py-4" />
          ) : (
            <ul className="mt-3 space-y-3 first:mt-0">
              {overview.friends.map((f) => {
                const confirming = confirm?.userId === f.userId ? confirm.action : null;
                const status = f.inGame ? "playing" : f.online ? "online" : "offline";
                const where = f.inGame ? (f.liveGame ? `Playing ${f.liveGame.opponent}` : "Playing you") : f.online ? "Online" : null;
                return (
                  <li key={f.userId}>
                    <PersonRow
                      username={f.username}
                      status={status}
                      detail={
                        <>
                          <RatingText rating={f.rating} provisional={f.provisional} className="font-medium text-foreground/80" />
                          {" · "}
                          {formatRecord(f.headToHead)} vs you
                          {where && <span className={f.inGame ? "text-amber-700" : "text-emerald-700"}> · {where}</span>}
                        </>
                      }
                    >
                      {f.liveGame ? (
                        <Link
                          href={`/game/${f.liveGame.id}`}
                          aria-label={`Watch ${f.username} vs ${f.liveGame.opponent}`}
                          title={`Watch ${f.username} vs ${f.liveGame.opponent}`}
                          className="inline-flex size-8 items-center justify-center rounded-lg border border-amber-300 text-amber-800 hover:bg-amber-50"
                        >
                          <Eye className="size-4" aria-hidden />
                        </Link>
                      ) : (
                        <Button
                          size="icon-sm"
                          variant="outline"
                          aria-label={`Challenge ${f.username}`}
                          title={`Challenge ${f.username}`}
                          onClick={() => setChallenging(f)}
                        >
                          <Swords />
                        </Button>
                      )}
                      <Menu
                        label={`More options for ${f.username}`}
                        width="w-48"
                        triggerClassName="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
                        trigger={<MoreHorizontal className="size-4" aria-hidden />}
                      >
                        {(close) => (
                          <>
                            <MenuLink href={`/u/${f.username}`} onSelect={close}>
                              <User /> View profile
                            </MenuLink>
                            {f.liveGame && (
                              <MenuButton
                                onClick={() => {
                                  close();
                                  setChallenging(f);
                                }}
                              >
                                <Swords /> Challenge
                              </MenuButton>
                            )}
                            <MenuDivider />
                            <MenuButton
                              onClick={() => {
                                close();
                                setConfirm({ userId: f.userId, action: "remove" });
                              }}
                            >
                              <UserMinus /> Remove friend
                            </MenuButton>
                            <MenuButton
                              className="text-red-700"
                              onClick={() => {
                                close();
                                setConfirm({ userId: f.userId, action: "block" });
                              }}
                            >
                              <ShieldBan /> Block
                            </MenuButton>
                          </>
                        )}
                      </Menu>
                    </PersonRow>
                    {confirming && (
                      <div className="mt-2 flex flex-wrap items-center justify-end gap-2 rounded-lg bg-secondary/60 px-3 py-2">
                        <span className="mr-auto text-sm">{confirming === "block" ? `Block ${f.username}?` : `Remove ${f.username}?`}</span>
                        <Button size="sm" variant="ghost" onClick={() => setConfirm(null)}>
                          Cancel
                        </Button>
                        <Button size="sm" variant="danger" className="bg-red-600 text-white hover:bg-red-700" disabled={!!busy} onClick={() => act(confirming, f.userId)}>
                          {confirming === "block" ? "Block" : "Remove"}
                        </Button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {overview && overview.outgoing.length > 0 && (
          <div>
            <SectionLabel count={overview.outgoing.length}>Sent requests</SectionLabel>
            <ul className="mt-3 space-y-3">
              {overview.outgoing.map((r) => (
                <li key={r.userId}>
                  <PersonRow username={r.username} detail="Request sent">
                    <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => act("cancel", r.userId)}>
                      Cancel
                    </Button>
                  </PersonRow>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {overview && overview.blocked.length > 0 && (
        <details className="border-t border-border">
          <summary className="cursor-pointer px-4 py-3 text-sm text-muted-foreground hover:text-foreground sm:px-5">
            Blocked players ({overview.blocked.length})
          </summary>
          <ul className="space-y-3 px-4 pb-4 sm:px-5">
            {overview.blocked.map((b) => (
              <li key={b.userId}>
                <PersonRow username={b.username}>
                  <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => act("unblock", b.userId)}>
                    Unblock
                  </Button>
                </PersonRow>
              </li>
            ))}
          </ul>
        </details>
      )}
    </Card>
  );
}
