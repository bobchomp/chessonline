"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { MessageCircle, SendHorizontal } from "lucide-react";
import type { ChatView } from "@/lib/game/view";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";

type Props = {
  messages: ChatView[];
  userId: string;
  onSend: (body: string) => Promise<boolean>;
};

/** Chat with your opponent: speech bubbles, yours on the right. */
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
    <div className="flex flex-col">
      <div ref={list} className="h-60 space-y-2 overflow-y-auto lg:h-72">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center text-center text-sm text-muted-foreground">
            <MessageCircle className="mb-2 size-5" aria-hidden />
            No messages yet. Say hi to your opponent.
          </div>
        )}
        {messages.map((m) => {
          const mine = m.userId === userId;
          return (
            <div key={m.id} className={cn("flex flex-col", mine ? "items-end" : "items-start")}>
              {!mine && <span className="mb-0.5 px-1 text-xs text-muted-foreground">{m.userName}</span>}
              <p
                className={cn(
                  "max-w-[85%] rounded-2xl px-3 py-1.5 text-sm break-words",
                  mine ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md bg-secondary",
                )}
              >
                {m.body}
              </p>
            </div>
          );
        })}
      </div>
      <form onSubmit={submit} className="mt-3 flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={500}
          placeholder="Write a message"
          aria-label="Chat message"
          className="h-10 min-w-0 flex-1 rounded-lg border border-input bg-background px-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/15"
        />
        <Button type="submit" size="icon" variant="secondary" aria-label="Send" disabled={!draft.trim() || sending}>
          <SendHorizontal />
        </Button>
      </form>
    </div>
  );
}
