"use client";

import { useEffect, useRef, useState } from "react";
import type { RatingPoint } from "@/lib/ratings/queries";

const HEIGHT = 180;
const PAD = { top: 14, right: 48, bottom: 22, left: 40 };

function niceTicks(min: number, max: number): number[] {
  const span = Math.max(50, max - min);
  const step = [25, 50, 100, 200, 250, 500].find((s) => span / s <= 4) ?? 1000;
  const ticks: number[] = [];
  for (let t = Math.floor(min / step) * step; t <= max + 0.0001; t += step) if (t >= min - step / 2) ticks.push(t);
  return ticks;
}

/** Rating after each rated game: one 2px line, hover crosshair + tooltip, table for screen readers. */
export function RatingChart({ points }: { points: RatingPoint[] }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(240, Math.round(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const ratings = points.map((p) => p.rating);
  const lo = Math.min(...ratings), hi = Math.max(...ratings);
  const pad = Math.max(25, (hi - lo) * 0.15);
  const ticks = niceTicks(lo - pad, hi + pad);
  const yMin = Math.min(ticks[0], lo - pad), yMax = Math.max(ticks[ticks.length - 1], hi + pad);
  const innerW = width - PAD.left - PAD.right;
  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const y = (r: number) => PAD.top + (1 - (r - yMin) / (yMax - yMin)) * innerH;
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.rating).toFixed(1)}`).join(" ");
  const last = points.length - 1;
  const shown = hover ?? null;

  function onMove(e: React.PointerEvent<SVGRectElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    const rel = (e.clientX - box.left) / box.width;
    setHover(points.length === 1 ? 0 : Math.round(rel * (points.length - 1)));
  }

  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

  return (
    <div ref={wrap} className="relative">
      <svg
        width={width}
        height={HEIGHT}
        role="img"
        aria-label={`Rating over the last ${points.length} rated games, now ${points[last].rating}`}
        className="block overflow-visible"
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} className="stroke-border" strokeWidth={1} />
            <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-muted-foreground text-[11px] tabular-nums">
              {t}
            </text>
          </g>
        ))}
        <text x={PAD.left} y={HEIGHT - 4} className="fill-muted-foreground text-[11px]">
          {fmtDate(points[0].at)}
        </text>
        {points.length > 1 && (
          <text x={width - PAD.right} y={HEIGHT - 4} textAnchor="end" className="fill-muted-foreground text-[11px]">
            {fmtDate(points[last].at)}
          </text>
        )}

        {points.length > 1 && (
          <path d={path} fill="none" className="stroke-primary" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        )}

        {/* Endpoint: marker with a surface ring, plus a direct label. */}
        <circle cx={x(last)} cy={y(points[last].rating)} r={4.5} className="fill-primary stroke-card" strokeWidth={2} />
        <text x={x(last) + 9} y={y(points[last].rating)} dy="0.32em" className="fill-foreground text-xs font-semibold tabular-nums">
          {points[last].rating}
        </text>

        {shown !== null && (
          <g pointerEvents="none">
            <line
              x1={x(shown)}
              x2={x(shown)}
              y1={PAD.top}
              y2={HEIGHT - PAD.bottom}
              className="stroke-muted-foreground"
              strokeWidth={1}
            />
            <circle cx={x(shown)} cy={y(points[shown].rating)} r={4.5} className="fill-primary stroke-card" strokeWidth={2} />
          </g>
        )}

        <rect
          x={PAD.left}
          y={0}
          width={innerW}
          height={HEIGHT}
          fill="transparent"
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
        />
      </svg>

      {shown !== null && (
        <div
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs shadow-md"
          style={{ left: Math.min(Math.max(x(shown), 70), width - 70) }}
        >
          <div className="font-semibold tabular-nums">{points[shown].rating}</div>
          <div className="text-muted-foreground">
            Game {shown + 1} · {fmtDate(points[shown].at)}
          </div>
        </div>
      )}

      <table className="sr-only">
        <caption>Rating after each rated game</caption>
        <thead>
          <tr>
            <th>Date</th>
            <th>Rating</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p, i) => (
            <tr key={i}>
              <td>{fmtDate(p.at)}</td>
              <td>{p.rating}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
