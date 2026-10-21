"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Bot, Play, Users, Zap } from "lucide-react";
import { BOTS } from "@/lib/bots/definitions";
import { COMPUTER_TIME_CONTROLS } from "@/lib/game/rules";
import { GameOptions, type ColorChoice } from "@/components/game-options";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";
import { Segmented } from "@/components/ui/segmented";
import { QuickMatch } from "./quick-match";

type Mode = "quick" | "friend" | "computer";

const HINTS: Record<Mode, string> = {
  quick: "Play someone online near your rating. Every game counts towards your rating.",
  friend: "Create a game and send your friend the 6-digit PIN. Or challenge someone from your friends list.",
  computer: "No waiting. Pick an opponent from beginner to grandmaster.",
};

/** One card for starting any game: quick match, with a friend, or against the computer. */
export function StartGame() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("quick");
  // Each mode keeps its own time control: people tend to play the computer untimed.
  const [timeControl, setTimeControl] = useState<Record<Exclude<Mode, "quick">, string>>({
    friend: "10+0",
    computer: "untimed",
  });
  const [color, setColor] = useState<ColorChoice>("random");
  const [botId, setBotId] = useState(BOTS[2].id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bot = BOTS.find((b) => b.id === botId) ?? BOTS[0];

  async function start() {
    if (mode === "quick") return; // the Quick match panel has its own button
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(mode === "friend" ? "/api/games" : "/api/bots/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timeControl: timeControl[mode], color, ...(mode === "computer" && { botId }) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't start the game.");
      router.push(`/game/${data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start the game.");
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader title="New game" icon={<Play />} />
      <CardBody className="space-y-5">
        <div>
          <Segmented
            label="Opponent"
            className="w-full sm:w-auto"
            value={mode}
            onChange={(m) => {
              setMode(m);
              setError(null);
            }}
            options={[
              { value: "quick", label: "Quick match", icon: <Zap /> },
              { value: "friend", label: "Friend", icon: <Users /> },
              { value: "computer", label: "Computer", icon: <Bot /> },
            ]}
          />
          <p className="mt-2 text-sm text-muted-foreground">{HINTS[mode]}</p>
        </div>

        {mode === "quick" && <QuickMatch />}

        {mode === "computer" && (
          <fieldset>
            <legend className="text-sm font-medium">Opponent</legend>
            <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              {BOTS.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setBotId(b.id)}
                  aria-pressed={botId === b.id}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-colors",
                    botId === b.id ? "border-primary bg-primary/10 ring-1 ring-primary" : "border-border bg-card hover:bg-secondary",
                  )}
                >
                  <Avatar name={b.name} emoji={b.avatar} size="sm" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm leading-tight font-medium">{b.name}</span>
                    <span className="block text-xs text-muted-foreground tabular-nums">{b.rating}</span>
                  </span>
                </button>
              ))}
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{bot.name}:</span> {bot.blurb}
            </p>
          </fieldset>
        )}

        {mode !== "quick" && (
          <>
            <GameOptions
              timeControl={timeControl[mode]}
              timeControls={mode === "computer" ? COMPUTER_TIME_CONTROLS : undefined}
              color={color}
              onTimeControl={(id) => setTimeControl((t) => ({ ...t, [mode]: id }))}
              onColor={setColor}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button size="lg" block onClick={start} disabled={busy}>
              {mode === "friend" ? <Users /> : <Bot />}
              {busy ? "Starting…" : mode === "friend" ? "Create game and get a PIN" : `Play ${bot.name}`}
            </Button>
          </>
        )}

      </CardBody>
    </Card>
  );
}
