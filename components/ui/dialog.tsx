"use client";

import { useEffect, useId, type ReactNode } from "react";
import { cn } from "./cn";

/**
 * A centred pop-up over a dimmed page. Escape and clicking outside call
 * `onClose` (leave it out for pop-ups that need an answer).
 */
export function Dialog({
  title,
  description,
  icon,
  onClose,
  footer,
  size = "md",
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  onClose?: () => void;
  /** Buttons along the bottom. */
  footer?: ReactNode;
  size?: "sm" | "md";
  children?: ReactNode;
}) {
  const id = useId();
  useEffect(() => {
    if (!onClose) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "max-h-[calc(100dvh-2rem)] w-full overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-xl sm:p-6",
          size === "sm" ? "max-w-sm" : "max-w-md",
        )}
      >
        {icon && (
          <div className="mb-4 flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary [&_svg]:size-5">{icon}</div>
        )}
        <h2 id={`${id}-title`} className="text-lg font-semibold">
          {title}
        </h2>
        {description && <div className="mt-1 text-sm text-muted-foreground">{description}</div>}
        {children && <div className="mt-4">{children}</div>}
        {footer && <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{footer}</div>}
      </div>
    </div>
  );
}
