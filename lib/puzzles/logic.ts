import { Chess, type Square } from "chess.js";

/**
 * Daily puzzles: one a day, the same for everyone, changing at midnight UTC.
 * This file is pure (no data or database), so the browser and tests use it too.
 */

export type Puzzle = {
  /** Lichess puzzle id. */
  id: string;
  /** The position before the opponent's last move. */
  fen: string;
  /** UCI moves: the opponent's move that sets the puzzle, then the solution (yours, theirs, yours…). */
  moves: string[];
  rating: number;
  /** Lichess theme tags, e.g. "fork", "mateIn2". */
  themes: string[];
  /** Where it came from on Lichess, e.g. "787zsVup/black#48". */
  game: string;
};

export type DailyPuzzle = Puzzle & {
  day: string;
  weekday: string;
  difficulty: Difficulty;
};

export type Difficulty = "Easy" | "Medium" | "Hard" | "Expert";

/** Monday-first, matching the weekday pools in puzzles.json (easiest first). */
export const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
export const DIFFICULTY: Difficulty[] = ["Easy", "Easy", "Medium", "Medium", "Hard", "Hard", "Expert"];

/** The first daily puzzle. A Monday, so week numbers line up with the weekday pools. */
export const PUZZLE_EPOCH = "2026-01-05";
/** How far back the archive goes. */
export const ARCHIVE_DAYS = 30;

const DAY_MS = 86_400_000;

/** "2026-10-16" for a moment in time, in UTC. */
export function utcDay(at: Date = new Date()): string {
  return at.toISOString().slice(0, 10);
}

export function isValidDay(day: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const at = new Date(`${day}T00:00:00Z`);
  return !Number.isNaN(at.getTime()) && utcDay(at) === day;
}

export function addDays(day: string, n: number): string {
  return utcDay(new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS));
}

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

/** 0 = Monday … 6 = Sunday. */
export function weekdayIndex(day: string): number {
  return (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7;
}

/** Which puzzle a day gets: its weekday's pool, stepping through it one week at a time. */
export function poolSlot(day: string, poolSize: number): { weekday: number; index: number } {
  const week = Math.floor(daysBetween(PUZZLE_EPOCH, day) / 7);
  return { weekday: weekdayIndex(day), index: ((week % poolSize) + poolSize) % poolSize };
}

/** Days a player can open: the archive window, not before the first puzzle, not in the future. */
export function isPlayableDay(day: string, today: string): boolean {
  if (!isValidDay(day)) return false;
  const back = daysBetween(day, today);
  return back >= 0 && back < ARCHIVE_DAYS && day >= PUZZLE_EPOCH;
}

// ---- solving -------------------------------------------------------------------

/** The side solving the puzzle: whoever moves after the opponent's opening move. */
export function solverColor(p: Puzzle): "white" | "black" {
  return p.fen.split(" ")[1] === "w" ? "black" : "white";
}

export function uciOf(m: { from: string; to: string; promotion?: string }): string {
  return m.from + m.to + (m.promotion ?? "");
}

/** Plays a UCI move; returns the new FEN and SAN, or null if it's illegal. */
export function applyUci(fen: string, uci: string): { fen: string; san: string } | null {
  const chess = new Chess(fen);
  try {
    const m = chess.move({ from: uci.slice(0, 2) as Square, to: uci.slice(2, 4) as Square, promotion: uci[4] });
    return { fen: chess.fen(), san: m.san };
  } catch {
    return null;
  }
}

/**
 * Whether `uci` solves this step. The expected move always does; so does any
 * other checkmate (Lichess accepts those too, as the puzzle is over either way).
 */
export function isCorrectMove(fen: string, uci: string, expected: string): boolean {
  if (uci === expected) return true;
  const chess = new Chess(fen);
  try {
    chess.move({ from: uci.slice(0, 2) as Square, to: uci.slice(2, 4) as Square, promotion: uci[4] });
  } catch {
    return false;
  }
  return chess.isCheckmate();
}

/** The solution as SAN moves, starting after the opponent's opening move. */
export function solutionSan(p: Puzzle): string[] {
  let fen = p.fen;
  const san: string[] = [];
  p.moves.forEach((m, i) => {
    const r = applyUci(fen, m);
    if (!r) return;
    fen = r.fen;
    if (i > 0) san.push(r.san);
  });
  return san;
}

// ---- themes --------------------------------------------------------------------

const THEME_NAMES: Record<string, string> = {
  mate: "Checkmate",
  mateIn1: "Mate in 1",
  mateIn2: "Mate in 2",
  mateIn3: "Mate in 3",
  mateIn4: "Mate in 4",
  mateIn5: "Mate in 5+",
  backRankMate: "Back-rank mate",
  smotheredMate: "Smothered mate",
  fork: "Fork",
  pin: "Pin",
  skewer: "Skewer",
  discoveredAttack: "Discovered attack",
  discoveredCheck: "Discovered check",
  doubleCheck: "Double check",
  deflection: "Deflection",
  attraction: "Attraction",
  clearance: "Clearance",
  interference: "Interference",
  intermezzo: "In-between move",
  sacrifice: "Sacrifice",
  trappedPiece: "Trapped piece",
  hangingPiece: "Hanging piece",
  capturingDefender: "Remove the defender",
  xRayAttack: "X-ray",
  zugzwang: "Zugzwang",
  quietMove: "Quiet move",
  defensiveMove: "Defensive move",
  promotion: "Promotion",
  underPromotion: "Underpromotion",
  exposedKing: "Exposed king",
  kingsideAttack: "Kingside attack",
  queensideAttack: "Queenside attack",
  advancedPawn: "Advanced pawn",
  enPassant: "En passant",
  castling: "Castling",
  opening: "Opening",
  middlegame: "Middlegame",
  endgame: "Endgame",
  rookEndgame: "Rook endgame",
  bishopEndgame: "Bishop endgame",
  knightEndgame: "Knight endgame",
  pawnEndgame: "Pawn endgame",
  queenEndgame: "Queen endgame",
  queenRookEndgame: "Queen and rook endgame",
};

/** Tags about length, advantage or source rather than the idea itself; not shown. */
const HIDDEN_THEMES = new Set([
  "short", "long", "veryLong", "oneMove", "crushing", "advantage", "equality", "master", "masterVsMaster", "superGM",
]);

/** Friendly names for the tags worth showing, e.g. ["Fork", "Middlegame"]. */
export function themeNames(themes: string[]): string[] {
  return themes
    .filter((t) => !HIDDEN_THEMES.has(t) && !(t === "mate" && themes.some((x) => /^mateIn\d$/.test(x))))
    .map((t) => THEME_NAMES[t] ?? t.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()));
}

// ---- results and streaks ---------------------------------------------------------

export type PuzzleStatus = "attempted" | "solved" | "revealed";

export type PuzzleRecord = {
  day: string;
  status: PuzzleStatus;
  mistakes: number;
  hints: number;
  /** Solved on the puzzle's own day (archive solves don't count towards the streak). */
  onTime: boolean;
  completedAt: Date | null;
};

/** How many players solved a day's puzzle, and how many first try. */
export type DayStats = { solvers: number; perfect: number };

/** ⭐ first try, ✓ solved, ✗ solution shown. */
export type PuzzleOutcome = "perfect" | "solved" | "revealed" | "attempted" | null;

export function outcomeOf(r: PuzzleRecord | null | undefined): PuzzleOutcome {
  if (!r) return null;
  if (r.status === "solved") return r.mistakes === 0 && r.hints === 0 ? "perfect" : "solved";
  return r.status;
}

export type PuzzleStats = {
  solved: number;
  perfect: number;
  /** Days in a row solving the daily puzzle on the day, up to today (or yesterday, if today's isn't done yet). */
  currentStreak: number;
  bestStreak: number;
};

export function computePuzzleStats(records: PuzzleRecord[], today: string): PuzzleStats {
  const solved = records.filter((r) => r.status === "solved");
  const streakDays = new Set(solved.filter((r) => r.onTime).map((r) => r.day));

  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const day of [...streakDays].sort()) {
    run = prev && daysBetween(prev, day) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = day;
  }

  let current = 0;
  let day = streakDays.has(today) ? today : addDays(today, -1);
  while (streakDays.has(day)) {
    current++;
    day = addDays(day, -1);
  }

  return {
    solved: solved.length,
    perfect: solved.filter((r) => r.mistakes === 0 && r.hints === 0).length,
    currentStreak: current,
    bestStreak: best,
  };
}
