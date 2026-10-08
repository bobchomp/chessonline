"use client";

import type { BotDef } from "./definitions";
import { greedyMove, lookaheadMove, randomMove, type BotMove } from "./simple";

/** Picks the bot's move for `fen`. Runs entirely in the browser. */
export async function computeBotMove(bot: BotDef, fen: string, thinkMs: number): Promise<BotMove | null> {
  switch (bot.kind) {
    case "random":
      return randomMove(fen);
    case "greedy":
      return greedyMove(fen);
    case "lookahead":
      return lookaheadMove(fen);
    case "stockfish":
      try {
        const { getEngine } = await import("./engine");
        return await getEngine().bestMove(fen, { elo: bot.elo, movetimeMs: thinkMs });
      } catch (err) {
        // If the engine can't load (very old browser, blocked WebAssembly), keep the game going.
        console.error("Stockfish failed; falling back to a simple bot", err);
        return lookaheadMove(fen);
      }
  }
}
