"use client";

import type { BotMove } from "./simple";

/**
 * Stockfish (WebAssembly) running in a Web Worker on the player's device.
 * One shared engine per tab; requests are queued and answered one at a time.
 */
class StockfishEngine {
  private worker: Worker;
  private ready: Promise<void>;
  private queue: Promise<unknown> = Promise.resolve();
  private listeners = new Set<(line: string) => void>();

  constructor() {
    this.worker = new Worker("/engine/stockfish.js");
    this.worker.onmessage = (e: MessageEvent) => {
      const line = typeof e.data === "string" ? e.data : "";
      for (const l of this.listeners) l(line);
    };
    this.ready = (async () => {
      this.send("uci");
      await this.waitFor((l) => l === "uciok");
      this.send("isready");
      await this.waitFor((l) => l === "readyok");
    })();
  }

  private send(cmd: string) {
    this.worker.postMessage(cmd);
  }

  private waitFor(match: (line: string) => boolean, timeoutMs = 20_000): Promise<string> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.listeners.delete(onLine);
        reject(new Error("Engine timed out"));
      }, timeoutMs);
      const onLine = (line: string) => {
        if (!match(line)) return;
        clearTimeout(timer);
        this.listeners.delete(onLine);
        resolve(line);
      };
      this.listeners.add(onLine);
    });
  }

  /** Best move for `fen`, at an optional Elo limit, thinking for about `movetimeMs`. */
  bestMove(fen: string, opts: { elo?: number; movetimeMs: number }): Promise<BotMove | null> {
    const run = async () => {
      await this.ready;
      if (opts.elo) {
        this.send("setoption name UCI_LimitStrength value true");
        this.send(`setoption name UCI_Elo value ${opts.elo}`);
      } else {
        this.send("setoption name UCI_LimitStrength value false");
      }
      this.send("isready");
      await this.waitFor((l) => l === "readyok");
      this.send(`position fen ${fen}`);
      this.send(`go movetime ${Math.max(50, Math.round(opts.movetimeMs))}`);
      const line = await this.waitFor((l) => l.startsWith("bestmove"), opts.movetimeMs + 15_000);
      const uci = line.split(/\s+/)[1];
      if (!uci || uci === "(none)") return null;
      return { from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || undefined };
    };
    const result = this.queue.then(run, run);
    this.queue = result.catch(() => {});
    return result;
  }
}

let engine: StockfishEngine | null = null;

export function getEngine(): StockfishEngine {
  engine ??= new StockfishEngine();
  return engine;
}
