import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { isPlayableDay, utcDay } from "@/lib/puzzles/logic";
import { PuzzlePage } from "@/components/puzzles/puzzle-page";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Daily puzzle · Chess Online" };

export default async function ArchivePuzzle({ params }: PageProps<"/puzzles/[day]">) {
  const { day } = await params;
  const today = utcDay();
  if (day === today) redirect("/puzzles");
  if (!isPlayableDay(day, today)) notFound();
  return <PuzzlePage day={day} today={today} />;
}
