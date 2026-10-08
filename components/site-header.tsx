"use client";

import Link from "next/link";
import { SignedIn, SignedOut, UserButton } from "@neondatabase/auth/react/ui";
import { authClient } from "@/lib/auth/client";
import { useNotifications } from "./notifications";

export function SiteHeader() {
  const { friendRequests } = useNotifications();
  const { data: session } = authClient.useSession();
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link href={session?.user ? "/dashboard" : "/"} className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="text-2xl leading-none text-primary">♞</span>
          Chess Online
        </Link>
        <nav className="flex items-center gap-5 text-sm">
          <SignedIn>
            {friendRequests > 0 && (
              <Link
                href="/dashboard#friends"
                className="flex items-center gap-1.5 rounded-full bg-red-600/10 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-600/15"
              >
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                  {friendRequests > 9 ? "9+" : friendRequests}
                </span>
                {friendRequests === 1 ? "friend request" : "friend requests"}
              </Link>
            )}
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
