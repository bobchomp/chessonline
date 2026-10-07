import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "./providers";
import { SiteHeader } from "@/components/site-header";
import { UsernameGate } from "@/components/username-gate";
import { NotificationsProvider } from "@/components/notifications";
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
  description: "Play chess with a friend. Create a game, share the 6-digit PIN, and play.",
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
            <UsernameGate />
          </NotificationsProvider>
        </Providers>
      </body>
    </html>
  );
}
