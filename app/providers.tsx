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
      // Match the rest of the site's wording ("Sign up", "Sign in").
      localization={{
        SIGN_IN: "Sign in",
        SIGN_IN_ACTION: "Sign in",
        SIGN_IN_DESCRIPTION: "Enter your email and password to sign in.",
        SIGN_UP: "Sign up",
        SIGN_UP_ACTION: "Create account",
        SIGN_OUT: "Sign out",
      }}
      navigate={router.push}
      replace={router.replace}
      onSessionChange={() => router.refresh()}
      Link={Link}
    >
      {children}
    </NeonAuthUIProvider>
  );
}
