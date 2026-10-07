"use client";

import { useEffect, useRef } from "react";

type Props = {
  moves: string[];
  /** Number of moves applied in the position being shown. */
  shownPly: number;
  onSelect: (ply: number) => void;
};

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
        className={`rounded px-2 py-0.5 text-left font-mono text-sm ${
          shownPly === ply ? "bg-primary text-primary-foreground" : "hover:bg-secondary"
        }`}
      >
        {san}
      </button>
    ) : (
      <span />
    );

  const nav = [
    { label: "⏮", title: "First move", ply: 0 },
    { label: "◀", title: "Previous move (←)", ply: Math.max(0, shownPly - 1) },
    { label: "▶", title: "Next move (→)", ply: Math.min(moves.length, shownPly + 1) },
    { label: "⏭", title: "Latest move", ply: moves.length },
  ];

  return (
    <div className="flex min-h-0 flex-col">
      <div ref={scroller} className="max-h-56 min-h-24 overflow-y-auto rounded-md bg-background/60 p-2 lg:max-h-72">
        {rows.length === 0 ? (
          <p className="p-2 text-sm text-muted-foreground">No moves yet.</p>
        ) : (
          <div className="grid grid-cols-[2.5rem_1fr_1fr] gap-y-0.5">
            {rows.map(([n, w, b]) => (
              <div key={n} className="contents">
                <span className="py-0.5 text-sm text-muted-foreground">{n}.</span>
                {cell(n * 2 - 1, w)}
                {cell(n * 2, b)}
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="mt-2 grid grid-cols-4 gap-1">
        {nav.map((b) => (
          <button
            key={b.title}
            type="button"
            title={b.title}
            aria-label={b.title}
            onClick={() => onSelect(b.ply)}
            className="rounded-md bg-secondary py-1.5 text-sm hover:bg-accent disabled:opacity-40"
            disabled={b.ply === shownPly}
          >
            {b.label}
          </button>
        ))}
      </div>
      {!live && (
        <button
          type="button"
          onClick={() => onSelect(moves.length)}
          className="mt-2 rounded-md border border-primary/50 py-1 text-sm text-primary hover:bg-primary/10"
        >
          Viewing an earlier position. Back to live
        </button>
      )}
    </div>
  );
}
