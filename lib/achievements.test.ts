import { describe, expect, it } from "vitest";
import { ACHIEVEMENTS, computeAchievements, type FinishedGame } from "./achievements";

const ME = "me";
let day = 0;
function game(outcome: "W" | "L" | "D", opts: { vs?: string; rated?: boolean; asBlack?: boolean } = {}): FinishedGame {
  const asBlack = opts.asBlack ?? false;
  const result = outcome === "D" ? "1/2-1/2" : (outcome === "W") !== asBlack ? "1-0" : "0-1";
  return {
    whiteId: asBlack ? (opts.vs ?? "them") : ME,
    blackId: asBlack ? ME : (opts.vs ?? "them"),
    result,
    rated: opts.rated ?? false,
    endedAt: new Date(Date.UTC(2026, 0, 1) + day++ * 86_400_000),
  };
}
const get = (s: ReturnType<typeof computeAchievements>, id: string) => s.achievements.find((a) => a.id === id)!;

describe("achievements", () => {
  it("a new player has nothing yet, with progress shown", () => {
    const s = computeAchievements(ME, [], null);
    expect(s.unlocked).toBe(0);
    expect(s.achievements).toHaveLength(ACHIEVEMENTS.length);
    expect(get(s, "games-10").progress).toEqual({ current: 0, target: 10 });
    expect(get(s, "first-win").unlockedAt).toBeNull();
  });

  it("first win, first rated game and first friend", () => {
    const games = [game("L"), game("W", { asBlack: true }), game("D", { rated: true })];
    const friendAt = new Date(Date.UTC(2026, 5, 1));
    const s = computeAchievements(ME, games, friendAt);
    expect(get(s, "first-win").unlockedAt).toBe(games[1].endedAt.toISOString());
    expect(get(s, "first-rated").unlockedAt).toBe(games[2].endedAt.toISOString());
    expect(get(s, "first-friend").unlockedAt).toBe(friendAt.toISOString());
  });

  it("game count milestones unlock on the right game", () => {
    const games = Array.from({ length: 12 }, (_, i) => game(i % 2 ? "W" : "L"));
    const s = computeAchievements(ME, games, null);
    expect(get(s, "games-10").unlockedAt).toBe(games[9].endedAt.toISOString());
    expect(get(s, "games-50").progress).toEqual({ current: 12, target: 50 });
  });

  it("streaks: current and best, broken by losses and draws", () => {
    const seq = ["W", "W", "W", "W", "L", "W", "W", "D", "W", "W"] as const;
    const games = seq.map((o) => game(o));
    const s = computeAchievements(ME, games, null);
    expect(s.bestStreak).toBe(4);
    expect(s.currentStreak).toBe(2);
    expect(get(s, "streak-3").unlockedAt).toBe(games[2].endedAt.toISOString());
    expect(get(s, "streak-5").unlockedAt).toBeNull();
    expect(get(s, "streak-5").progress).toEqual({ current: 4, target: 5 });
  });

  it("works out order from the end time, whatever order games arrive in", () => {
    const games = [game("W"), game("W"), game("W")];
    const s = computeAchievements(ME, [...games].reverse(), null);
    expect(get(s, "streak-3").unlockedAt).toBe(games[2].endedAt.toISOString());
  });

  it("beat the bots: one per level, only for wins", () => {
    const s = computeAchievements(
      ME,
      [game("W", { vs: "bot:randy" }), game("L", { vs: "bot:stockfish" }), game("W", { vs: "bot:clara", asBlack: true })],
      null,
    );
    expect(get(s, "beat-randy").unlockedAt).not.toBeNull();
    expect(get(s, "beat-clara").unlockedAt).not.toBeNull();
    expect(get(s, "beat-stockfish").unlockedAt).toBeNull();
    expect(s.unlocked).toBe(3); // first win + two bots
  });

  it("ignores games without a result", () => {
    const s = computeAchievements(ME, [{ ...game("W"), result: null }], null);
    expect(s.unlocked).toBe(0);
  });
});
