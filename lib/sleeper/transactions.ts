import { sleeperFetch } from "./client";
import { getSleeperLeagueId } from "./config";
import type { SleeperTransaction } from "./types";

export async function getTransactions(week: number): Promise<SleeperTransaction[]> {
  const leagueId = getSleeperLeagueId();

  return sleeperFetch<SleeperTransaction[]>(
    `/league/${leagueId}/transactions/${week}`,
    { next: { revalidate: 300 } }
  );
}

// Sleeper has no "all transactions" endpoint — only per-week. Weeks 0–18
// covers preseason/offseason moves (week 0) through a full regular season;
// fetched in parallel and flattened rather than trying to determine the
// current week dynamically.
const MAX_WEEK = 18;

export async function getAllTransactions(): Promise<SleeperTransaction[]> {
  const weeks = await Promise.all(
    Array.from({ length: MAX_WEEK + 1 }, (_, week) => getTransactions(week))
  );

  return weeks.flat();
}
