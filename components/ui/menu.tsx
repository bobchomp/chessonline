"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "./cn";

/**
 * A button that opens a small floating panel (avatar menu, notifications,
 * "more" actions). Closes on outside click, Escape, or choosing an item.
 */
export function Menu({
  trigger,
  label,
  align = "end",
  width = "w-56",
  triggerClassName,
  children,
}: {
  trigger: ReactNode;
  label: string;
  align?: "start" | "end";
  width?: string;
  triggerClassName?: string;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={triggerClassName}
      >
        {trigger}
      </button>
      {open && (
        <div
          role="menu"
          className={cn(
            "absolute top-full z-50 mt-2 overflow-hidden rounded-xl border border-border bg-card py-1 shadow-lg",
            align === "end" ? "right-0" : "left-0",
            width,
          )}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

const ITEM = "flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-secondary [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground";

export function MenuLink({ href, onSelect, children, className }: { href: string; onSelect?: () => void; children: ReactNode; className?: string }) {
  return (
    <Link role="menuitem" href={href} onClick={onSelect} className={cn(ITEM, className)}>
      {children}
    </Link>
  );
}

export function MenuButton({ onClick, children, className }: { onClick: () => void; children: ReactNode; className?: string }) {
  return (
    <button role="menuitem" type="button" onClick={onClick} className={cn(ITEM, className)}>
      {children}
    </button>
  );
}

export function MenuDivider() {
  return <div className="my-1 border-t border-border" />;
}
