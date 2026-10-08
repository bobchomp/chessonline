import { inArray } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { profiles, type Game } from "@/lib/db/schema";
import { getBot } from "@/lib/bots/definitions";
import type { GamePatch } from "@/lib/game/rules";
import { DEFAULT_RATING, decayRd, isProvisional, rate, type Glicko } from "./glicko2";

/** Computer opponents have a known, fixed strength. */
const BOT_RD = 60;
const DAY_MS = 86_400_000;

export type ProfileRatingWrite = {
  userId: string;
  rating: number;
  ratingRd: number;
  ratingVol: number;
  ratedGames: number;
  peakRating: number | null;
  ratedAt: Date;
};

export type RatingUpdate = {
  gamePatch: Pick<GamePatch, "whiteRating" | "blackRating" | "whiteRatingDiff" | "blackRatingDiff">;
  profiles: ProfileRatingWrite[];
};

type Side = { userId: string | null; before: Glicko; ratedGames: number; peak: number | null };

/** Whether finishing `game` with `patch` should change ratings. */
export function shouldRate(game: Game, patch: GamePatch): boolean {
  return (
    game.rated &&
    game.status === "active" &&
    patch.status === "finished" &&
    !!patch.result &&
    !!game.whiteId &&
    !!game.blackId &&
    (patch.moves ?? game.moves).length >= 2
  );
}

/**
 * Glicko-2 updates for a rated game that `patch` is about to finish, or null if
 * it isn't rated. Pure apart from reading the two players' current ratings.
 */
export async function ratingUpdateFor(game: Game, patch: GamePatch, now: Date): Promise<RatingUpdate | null> {
  if (!shouldRate(game, patch)) return null;
  const ids = [game.whiteId!, game.blackId!];
  const humanIds = ids.filter((id) => !getBot(id));
  const rows = humanIds.length
    ? await getDb().select().from(profiles).where(inArray(profiles.userId, humanIds))
    : [];

  const side = (id: string): Side => {
    const bot = getBot(id);
    if (bot) return { userId: null, before: { rating: bot.ratingValue, rd: BOT_RD, vol: 0.06 }, ratedGames: 0, peak: null };
    const p = rows.find((r) => r.userId === id);
    if (!p) return { userId: id, before: DEFAULT_RATING, ratedGames: 0, peak: null };
    const g = { rating: p.rating, rd: p.ratingRd, vol: p.ratingVol };
    const days = p.ratedAt ? (now.getTime() - p.ratedAt.getTime()) / DAY_MS : 0;
    return { userId: id, before: { ...g, rd: decayRd(g, days) }, ratedGames: p.ratedGames, peak: p.peakRating };
  };
  const white = side(ids[0]);
  const black = side(ids[1]);
  const whiteScore = patch.result === "1-0" ? 1 : patch.result === "0-1" ? 0 : 0.5;

  const writes: ProfileRatingWrite[] = [];
  const diffFor = (s: Side, opponent: Side, score: number): number | null => {
    if (!s.userId) return null;
    const after = rate(s.before, opponent.before, score);
    writes.push({
      userId: s.userId,
      rating: after.rating,
      ratingRd: after.rd,
      ratingVol: after.vol,
      ratedGames: s.ratedGames + 1,
      // Peaks only count once the rating is established.
      peakRating: isProvisional(after.rd) ? s.peak : Math.max(s.peak ?? 0, after.rating),
      ratedAt: now,
    });
    return Math.round(after.rating) - Math.round(s.before.rating);
  };

  return {
    gamePatch: {
      whiteRating: Math.round(white.before.rating),
      blackRating: Math.round(black.before.rating),
      whiteRatingDiff: diffFor(white, black, whiteScore),
      blackRatingDiff: diffFor(black, white, 1 - whiteScore),
    },
    profiles: writes,
  };
}
