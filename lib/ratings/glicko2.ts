/**
 * Glicko-2 (Mark Glickman, http://www.glicko.net/glicko/glicko2.pdf), applied
 * after every game like Lichess does: each game is its own rating period.
 *
 * - rating: the familiar number (everyone starts at 250)
 * - rd: rating deviation, how unsure we are (200 for a new player, ~50 = very sure)
 * - vol: volatility, how erratic the player's results are
 */
export type Glicko = { rating: number; rd: number; vol: number };

/**
 * New players start at 250 ± 200. Glicko-2's usual 350 is too wide this low down:
 * a first game would swing about ±160 and a single loss would hit the floor.
 * At 200 the first games move about ±80 and a rating settles in about 10 games.
 */
export const DEFAULT_RATING: Glicko = { rating: 250, rd: 200, vol: 0.06 };
/** Shown with a "?" until the system is reasonably sure (Lichess uses the same cut-off). */
export const PROVISIONAL_RD = 110;

const SCALE = 173.7178;
/** Glicko-2's internal scale is centred on 1500. It's only a reference point, not anyone's starting rating. */
const CENTRE = 1500;
/** Constrains volatility changes; Lichess uses 0.75. */
const TAU = 0.75;
const MAX_RD = 350;
/** Time away never makes a rating less certain than a brand-new one. */
const MAX_DECAYED_RD = DEFAULT_RATING.rd;
/** Keeps established ratings from freezing completely. */
const MIN_RD = 45;
const MIN_RATING = 100;
const EPSILON = 0.000001;

export function isProvisional(rd: number): boolean {
  return rd > PROVISIONAL_RD;
}

/**
 * Uncertainty grows while a player is away: RD drifts back towards a new
 * player's by one volatility step per day of inactivity.
 */
export function decayRd(player: Glicko, daysInactive: number): number {
  if (daysInactive <= 0 || player.rd >= MAX_DECAYED_RD) return player.rd;
  const phi = player.rd / SCALE;
  return Math.min(MAX_DECAYED_RD, Math.sqrt(phi * phi + player.vol * player.vol * daysInactive) * SCALE);
}

const g = (phi: number) => 1 / Math.sqrt(1 + (3 * phi * phi) / (Math.PI * Math.PI));
const expected = (mu: number, muJ: number, phiJ: number) => 1 / (1 + Math.exp(-g(phiJ) * (mu - muJ)));

/**
 * New rating for `player` after one game against `opponent`.
 * `score` is 1 for a win, 0.5 for a draw and 0 for a loss.
 */
export function rate(player: Glicko, opponent: Glicko, score: number): Glicko {
  // Step 2: convert to the Glicko-2 scale.
  const mu = (player.rating - CENTRE) / SCALE;
  const phi = player.rd / SCALE;
  const muJ = (opponent.rating - CENTRE) / SCALE;
  const phiJ = opponent.rd / SCALE;

  // Steps 3-4: estimated variance and improvement.
  const gJ = g(phiJ);
  const e = expected(mu, muJ, phiJ);
  const v = 1 / (gJ * gJ * e * (1 - e));
  const delta = v * gJ * (score - e);

  // Step 5: new volatility (Illinois algorithm).
  const a = Math.log(player.vol * player.vol);
  const f = (x: number) => {
    const ex = Math.exp(x);
    return (ex * (delta * delta - phi * phi - v - ex)) / (2 * (phi * phi + v + ex) ** 2) - (x - a) / (TAU * TAU);
  };
  let A = a;
  let B: number;
  if (delta * delta > phi * phi + v) {
    B = Math.log(delta * delta - phi * phi - v);
  } else {
    let k = 1;
    while (f(a - k * TAU) < 0) k++;
    B = a - k * TAU;
  }
  let fA = f(A);
  let fB = f(B);
  for (let i = 0; i < 100 && Math.abs(B - A) > EPSILON; i++) {
    const C = A + ((A - B) * fA) / (fB - fA);
    const fC = f(C);
    if (fC * fB <= 0) {
      A = B;
      fA = fB;
    } else {
      fA /= 2;
    }
    B = C;
    fB = fC;
  }
  const vol = Math.exp(A / 2);

  // Steps 6-8: new deviation and rating, back on the familiar scale.
  const phiStar = Math.sqrt(phi * phi + vol * vol);
  const phiNew = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v);
  const muNew = mu + phiNew * phiNew * gJ * (score - e);

  return {
    rating: Math.max(MIN_RATING, muNew * SCALE + CENTRE),
    rd: Math.min(MAX_RD, Math.max(MIN_RD, phiNew * SCALE)),
    vol,
  };
}
