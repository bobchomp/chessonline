"use client";

import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

export type Notifications = { friendRequests: number };

type Ctx = Notifications & { refresh: () => void };

const NotificationsContext = createContext<Ctx>({ friendRequests: 0, refresh: () => {} });

export const useNotifications = () => useContext(NotificationsContext);

function interval(pathname: string): number {
  if (document.hidden) return 30_000;
  return pathname === "/dashboard" || pathname.startsWith("/friends") ? 5_000 : 10_000;
}

/**
 * Background check-in from every signed-in page. It marks you as online for
 * your friends and fetches badge counts. Pauses while signed out or without a
 * username, until the next navigation.
 */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [data, setData] = useState<Notifications>({ friendRequests: 0 });
  const kick = useRef<() => void>(() => {});

  useEffect(() => {
    if (pathname.startsWith("/auth/")) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;

    const run = async () => {
      clearTimeout(timer);
      try {
        const res = await fetch("/api/notifications", { cache: "no-store" });
        if (res.status === 401 || res.status === 403) {
          setData({ friendRequests: 0 });
          return; // not signed in / no username yet: wait for the next navigation
        }
        if (res.ok) setData(await res.json());
      } catch {
        // offline; retry on the next tick
      }
      if (!stopped) timer = setTimeout(run, interval(pathname));
    };
    const onVisible = () => {
      if (!document.hidden) void run();
    };

    kick.current = () => void run();
    void run();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [pathname]);

  const refresh = useCallback(() => kick.current(), []);

  return <NotificationsContext value={{ ...data, refresh }}>{children}</NotificationsContext>;
}
