"use client";

import { useEffect, useState, type FormEvent } from "react";
import { usernameError } from "@/lib/users/username";
import { buttonClasses } from "./ui/button";

type Status = { state: "idle" | "checking" | "ok" | "bad"; message: string | null };

type Props = {
  initial?: string;
  submitLabel: string;
  disabled?: boolean;
  onSaved: (username: string) => void;
};

/** Username input with a live availability check and a submit button. */
export function UsernameField({ initial = "", submitLabel, disabled, onSaved }: Props) {
  const [value, setValue] = useState(initial);
  const [status, setStatus] = useState<Status>({ state: "idle", message: null });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = value.trim();
  const unchanged = initial !== "" && trimmed === initial;

  useEffect(() => {
    if (!trimmed || unchanged) return;
    const local = usernameError(trimmed);
    const controller = new AbortController();
    const t = setTimeout(async () => {
      if (local) {
        setStatus({ state: "bad", message: local });
        return;
      }
      setStatus({ state: "checking", message: "Checking…" });
      try {
        const res = await fetch(`/api/usernames/check?u=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal,
        });
        const data = await res.json();
        if (!res.ok) setStatus({ state: "bad", message: data.error ?? "Couldn't check that username." });
        else if (data.available) setStatus({ state: "ok", message: "Available" });
        else setStatus({ state: "bad", message: data.reason });
      } catch {
        // Aborted (user kept typing) or offline; the next keystroke retries.
      }
    }, 300);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [trimmed, unchanged]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (status.state !== "ok" || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/me/username", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't save your username.");
      onSaved(data.username);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save your username.");
    } finally {
      setSaving(false);
    }
  }

  const tone =
    status.state === "ok" ? "text-primary" : status.state === "bad" ? "text-destructive" : "text-muted-foreground";

  return (
    <form onSubmit={submit} className="w-full">
      <div className="flex h-10 items-center rounded-lg border border-input bg-background focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15">
        <span className="pl-3 text-muted-foreground">@</span>
        <input
          value={value}
          onChange={(e) => {
            setValue(e.target.value.replace(/\s/g, "").slice(0, 20));
            setStatus({ state: "idle", message: null });
            setError(null);
          }}
          disabled={disabled || saving}
          autoFocus
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          placeholder="username"
          aria-label="Username"
          aria-describedby="username-status"
          className="h-full min-w-0 flex-1 bg-transparent px-2 outline-none disabled:opacity-60"
        />
      </div>
      <p id="username-status" className={`mt-1.5 min-h-5 text-sm ${tone}`} aria-live="polite">
        {unchanged ? "This is your current username." : (status.message ?? "3–20 letters, numbers or underscores.")}
      </p>
      {error && (
        <p className="mt-1 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={disabled || saving || status.state !== "ok" || unchanged}
        className={buttonClasses({ block: true, className: "mt-3" })}
      >
        {saving ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
