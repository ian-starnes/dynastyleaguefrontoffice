import { sleeperFetch } from "./client";
import { getSleeperLeagueId } from "./config";
import type { SleeperTransaction } from "./types";

/** Unlike getTransactions(), takes an arbitrary league_id — needed for historical seasons. */
export async function getTransactionsForLeague(
  leagueId: string,
  week: number
): Promise<SleeperTransaction[]> {
  return sleeperFetch<SleeperTransaction[]>(
    `/league/${leagueId}/transactions/${week}`,
    { next: { revalidate: 300 } }
  );
}

export async function getTransactions(week: number): Promise<SleeperTransaction[]> {
  return getTransactionsForLeague(getSleeperLeagueId(), week);
}

// Sleeper has no "all transactions" endpoint — only per-week. Weeks 0–18
// covers preseason/offseason moves (week 0) through a full regular season;
// fetched in parallel and flattened rather than trying to determine the
// current week dynamically.
const MAX_WEEK = 18;

export async function getAllTransactionsForLeague(
  leagueId: string
): Promise<SleeperTransaction[]> {
  const weeks = await Promise.all(
    Array.from({ length: MAX_WEEK + 1 }, (_, week) =>
      getTransactionsForLeague(leagueId, week)
    )
  );

  return weeks.flat();
}

export async function getAllTransactions(): Promise<SleeperTransaction[]> {
  return getAllTransactionsForLeague(getSleeperLeagueId());
}
