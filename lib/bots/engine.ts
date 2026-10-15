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

  /**
   * Full-strength analysis of `fen` for about `movetimeMs`, looking at the top two
   * moves. Scores are from the side to move's point of view.
   */
  analyse(
    fen: string,
    movetimeMs: number,
  ): Promise<{ score: EngineScore | null; second: EngineScore | null; best: string | null; pv: string[] }> {
    const run = async () => {
      await this.ready;
      this.send("setoption name UCI_LimitStrength value false");
      this.send("setoption name MultiPV value 2");
      this.send("isready");
      await this.waitFor((l) => l === "readyok");
      const scores: (EngineScore | null)[] = [null, null, null];
      const pvs: string[][] = [[], [], []];
      const onInfo = (line: string) => {
        const score = parseScore(line);
        if (!score) return;
        const k = Number(/ multipv (\d+)/.exec(line)?.[1] ?? 1);
        if (k !== 1 && k !== 2) return;
        scores[k] = score;
        const pv = / pv (.+)$/.exec(line)?.[1];
        if (pv) pvs[k] = pv.trim().split(/\s+/).slice(0, 10);
      };
      this.listeners.add(onInfo);
      try {
        this.send(`position fen ${fen}`);
        this.send(`go movetime ${Math.max(50, Math.round(movetimeMs))}`);
        const line = await this.waitFor((l) => l.startsWith("bestmove"), movetimeMs + 15_000);
        const uci = line.split(/\s+/)[1];
        const best = uci && uci !== "(none)" ? uci : null;
        return { score: scores[1], second: scores[2], best, pv: pvs[1].length ? pvs[1] : best ? [best] : [] };
      } finally {
        this.listeners.delete(onInfo);
        this.send("setoption name MultiPV value 1");
      }
    };
    const result = this.queue.then(run, run);
    this.queue = result.catch(() => {});
    return result;
  }
}

export type EngineScore = { cp: number } | { mate: number };

/** Parses the score from a UCI "info" line, ignoring partial (bound) scores. */
export function parseScore(line: string): EngineScore | null {
  if (!line.startsWith("info") || / (lowerbound|upperbound)/.test(line)) return null;
  const m = / score (cp|mate) (-?\d+)/.exec(line);
  if (!m) return null;
  return m[1] === "cp" ? { cp: Number(m[2]) } : { mate: Number(m[2]) };
}

let engine: StockfishEngine | null = null;

export function getEngine(): StockfishEngine {
  engine ??= new StockfishEngine();
  return engine;
}
