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
 * from, so flattening would silently lose that association.
 *
 * A genuinely future week of an already-fully-PAST season returns an
 * empty array — no special-casing needed there. But confirmed live once
 * a season actually started: a future week of the CURRENT, still-in-
 * progress season is NOT empty — Sleeper pre-generates the whole
 * season's real roster pairings upfront, just with every score at a
 * 0.0 placeholder until that week is actually played. Callers that walk
 * multiple seasons (e.g. weeklyPerformanceService.ts) have to filter
 * those out themselves using the real current NFL week, or every
 * not-yet-played week of the live season gets treated as a real,
 * decided 0-0 tie.
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
