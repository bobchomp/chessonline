import type { Color } from "@/lib/db/schema";

/** How many recent games count towards a player's color balance. */
export const COLOR_HISTORY_GAMES = 10;
/** Nobody gets the same color more than this many games in a row from a "random" pick. */
const MAX_STREAK = 2;

/** The color a player most needs next: positive leans white, negative leans black. */
function need(history: Color[]): { streak: Color | null; lean: number } {
  const recent = history.slice(0, COLOR_HISTORY_GAMES);
  const run = recent.findIndex((c) => c !== recent[0]);
  const streakLen = recent.length === 0 ? 0 : run === -1 ? recent.length : run;
  const blacks = recent.filter((c) => c === "black").length;
  return {
    streak: streakLen >= MAX_STREAK ? recent[0] : null,
    lean: recent.length ? (blacks - (recent.length - blacks)) / recent.length : 0,
  };
}

/**
 * "Random" color for the game creator that still feels fair: a coin flip that
 * leans towards whichever color the player has had less of lately, and never
 * hands out the same color three games in a row. For friend challenges the
 * opponent's history counts too (whatever the creator gets, they get the other).
 *
 * `history` lists the player's colors, most recent game first. `roll` is a
 * uniform number in [0, 1).
 */
export function pickFairColor(history: Color[], opponentHistory: Color[] | null, roll: number): Color {
  const me = need(history);
  const them = opponentHistory ? need(opponentHistory) : { streak: null, lean: 0 };
  const opposite = (c: Color): Color => (c === "white" ? "black" : "white");

  // Break streaks first, unless that would extend the opponent's.
  if (me.streak && (!them.streak || them.streak === me.streak)) return opposite(me.streak);
  if (them.streak && !me.streak) return them.streak;

  // Otherwise a weighted coin flip: 50/50 when balanced, up to 85/15 when lopsided.
  const lean = opponentHistory ? (me.lean - them.lean) / 2 : me.lean;
  const pWhite = Math.min(0.85, Math.max(0.15, 0.5 + 0.35 * lean));
  return roll < pWhite ? "white" : "black";
}
