import { readJson, withPlayer } from "@/lib/api";
import { HttpError } from "@/lib/game/rules";
import { computePuzzleStats, utcDay } from "@/lib/puzzles/logic";
import { PUZZLE_ACTIONS, getDayStats, getPuzzleRecords, recordPuzzleEvent, type PuzzleAction } from "@/lib/puzzles/service";

/** Records a mistake, hint, solve or "show solution" on a day's puzzle. */
export async function POST(req: Request, ctx: RouteContext<"/api/puzzles/[day]">) {
  const { day } = await ctx.params;
  return withPlayer(async (me) => {
    const body = await readJson(req);
    const action = String(body.action ?? "") as PuzzleAction;
    if (!PUZZLE_ACTIONS.includes(action)) throw new HttpError(400, "Unknown action.");
    const record = await recordPuzzleEvent(me.id, day, action);
    if (record.status === "attempted") return { record };
    const [records, dayStats] = await Promise.all([getPuzzleRecords(me.id), getDayStats(day)]);
    return { record, stats: computePuzzleStats(records, utcDay()), dayStats };
  });
}
