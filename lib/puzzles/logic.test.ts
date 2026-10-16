import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import data from "./puzzles.json";
import {
  PUZZLE_EPOCH,
  addDays,
  computePuzzleStats,
  isCorrectMove,
  isPlayableDay,
  isValidDay,
  outcomeOf,
  poolSlot,
  solutionSan,
  solverColor,
  themeNames,
  utcDay,
  weekdayIndex,
  type Puzzle,
  type PuzzleRecord,
} from "./logic";

describe("days", () => {
  it("works in UTC calendar days", () => {
    expect(utcDay(new Date("2026-10-16T23:59:59Z"))).toBe("2026-10-16");
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
    expect(addDays("2026-03-29", -1)).toBe("2026-03-28"); // across the UK clock change
    expect(isValidDay("2026-02-30")).toBe(false);
    expect(isValidDay("2026-1-5")).toBe(false);
    expect(isValidDay("2026-13-01")).toBe(false);
    expect(weekdayIndex(PUZZLE_EPOCH)).toBe(0); // the epoch is a Monday
    expect(weekdayIndex("2026-10-18")).toBe(6); // Sunday
  });

  it("steps through each weekday's pool one week at a time", () => {
    expect(poolSlot(PUZZLE_EPOCH, 200)).toEqual({ weekday: 0, index: 0 });
    expect(poolSlot(addDays(PUZZLE_EPOCH, 6), 200)).toEqual({ weekday: 6, index: 0 });
    expect(poolSlot(addDays(PUZZLE_EPOCH, 7), 200)).toEqual({ weekday: 0, index: 1 });
    // Wraps round once the pool runs out.
    expect(poolSlot(addDays(PUZZLE_EPOCH, 7 * 200), 200)).toEqual({ weekday: 0, index: 0 });
  });

  it("only today and the last 30 days are playable", () => {
    const today = "2026-10-16";
    expect(isPlayableDay(today, today)).toBe(true);
    expect(isPlayableDay("2026-09-17", today)).toBe(true);
    expect(isPlayableDay("2026-09-16", today)).toBe(false);
    expect(isPlayableDay("2026-10-17", today)).toBe(false);
    expect(isPlayableDay("nonsense", today)).toBe(false);
  });
});

describe("solving", () => {
  // Scholar's mate set-up: after 1. e4 e5 2. Bc4 Nc6 3. Qh5, Black blunders 3... Nf6, and White mates.
  const puzzle: Puzzle = {
    id: "test",
    fen: "r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 3 3",
    moves: ["g8f6", "h5f7"],
    rating: 900,
    themes: ["mate", "mateIn1", "opening", "short"],
    game: "abc",
  };

  it("knows who's solving and the solution", () => {
    expect(solverColor(puzzle)).toBe("white");
    expect(solutionSan(puzzle)).toEqual(["Qxf7#"]);
  });

  it("accepts the expected move or any other checkmate", () => {
    const fen = "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4";
    expect(isCorrectMove(fen, "h5f7", "h5f7")).toBe(true);
    expect(isCorrectMove(fen, "c4f7", "h5f7")).toBe(false); // a check, but not mate
    expect(isCorrectMove(fen, "h5h4", "h5f7")).toBe(false);
    // Two ways to mate: the back rank with either rook.
    const twoMates = "6k1/5ppp/8/8/8/8/5PPP/R3R1K1 w - - 0 1";
    expect(isCorrectMove(twoMates, "e1e8", "a1a8")).toBe(true);
  });

  it("names themes and hides the bookkeeping ones", () => {
    expect(themeNames(["mate", "mateIn1", "opening", "short", "crushing"])).toEqual(["Mate in 1", "Opening"]);
    expect(themeNames(["hookMate"])).toEqual(["Hook Mate"]);
  });
});

describe("results and streaks", () => {
  const rec = (day: string, status: PuzzleRecord["status"], opts: Partial<PuzzleRecord> = {}): PuzzleRecord => ({
    day,
    status,
    mistakes: 0,
    hints: 0,
    onTime: true,
    completedAt: new Date(`${day}T10:00:00Z`),
    ...opts,
  });

  it("labels outcomes", () => {
    expect(outcomeOf(rec("2026-10-16", "solved"))).toBe("perfect");
    expect(outcomeOf(rec("2026-10-16", "solved", { hints: 1 }))).toBe("solved");
    expect(outcomeOf(rec("2026-10-16", "revealed"))).toBe("revealed");
    expect(outcomeOf(null)).toBeNull();
  });

  it("counts streaks of on-time solves", () => {
    const records = [
      rec("2026-10-10", "solved"),
      rec("2026-10-11", "solved"),
      rec("2026-10-12", "solved"),
      rec("2026-10-13", "revealed"), // breaks the run
      rec("2026-10-14", "solved", { mistakes: 2 }),
      rec("2026-10-15", "solved"),
    ];
    // Today's not done yet, so the streak still stands from yesterday.
    expect(computePuzzleStats(records, "2026-10-16")).toEqual({ solved: 5, perfect: 4, currentStreak: 2, bestStreak: 3 });
    expect(computePuzzleStats([...records, rec("2026-10-16", "solved")], "2026-10-16").currentStreak).toBe(3);
    // Missing a whole day ends it.
    expect(computePuzzleStats(records, "2026-10-17").currentStreak).toBe(0);
    // Catching up from the archive doesn't fill the gap.
    const catchUp = [...records, rec("2026-10-13", "solved", { onTime: false })].filter((r) => r.status === "solved");
    expect(computePuzzleStats(catchUp, "2026-10-16").bestStreak).toBe(3);
  });
});

describe("the puzzle pool", () => {
  it("has seven equal weekday pools, getting harder through the week", () => {
    expect(data.pools).toHaveLength(7);
    const sizes = new Set(data.pools.map((p) => p.length));
    expect(sizes.size).toBe(1);
    const avg = data.pools.map((pool) => pool.reduce((s, p) => s + p.rating, 0) / pool.length);
    for (let i = 1; i < 7; i++) expect(avg[i]).toBeGreaterThan(avg[i - 1]);
  });

  it("every puzzle is legal and mate puzzles end in mate", () => {
    const ids = new Set<string>();
    for (const pool of data.pools) {
      for (const p of pool) {
        expect(ids.has(p.id)).toBe(false);
        ids.add(p.id);
        const chess = new Chess(p.fen);
        for (const m of p.moves.split(" ")) chess.move({ from: m.slice(0, 2), to: m.slice(2, 4), promotion: m[4] });
        if (p.themes.split(" ").includes("mate")) expect(chess.isCheckmate()).toBe(true);
      }
    }
  });
});
