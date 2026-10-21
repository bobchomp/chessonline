export function formatTimeControl(initialMs: number | null, incrementMs: number): string {
  if (initialMs === null) return "Untimed";
  if (initialMs >= 86_400_000) {
    const days = Math.round(initialMs / 86_400_000);
    return `${days} day${days === 1 ? "" : "s"} / move`;
  }
  const minutes = initialMs / 60_000;
  return `${Number.isInteger(minutes) ? minutes : minutes.toFixed(1)}+${Math.round(incrementMs / 1000)}`;
}

export function formatClock(ms: number): string {
  const clamped = Math.max(0, ms);
  // Daily games: "2d 4h", "5h 12m".
  if (clamped >= 86_400_000) {
    const h = Math.floor(clamped / 3_600_000);
    return `${Math.floor(h / 24)}d ${h % 24}h`;
  }
  if (clamped >= 3 * 3_600_000) {
    const m = Math.floor(clamped / 60_000);
    return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
  }
  if (clamped < 10_000) {
    const s = Math.floor(clamped / 1000);
    const tenths = Math.floor((clamped % 1000) / 100);
    return `0:${String(s).padStart(2, "0")}.${tenths}`;
  }
  const total = Math.ceil(clamped / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mmss = `${h ? String(m).padStart(2, "0") : m}:${String(s).padStart(2, "0")}`;
  return h ? `${h}:${mmss}` : mmss;
}

/** "9:41" for minutes, "2h 05m" / "2d 23h" for longer waits (daily challenges). */
export function formatCountdown(ms: number): string {
  if (ms >= 3 * 3_600_000) return formatClock(ms);
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const mmss = `${Math.floor((s % 3600) / 60)}:${String(s % 60).padStart(2, "0")}`;
  return h ? `${h}:${mmss.padStart(5, "0")}` : mmss;
}

export function formatRelative(date: Date, now = new Date()): string {
  const diff = Math.round((now.getTime() - date.getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86_400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 7 * 86_400) return `${Math.floor(diff / 86_400)}d ago`;
  return date.toLocaleDateString();
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "Today", "Yesterday", "Monday 19 October", or "19 October 2025" for older years (UTC days). */
export function dayLabel(date: Date, now = new Date()): string {
  const day = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const diff = Math.round((day(now) - day(date)) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  const dm = `${date.getUTCDate()} ${MONTH_NAMES[date.getUTCMonth()]}`;
  if (date.getUTCFullYear() !== now.getUTCFullYear()) return `${dm} ${date.getUTCFullYear()}`;
  return diff < 7 ? `${DAY_NAMES[date.getUTCDay()]} ${dm}` : dm;
}
