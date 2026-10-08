/** Computer opponents. Safe to import on both server and client. */

export type BotKind = "random" | "greedy" | "lookahead" | "stockfish";

export type BotDef = {
  /** Stored as the player id in games, e.g. games.black_id = "bot:leo". */
  id: string;
  name: string;
  /** Rough playing strength, for display. */
  rating: string;
  /** Fixed Glicko rating used when a rated game against this bot ends. */
  ratingValue: number;
  blurb: string;
  avatar: string;
  kind: BotKind;
  /** Stockfish strength limit (UCI_Elo). Omitted = full strength. */
  elo?: number;
  /** Roughly how long the bot "thinks" per move, before scaling for the clock. */
  thinkMs: number;
};

export const BOTS: BotDef[] = [
  { id: "bot:randy", name: "Randy", rating: "~250", ratingValue: 250, avatar: "🎲", kind: "random", thinkMs: 500, blurb: "Moves at random. Pure chaos." },
  { id: "bot:greta", name: "Greedy Greta", rating: "~400", ratingValue: 400, avatar: "🦊", kind: "greedy", thinkMs: 600, blurb: "Grabs whatever she can reach." },
  { id: "bot:leo", name: "Lookahead Leo", rating: "~800", ratingValue: 800, avatar: "🦉", kind: "lookahead", thinkMs: 700, blurb: "Checks your best reply first." },
  { id: "bot:clara", name: "Club Clara", rating: "1400", ratingValue: 1400, avatar: "♘", kind: "stockfish", elo: 1400, thinkMs: 700, blurb: "A solid club player." },
  { id: "bot:ezra", name: "Expert Ezra", rating: "1800", ratingValue: 1800, avatar: "♗", kind: "stockfish", elo: 1800, thinkMs: 900, blurb: "Punishes loose pieces." },
  { id: "bot:mira", name: "Master Mira", rating: "2200", ratingValue: 2200, avatar: "♖", kind: "stockfish", elo: 2200, thinkMs: 1000, blurb: "Master-level technique." },
  { id: "bot:gus", name: "Grandmaster Gus", rating: "2600", ratingValue: 2600, avatar: "♕", kind: "stockfish", elo: 2600, thinkMs: 1200, blurb: "Grandmaster strength." },
  { id: "bot:stockfish", name: "Stockfish", rating: "3000+", ratingValue: 3200, avatar: "♚", kind: "stockfish", thinkMs: 1500, blurb: "Full strength. Good luck." },
];

export function isBotId(id: string | null | undefined): boolean {
  return !!id && id.startsWith("bot:");
}

export function getBot(id: string | null | undefined): BotDef | undefined {
  return BOTS.find((b) => b.id === id);
}

/**
 * How long the bot should spend on a move: its usual think time, scaled down
 * when its clock is low so it doesn't burn all its time in faster games.
 */
export function botThinkMs(bot: BotDef, remainingMs: number | null): number {
  if (remainingMs === null) return bot.thinkMs;
  return Math.max(150, Math.min(bot.thinkMs, Math.floor(remainingMs / 30)));
}
