"use client";

import { useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";

type Props = {
  moves: string[];
  /** Number of moves applied in the position being shown. */
  shownPly: number;
  onSelect: (ply: number) => void;
};

/** The game's moves in two columns, with buttons to step through them. */
export function MoveList({ moves, shownPly, onSelect }: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  const live = shownPly === moves.length;

  useEffect(() => {
    if (live && scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight;
  }, [moves.length, live]);

  const rows: [number, string, string | undefined][] = [];
  for (let i = 0; i < moves.length; i += 2) rows.push([i / 2 + 1, moves[i], moves[i + 1]]);

  const cell = (ply: number, san: string | undefined) =>
    san ? (
      <button
        type="button"
        onClick={() => onSelect(ply)}
        aria-current={shownPly === ply ? "step" : undefined}
        className={cn(
          "rounded-md px-2 py-1 text-left text-sm font-medium tabular-nums",
          shownPly === ply ? "bg-primary text-primary-foreground" : "hover:bg-secondary",
        )}
      >
        {san}
      </button>
    ) : (
      <span />
    );

  const nav = [
    { icon: ChevronsLeft, title: "First move", ply: 0 },
    { icon: ChevronLeft, title: "Previous move (←)", ply: Math.max(0, shownPly - 1) },
    { icon: ChevronRight, title: "Next move (→)", ply: Math.min(moves.length, shownPly + 1) },
    { icon: ChevronsRight, title: "Latest move", ply: moves.length },
  ];

  return (
    <div className="flex min-h-0 flex-col">
      <div ref={scroller} className="max-h-60 min-h-28 overflow-y-auto lg:max-h-80">
        {rows.length === 0 ? (
          <p className="px-1 py-2 text-sm text-muted-foreground">No moves yet.</p>
        ) : (
          <div className="grid grid-cols-[2.25rem_1fr_1fr] gap-x-1 gap-y-0.5">
            {rows.map(([n, w, b]) => (
              <div key={n} className="contents">
                <span className="py-1 pl-1 text-sm text-muted-foreground tabular-nums">{n}.</span>
                {cell(n * 2 - 1, w)}
                {cell(n * 2, b)}
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="mt-3 grid grid-cols-4 gap-1.5">
        {nav.map(({ icon: Icon, title, ply }) => (
          <Button key={title} variant="secondary" size="sm" title={title} aria-label={title} onClick={() => onSelect(ply)} disabled={ply === shownPly}>
            <Icon />
          </Button>
        ))}
      </div>
      {!live && (
        <Button variant="outline" size="sm" className="mt-2 border-primary/40 text-primary" onClick={() => onSelect(moves.length)}>
          Viewing an earlier position · Back to live
        </Button>
      )}
    </div>
  );
}
