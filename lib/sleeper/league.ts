import { sleeperFetch } from "./client";
import { getSleeperLeagueId } from "./config";
import type { SleeperLeague } from "./types";

export async function getLeague(): Promise<SleeperLeague> {
  const leagueId = getSleeperLeagueId();
  return getLeagueById(leagueId);
}

/** Unlike getLeague(), takes an arbitrary league_id — needed to walk historical seasons. */
export async function getLeagueById(leagueId: string): Promise<SleeperLeague> {
  return sleeperFetch<SleeperLeague>(`/league/${leagueId}`, {
    next: { revalidate: 300 },
  });
}

/**
 * Walks Sleeper's live previous_league_id chain from rootLeagueId back to
 * Day 1 (previous_league_id: null). Returned oldest season first. This is
 * the live-API side of chain-walking — for reading back an already-
 * imported chain from our own database, see
 * lib/repositories/LeagueRepository.ts's getSeasonChain instead.
 */
export async function getLeagueSeasonChain(
  rootLeagueId: string
): Promise<SleeperLeague[]> {
  const chain: SleeperLeague[] = [];
  let currentId: string | null = rootLeagueId;

  while (currentId) {
    const league = await getLeagueById(currentId);
    chain.unshift(league);
    currentId = league.previous_league_id;
  }

  return chain;
}
