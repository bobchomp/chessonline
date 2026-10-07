export function formatTimeControl(initialMs: number | null, incrementMs: number): string {
  if (initialMs === null) return "Untimed";
  const minutes = initialMs / 60_000;
  return `${Number.isInteger(minutes) ? minutes : minutes.toFixed(1)}+${Math.round(incrementMs / 1000)}`;
}

export function formatClock(ms: number): string {
  const clamped = Math.max(0, ms);
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

export function formatRelative(date: Date, now = new Date()): string {
  const diff = Math.round((now.getTime() - date.getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86_400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 7 * 86_400) return `${Math.floor(diff / 86_400)}d ago`;
  return date.toLocaleDateString();
}
