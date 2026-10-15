"use client";

import { useEffect, useRef, useState } from "react";
import { CLASS_INFO, formatEval, whiteWinPercent, type Eval, type MoveClass, type ReviewedMove } from "@/lib/review/analysis";

const HEIGHT = 120;
const PAD = { top: 6, right: 6, bottom: 6, left: 6 };

/** Moves marked on the graph (always with a label in the tooltip and move list too). */
const MARKED: MoveClass[] = ["brilliant", "great", "inaccuracy", "mistake", "miss", "blunder"];

/**
 * White's winning chances over the game: the light area is White's share, the dark
 * area Black's. Hover for the evaluation at each move; click to jump there.
 */
export function EvalGraph({
  evals,
  moves,
  reviewed,
  ply,
  onSelect,
}: {
  evals: Eval[];
  moves: string[];
  reviewed: ReviewedMove[];
  ply: number;
  onSelect: (ply: number) => void;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(200, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const w = width ?? 600;
  const innerW = w - PAD.left - PAD.right;
  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const n = Math.max(1, evals.length - 1);
  const x = (i: number) => PAD.left + (i / n) * innerW;
  const y = (pct: number) => PAD.top + (1 - pct / 100) * innerH;
  const pts = evals.map((e, i) => [x(i), y(whiteWinPercent(e))] as const);
  const line = pts.map(([px, py], i) => `${i ? "L" : "M"}${px.toFixed(1)},${py.toFixed(1)}`).join(" ");
  const whiteArea = `${line} L${x(evals.length - 1)},${HEIGHT - PAD.bottom} L${x(0)},${HEIGHT - PAD.bottom} Z`;

  function plyAt(clientX: number, box: DOMRect) {
    return Math.max(0, Math.min(evals.length - 1, Math.round(((clientX - box.left - PAD.left) / innerW) * n)));
  }

  const shown = hover;
  const moveAt = shown !== null && shown > 0 ? reviewed[shown - 1] : null;

  return (
    <div ref={wrap} className="relative" style={{ height: HEIGHT }}>
      {width !== null && (
        <svg width={w} height={HEIGHT} role="img" aria-label="Evaluation over the game" className="block">
          {/* Black's share fills the background; White's share is the area under the curve. */}
          <rect x={PAD.left} y={PAD.top} width={innerW} height={innerH} rx={4} className="fill-neutral-700" />
          <path d={whiteArea} className="fill-neutral-100" />
          <path d={line} fill="none" className="stroke-neutral-400" strokeWidth={1.5} />
          <line x1={PAD.left} x2={w - PAD.right} y1={y(50)} y2={y(50)} className="stroke-neutral-400" strokeWidth={1} strokeOpacity={0.6} />
          {/* Current position */}
          <line x1={x(ply)} x2={x(ply)} y1={PAD.top} y2={HEIGHT - PAD.bottom} className="stroke-primary" strokeWidth={2} />
          {/* Flagged moves */}
          {reviewed.map((m) =>
            MARKED.includes(m.cls) ? (
              <circle
                key={m.ply}
                cx={pts[m.ply][0]}
                cy={pts[m.ply][1]}
                r={4}
                fill={CLASS_INFO[m.cls].color}
                className="stroke-card"
                strokeWidth={2}
              />
            ) : null,
          )}
          {shown !== null && (
            <line x1={x(shown)} x2={x(shown)} y1={PAD.top} y2={HEIGHT - PAD.bottom} className="stroke-sky-500" strokeWidth={1} />
          )}
          <rect
            x={0}
            y={0}
            width={w}
            height={HEIGHT}
            fill="transparent"
            className="cursor-pointer"
            onPointerMove={(e) => setHover(plyAt(e.clientX, e.currentTarget.getBoundingClientRect()))}
            onPointerLeave={() => setHover(null)}
            onClick={(e) => onSelect(plyAt(e.clientX, e.currentTarget.getBoundingClientRect()))}
          />
        </svg>
      )}
      {shown !== null && (
        <div
          className="pointer-events-none absolute bottom-full z-10 mb-1 -translate-x-1/2 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs whitespace-nowrap shadow-md"
          style={{ left: Math.min(Math.max(x(shown), 70), w - 70) }}
        >
          <span className="font-semibold tabular-nums">{formatEval(evals[shown])}</span>
          {moveAt ? (
            <span className="text-muted-foreground">
              {" "}
              · {Math.ceil(moveAt.ply / 2)}
              {moveAt.color === "white" ? "." : "…"} {moves[moveAt.ply - 1]}
              {` · ${CLASS_INFO[moveAt.cls].label}`}
            </span>
          ) : (
            <span className="text-muted-foreground"> · start</span>
          )}
        </div>
      )}
    </div>
  );
}
