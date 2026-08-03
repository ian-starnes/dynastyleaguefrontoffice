import { sleeperFetch } from "./client";
import { getSleeperLeagueId } from "./config";
import type { SleeperUser } from "./types";

/** Unlike getOwners(), takes an arbitrary league_id — needed for historical seasons. */
export async function getOwnersForLeague(
  leagueId: string
): Promise<SleeperUser[]> {
  return sleeperFetch<SleeperUser[]>(`/league/${leagueId}/users`, {
    next: { revalidate: 300 },
  });
}

export async function getOwners(): Promise<SleeperUser[]> {
  return getOwnersForLeague(getSleeperLeagueId());
}
