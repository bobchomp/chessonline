import type { Metadata } from "next";
import { utcDay } from "@/lib/puzzles/logic";
import { PuzzlePage } from "@/components/puzzles/puzzle-page";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Daily puzzle · Chess Online" };

export default async function TodaysPuzzle() {
  const today = utcDay();
  return <PuzzlePage day={today} today={today} />;
}
