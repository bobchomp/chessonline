"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "./cn";

type Option<T extends string> = { value: T; label: ReactNode; icon?: ReactNode };

const TRACK = "inline-flex max-w-full rounded-lg bg-secondary p-1";
const ITEM =
  "inline-flex h-8 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium whitespace-nowrap transition-colors [&_svg]:size-4 [&_svg]:shrink-0";
const ON = "bg-card text-foreground shadow-sm";
const OFF = "text-muted-foreground hover:text-foreground";

/** Tabs drawn as a segmented control. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: Option<T>[];
  /** Accessible name for the group. */
  label: string;
  className?: string;
}) {
  return (
    <div role="tablist" aria-label={label} className={cn(TRACK, className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(ITEM, value === o.value ? ON : OFF)}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** The same look, for options that are pages (e.g. ?scope=friends). */
export function SegmentedLinks({
  options,
  label,
  className,
}: {
  options: { href: string; label: ReactNode; active: boolean; icon?: ReactNode }[];
  label: string;
  className?: string;
}) {
  return (
    <nav aria-label={label} className={cn(TRACK, className)}>
      {options.map((o) => (
        <Link key={o.href} href={o.href} aria-current={o.active ? "page" : undefined} className={cn(ITEM, o.active ? ON : OFF)}>
          {o.icon}
          {o.label}
        </Link>
      ))}
    </nav>
  );
}
