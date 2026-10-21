import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps } from "react";
import { cn } from "./cn";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg" | "icon" | "icon-sm";

type Style = { variant?: ButtonVariant; size?: ButtonSize; block?: boolean; className?: string };

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90",
  secondary: "bg-secondary text-foreground hover:bg-accent",
  outline: "border border-border bg-card text-foreground hover:bg-secondary",
  ghost: "text-muted-foreground hover:bg-secondary hover:text-foreground",
  // Quiet by default: destructive actions shouldn't be the loudest thing on screen.
  danger: "text-red-700 hover:bg-red-50",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-8 gap-1.5 px-3 text-sm [&_svg]:size-4",
  md: "h-10 gap-2 px-4 text-sm [&_svg]:size-4",
  lg: "h-12 gap-2 px-6 text-base [&_svg]:size-5",
  icon: "size-10 [&_svg]:size-5",
  "icon-sm": "size-8 [&_svg]:size-4",
};

/** The one place button styles live; use it for links that look like buttons too. */
export function buttonClasses({ variant = "primary", size = "md", block = false, className }: Style = {}): string {
  return cn(
    "inline-flex shrink-0 items-center justify-center rounded-lg font-semibold whitespace-nowrap transition-colors",
    "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none",
    "disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0",
    VARIANTS[variant],
    SIZES[size],
    block && "w-full",
    className,
  );
}

export function Button({ variant, size, block, className, type = "button", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & Style) {
  return <button type={type} className={buttonClasses({ variant, size, block, className })} {...props} />;
}

export function ButtonLink({ variant, size, block, className, ...props }: ComponentProps<typeof Link> & Style) {
  return <Link className={buttonClasses({ variant, size, block, className })} {...props} />;
}
