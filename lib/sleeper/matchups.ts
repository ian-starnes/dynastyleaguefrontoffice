import { sleeperFetch } from "./client";
import { getSleeperLeagueId } from "./config";
import type { SleeperMatchup } from "./types";

export async function getMatchupsForLeagueWeek(
  leagueId: string,
  week: number
): Promise<SleeperMatchup[]> {
  return sleeperFetch<SleeperMatchup[]>(
    `/league/${leagueId}/matchups/${week}`,
    { next: { revalidate: 300 } }
  );
}

export async function getMatchupsForWeek(week: number): Promise<SleeperMatchup[]> {
  return getMatchupsForLeagueWeek(getSleeperLeagueId(), week);
}

// Sleeper has no "all matchups" endpoint — only per-week, same shape as
// transactions. Regular season + playoffs tops out at 17 weeks in
// practice; 18 matches getAllTransactionsForLeague's own upper bound.
const MAX_WEEK = 18;

/**
 * Every week's matchups for one league-season, fetched in parallel.
 * Deliberately kept grouped by week (not flattened) — a SleeperMatchup
 * row has no week field of its own, only whichever endpoint URL it came
 * from, so flattening would silently lose that association. A week with
 * no games yet (future/bye) returns an empty array from Sleeper rather
 * than an error, so no special-casing needed.
 */
export async function getAllMatchupsForLeague(
  leagueId: string
): Promise<{ week: number; matchups: SleeperMatchup[] }[]> {
  return Promise.all(
    Array.from({ length: MAX_WEEK }, async (_, index) => {
      const week = index + 1;
      const matchups = await getMatchupsForLeagueWeek(leagueId, week);
      return { week, matchups };
    })
  );
}
