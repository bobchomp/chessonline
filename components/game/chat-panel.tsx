"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import type { ChatView } from "@/lib/game/view";

type Props = {
  messages: ChatView[];
  userId: string;
  onSend: (body: string) => Promise<boolean>;
};

export function ChatPanel({ messages, userId, onSend }: Props) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (list.current) list.current.scrollTop = list.current.scrollHeight;
  }, [messages.length]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    if (await onSend(body)) setDraft("");
    setSending(false);
  }

  return (
    <div className="flex flex-col rounded-xl border border-border bg-card">
      <div className="border-b border-border px-4 py-2 text-sm font-semibold">Chat</div>
      <div ref={list} className="h-48 space-y-1.5 overflow-y-auto px-4 py-3 text-sm">
        {messages.length === 0 && <p className="text-muted-foreground">Say hi to your opponent 👋</p>}
        {messages.map((m) => (
          <p key={m.id} className="break-words">
            <span className={`font-semibold ${m.userId === userId ? "text-primary" : "text-foreground"}`}>
              {m.userId === userId ? "You" : m.userName}:
            </span>{" "}
            <span className="text-foreground/90">{m.body}</span>
          </p>
        ))}
      </div>
      <form onSubmit={submit} className="flex gap-2 border-t border-border p-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={500}
          placeholder="Type a message…"
          aria-label="Chat message"
          className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus:border-primary"
        />
        <button
          type="submit"
          disabled={!draft.trim() || sending}
          className="rounded-md bg-secondary px-3 py-1.5 text-sm font-medium hover:bg-accent disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}
