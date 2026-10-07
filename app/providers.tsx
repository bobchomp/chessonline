"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { NeonAuthUIProvider } from "@neondatabase/auth/react/ui";
import { authClient } from "@/lib/auth/client";

export function Providers({ children }: { children: ReactNode }) {
  const router = useRouter();
  return (
    <NeonAuthUIProvider
      authClient={authClient}
      defaultTheme="light"
      redirectTo="/dashboard"
      // Usernames (our own) replace display names, so hide the Name card in account settings.
      account={{ fields: ["image"] }}
      navigate={router.push}
      replace={router.replace}
      onSessionChange={() => router.refresh()}
      Link={Link}
    >
      {children}
    </NeonAuthUIProvider>
  );
}
