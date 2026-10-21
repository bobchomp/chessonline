import { cn } from "./cn";

// Soft, readable backgrounds; a player always gets the same one.
const TONES = [
  "bg-emerald-100 text-emerald-800",
  "bg-sky-100 text-sky-800",
  "bg-amber-100 text-amber-800",
  "bg-rose-100 text-rose-800",
  "bg-violet-100 text-violet-800",
  "bg-teal-100 text-teal-800",
  "bg-orange-100 text-orange-800",
  "bg-indigo-100 text-indigo-800",
];

const SIZES = {
  xs: "size-6 text-[11px]",
  sm: "size-8 text-sm",
  md: "size-10 text-base",
  lg: "size-14 text-xl",
  xl: "size-20 text-3xl",
};

function toneFor(name: string): string {
  let h = 0;
  for (const ch of name.toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TONES[h % TONES.length];
}

/**
 * A round avatar: the player's initial on a colour picked from their name, or an
 * emoji for computer opponents. `status` adds a dot: online, offline or playing.
 */
export function Avatar({
  name,
  emoji,
  icon,
  size = "sm",
  status,
  className,
}: {
  name: string;
  emoji?: string;
  /** An icon instead of a letter, e.g. for "waiting for an opponent". */
  icon?: React.ReactNode;
  size?: keyof typeof SIZES;
  status?: "online" | "offline" | "playing";
  className?: string;
}) {
  return (
    <span className={cn("relative inline-flex shrink-0", className)} aria-hidden>
      <span
        className={cn(
          "flex items-center justify-center rounded-full font-semibold select-none",
          SIZES[size],
          emoji || icon ? "bg-secondary text-muted-foreground [&_svg]:size-[45%]" : toneFor(name),
        )}
      >
        {icon ?? emoji ?? (name.trim()[0] ?? "?").toUpperCase()}
      </span>
      {status && (
        <span
          title={status === "playing" ? "Playing" : status === "online" ? "Online" : "Offline"}
          className={cn(
            "absolute -right-0.5 -bottom-0.5 block size-3 rounded-full ring-2 ring-card",
            status === "online" ? "bg-emerald-500" : status === "playing" ? "bg-amber-500" : "bg-neutral-300",
          )}
        />
      )}
    </span>
  );
}
