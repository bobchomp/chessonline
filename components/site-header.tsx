"use client";

import Link from "next/link";
import { SignedIn, SignedOut, UserButton } from "@neondatabase/auth/react/ui";
import { useNotifications } from "./notifications";

export function SiteHeader() {
  const { friendRequests } = useNotifications();
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="text-2xl leading-none text-primary">♞</span>
          Chess Online
        </Link>
        <nav className="flex items-center gap-3 text-sm">
          <SignedIn>
            <Link href="/dashboard" className="text-muted-foreground hover:text-foreground">
              Play
            </Link>
            <Link href="/friends" className="relative text-muted-foreground hover:text-foreground">
              Friends
              {friendRequests > 0 && (
                <span
                  className="absolute -top-2 -right-3.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white"
                  aria-label={`${friendRequests} pending friend requests`}
                >
                  {friendRequests > 9 ? "9+" : friendRequests}
                </span>
              )}
            </Link>
            <UserButton size="icon" />
          </SignedIn>
          <SignedOut>
            <Link href="/auth/sign-in" className="text-muted-foreground hover:text-foreground">
              Sign in
            </Link>
            <Link
              href="/auth/sign-up"
              className="rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground hover:opacity-90"
            >
              Sign up
            </Link>
          </SignedOut>
        </nav>
      </div>
    </header>
  );
}
