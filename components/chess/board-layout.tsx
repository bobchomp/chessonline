import Link from "next/link";
import type { ReactNode } from "react";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/components/ui/cn";

/**
 * The layout shared by every board page (live games, review, puzzles): the board
 * with a player bar above and below, and a side column. The board is sized to
 * fit the screen height on desktop.
 */
export function BoardLayout({
  top,
  bottom,
  board,
  side,
  boardPrefix,
}: {
  top?: ReactNode;
  bottom?: ReactNode;
  board: ReactNode;
  side: ReactNode;
  /** Something beside the board, e.g. the review's evaluation bar. */
  boardPrefix?: ReactNode;
}) {
  return (
    <div className="mx-auto grid max-w-6xl items-start gap-6 px-4 py-4 sm:px-6 sm:py-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="mx-auto w-full max-w-[min(100%,calc(100dvh-10.5rem))]">
        {top}
        <div className="flex gap-2">
          {boardPrefix}
          <div className="relative aspect-square min-w-0 flex-1 overflow-hidden rounded-lg shadow-md ring-1 ring-black/5">{board}</div>
        </div>
        {bottom}
      </div>
      <aside className="flex min-w-0 flex-col gap-4">{side}</aside>
    </div>
  );
}

/** A small white or black disc showing which side a player has. */
export function SideDot({ color, className }: { color: "white" | "black"; className?: string }) {
  return (
    <span
      title={color === "white" ? "White" : "Black"}
      className={cn(
        "inline-block size-2.5 shrink-0 rounded-full border",
        color === "white" ? "border-neutral-400 bg-white" : "border-neutral-900 bg-neutral-900",
        className,
      )}
    />
  );
}

/**
 * A player above or below the board: avatar, name, rating, and a clock on the
 * right. It's always the same height, clock or not, so the board never jumps.
 */
export function PlayerBar({
  name,
  href,
  emoji,
  icon,
  color,
  isYou,
  detail,
  tags,
  clock,
}: {
  name: string;
  href?: string;
  emoji?: string;
  icon?: ReactNode;
  color: "white" | "black";
  isYou?: boolean;
  /** Under the name: rating, rating change, "thinking…". */
  detail?: ReactNode;
  /** Beside the name: "Draw offered", an add-friend button. */
  tags?: ReactNode;
  clock?: ReactNode;
}) {
  return (
    <div className="flex h-14 items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <Avatar name={name} emoji={emoji} icon={icon} size="sm" />
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-1.5">
            {href ? (
              <Link href={href} className="truncate text-sm font-semibold hover:underline">
                {name}
              </Link>
            ) : (
              <span className="truncate text-sm font-semibold">{name}</span>
            )}
            {isYou && <span className="shrink-0 text-xs text-muted-foreground">(you)</span>}
            {tags}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <SideDot color={color} />
            {detail}
          </div>
        </div>
      </div>
      {clock && <div className="shrink-0">{clock}</div>}
    </div>
  );
}
