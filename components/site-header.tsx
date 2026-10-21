"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, History, LogOut, Puzzle, Settings, Swords, Trophy, User, UserPlus, type LucideIcon } from "lucide-react";
import { useNotifications } from "./notifications";
import { signOut, useSignedIn } from "./auth-state";
import { Avatar } from "./ui/avatar";
import { CountDot } from "./ui/badge";
import { buttonClasses } from "./ui/button";
import { cn } from "./ui/cn";
import { Menu, MenuButton, MenuDivider, MenuLink } from "./ui/menu";
import { formatTimeControl } from "@/lib/game/format";

type NavItem = { href: string; label: string; icon: LucideIcon; match: (path: string) => boolean };

/** The main sections, in the header on desktop and the tab bar on phones. */
export function navItems(username: string | null): NavItem[] {
  const profile = username ? `/u/${encodeURIComponent(username)}` : "/account/settings";
  return [
    { href: "/dashboard", label: "Play", icon: Swords, match: (p) => p === "/dashboard" || p.startsWith("/game") || p === "/games" },
    { href: "/puzzles", label: "Puzzles", icon: Puzzle, match: (p) => p.startsWith("/puzzles") },
    { href: "/leaderboard", label: "Leaderboard", icon: Trophy, match: (p) => p.startsWith("/leaderboard") },
    { href: profile, label: "Profile", icon: User, match: (p) => p === profile || p.startsWith("/account") },
  ];
}

export function SiteHeader() {
  const pathname = usePathname();
  const { signedIn, pending } = useSignedIn();
  const { username } = useNotifications();
  const items = navItems(username);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Link href={signedIn ? "/dashboard" : "/"} className="flex shrink-0 items-center gap-2 font-semibold tracking-tight">
          <span className="text-2xl leading-none text-primary" aria-hidden>
            ♞
          </span>
          Chess Online
        </Link>

        {signedIn && (
          <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
            {items.slice(0, 3).map(({ href, label, icon: Icon, match }) => (
              <Link
                key={href}
                href={href}
                aria-current={match(pathname) ? "page" : undefined}
                className={cn(
                  "flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors",
                  match(pathname) ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground",
                )}
              >
                <Icon className="size-4" aria-hidden />
                {label}
              </Link>
            ))}
          </nav>
        )}

        <div className="ml-auto flex items-center gap-2">
          {pending ? null : signedIn ? (
            <>
              <NotificationBell />
              <AccountMenu username={username} />
            </>
          ) : (
            <>
              <Link href="/auth/sign-in" className={buttonClasses({ variant: "ghost", size: "sm" })}>
                Sign in
              </Link>
              <Link href="/auth/sign-up" className={buttonClasses({ size: "sm" })}>
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

/** Everything waiting for you, behind one bell. */
function NotificationBell() {
  const { friendRequests, dailyMovesWaiting, challenges } = useNotifications();
  const total = friendRequests + dailyMovesWaiting + challenges.length;
  return (
    <Menu
      label={total ? `Notifications (${total})` : "Notifications"}
      width="w-72"
      triggerClassName={cn(buttonClasses({ variant: "ghost", size: "icon" }), "relative")}
      trigger={
        <>
          <Bell aria-hidden />
          <CountDot count={total} className="absolute top-1 right-1" />
        </>
      }
    >
      {(close) => (
        <>
          <div className="px-3 pt-2 pb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Notifications</div>
          {total === 0 && <p className="px-3 py-3 text-sm text-muted-foreground">You&apos;re all caught up.</p>}
          {challenges.map((c) => (
            <MenuLink key={c.gameId} href="/dashboard" onSelect={close}>
              <Swords />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{c.from} challenged you</span>
                <span className="block text-xs text-muted-foreground">
                  {formatTimeControl(c.timeControl.initialMs, c.timeControl.incrementMs)} · you play {c.yourColor}
                </span>
              </span>
            </MenuLink>
          ))}
          {dailyMovesWaiting > 0 && (
            <MenuLink href="/dashboard" onSelect={close}>
              <History />
              <span className="flex-1">
                Your move in {dailyMovesWaiting} daily {dailyMovesWaiting === 1 ? "game" : "games"}
              </span>
            </MenuLink>
          )}
          {friendRequests > 0 && (
            <MenuLink href="/dashboard#friends" onSelect={close}>
              <UserPlus />
              <span className="flex-1">
                {friendRequests} friend {friendRequests === 1 ? "request" : "requests"}
              </span>
            </MenuLink>
          )}
        </>
      )}
    </Menu>
  );
}

function AccountMenu({ username }: { username: string | null }) {
  const router = useRouter();
  const name = username ?? "You";
  return (
    <Menu
      label="Account menu"
      triggerClassName="flex rounded-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      trigger={<Avatar name={name} size="sm" />}
    >
      {(close) => (
        <>
          <div className="flex items-center gap-3 px-3 py-2">
            <Avatar name={name} size="md" />
            <div className="min-w-0">
              <div className="truncate font-semibold">{name}</div>
              <div className="text-xs text-muted-foreground">Signed in</div>
            </div>
          </div>
          <MenuDivider />
          {username && (
            <MenuLink href={`/u/${encodeURIComponent(username)}`} onSelect={close}>
              <User /> Profile
            </MenuLink>
          )}
          <MenuLink href="/games" onSelect={close}>
            <History /> Game history
          </MenuLink>
          <MenuLink href="/account/settings" onSelect={close}>
            <Settings /> Settings
          </MenuLink>
          <MenuDivider />
          <MenuButton
            onClick={async () => {
              close();
              await signOut();
              router.push("/");
              router.refresh();
            }}
          >
            <LogOut /> Sign out
          </MenuButton>
        </>
      )}
    </Menu>
  );
}

/** Phone navigation: the main sections as a tab bar along the bottom. */
export function MobileTabBar() {
  const pathname = usePathname();
  const { signedIn } = useSignedIn();
  const { username } = useNotifications();
  if (!signedIn) return null;
  return (
    <>
      {/* Keeps page content clear of the fixed bar. */}
      <div className="h-16 md:hidden" aria-hidden />
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <div className="mx-auto grid h-16 max-w-md grid-cols-4">
          {navItems(username).map(({ href, label, icon: Icon, match }) => {
            const active = match(pathname);
            return (
              <Link
                key={label}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 text-[11px] font-medium",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className="size-5" aria-hidden strokeWidth={active ? 2.25 : 1.75} />
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
