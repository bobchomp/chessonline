// Builds lib/puzzles/puzzles.json, the daily puzzle pool, from the Lichess puzzle
// database (CC0, https://database.lichess.org/#puzzles).
//
//   zstd -dc lichess_db_puzzle.csv.zst | node scripts/build-puzzles.mjs
//
// There's one pool per weekday, getting harder from Monday to Sunday. Each pool
// prefers puzzles Lichess itself chose as a daily puzzle, then the most popular,
// most-played ones, with a cap per tactic so the days don't all feel the same.
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { Chess } from "chess.js";

const PER_DAY = 200; // ~3.8 years before a weekday's pool repeats
const BANDS = [
  [900, 1150], // Monday
  [1150, 1350],
  [1350, 1550],
  [1550, 1750],
  [1750, 1950],
  [1950, 2150],
  [2150, 2450], // Sunday
];
// Tags that describe the tactic (rather than length, phase or advantage), for variety.
const MOTIFS = new Set([
  "fork", "pin", "skewer", "discoveredAttack", "doubleCheck", "deflection", "attraction", "clearance",
  "interference", "intermezzo", "sacrifice", "trappedPiece", "hangingPiece", "capturingDefender",
  "xRayAttack", "zugzwang", "quietMove", "defensiveMove", "promotion", "underPromotion", "backRankMate",
  "smotheredMate", "mateIn1", "mateIn2", "mateIn3", "mateIn4", "exposedKing", "kingsideAttack", "queensideAttack",
  "advancedPawn", "enPassant", "castling",
]);
const MAX_PER_MOTIF = 0.18; // no single tactic more than ~18% of a pool

/** Every move must be legal; returns false for anything chess.js rejects. */
function valid(fen, moves) {
  try {
    const chess = new Chess(fen);
    for (const m of moves) chess.move({ from: m.slice(0, 2), to: m.slice(2, 4), promotion: m[4] });
    return true;
  } catch {
    return false;
  }
}

const candidates = BANDS.map(() => []);
const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
let header = null;
for await (const line of rl) {
  if (!header) {
    header = line.split(",");
    continue;
  }
  const f = line.split(",");
  const row = Object.fromEntries(header.map((h, i) => [h, f[i] ?? ""]));
  const rating = +row.Rating;
  const band = BANDS.findIndex(([lo, hi]) => rating >= lo && rating < hi);
  if (band < 0) continue;
  const moves = row.Moves.split(" ");
  const daily = !!row.DailyDate;
  const popular = +row.Popularity >= 92 && +row.NbPlays >= 3000 && +row.RatingDeviation <= 80;
  if (!daily && !popular) continue;
  if (moves.length < 2 || moves.length > (daily ? 10 : 8)) continue;
  candidates[band].push({
    id: row.PuzzleId,
    fen: row.FEN,
    moves,
    rating,
    themes: row.Themes.split(" ").filter(Boolean),
    game: row.GameUrl.replace("https://lichess.org/", ""),
    daily,
    score: (daily ? 1e9 : 0) + +row.Popularity * 1e6 + Math.min(+row.NbPlays, 999999),
  });
}

// A fixed shuffle so the build is reproducible.
function seeded(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

const pools = candidates.map((list, i) => {
  list.sort((a, b) => b.score - a.score);
  const picked = [];
  const motifCount = new Map();
  const games = new Set();
  for (const p of list) {
    if (picked.length >= PER_DAY) break;
    const gameId = p.game.split(/[/#]/)[0];
    if (games.has(gameId)) continue;
    const motifs = p.themes.filter((t) => MOTIFS.has(t));
    if (motifs.some((m) => (motifCount.get(m) ?? 0) >= PER_DAY * MAX_PER_MOTIF)) continue;
    if (!valid(p.fen, p.moves)) continue;
    picked.push(p);
    games.add(gameId);
    for (const m of motifs) motifCount.set(m, (motifCount.get(m) ?? 0) + 1);
  }
  if (picked.length < PER_DAY) throw new Error(`Only ${picked.length} puzzles for weekday ${i}`);
  const rand = seeded(i + 1);
  for (let j = picked.length - 1; j > 0; j--) {
    const k = Math.floor(rand() * (j + 1));
    [picked[j], picked[k]] = [picked[k], picked[j]];
  }
  const dailies = picked.filter((p) => p.daily).length;
  console.error(`weekday ${i}: ${list.length} candidates, ${picked.length} picked (${dailies} Lichess daily picks)`);
  return picked.map(({ id, fen, moves, rating, themes, game }) => ({ id, fen, moves: moves.join(" "), rating, themes: themes.join(" "), game }));
});

const out = path.join(import.meta.dirname, "..", "lib", "puzzles", "puzzles.json");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify({ source: "Lichess puzzle database (CC0)", pools }) + "\n");
console.error(`wrote ${out} (${(fs.statSync(out).size / 1024).toFixed(0)} KB)`);
