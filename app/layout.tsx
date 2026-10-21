import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { Providers } from "./providers";
import { MobileTabBar, SiteHeader } from "@/components/site-header";
import { UsernameGate } from "@/components/username-gate";
import { NotificationsProvider } from "@/components/notifications";
import { ChallengePopup } from "@/components/challenge-popup";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Chess Online",
  description: "Play chess online: with friends, quick matches, computer opponents, daily puzzles and game reviews.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col font-sans">
        <Providers>
          <NotificationsProvider>
            <SiteHeader />
            <main className="flex-1">{children}</main>
            <MobileTabBar />
            <ChallengePopup />
            <UsernameGate />
          </NotificationsProvider>
        </Providers>
        <Analytics />
      </body>
    </html>
  );
}
