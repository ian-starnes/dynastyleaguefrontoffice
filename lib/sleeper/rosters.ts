import { sleeperFetch } from "./client";
import { getSleeperLeagueId } from "./config";
import type { SleeperRoster } from "./types";

/** Unlike getRosters(), takes an arbitrary league_id — needed for historical seasons. */
export async function getRostersForLeague(
  leagueId: string
): Promise<SleeperRoster[]> {
  return sleeperFetch<SleeperRoster[]>(`/league/${leagueId}/rosters`, {
    next: { revalidate: 300 },
  });
}

export async function getRosters(): Promise<SleeperRoster[]> {
  return getRostersForLeague(getSleeperLeagueId());
}
