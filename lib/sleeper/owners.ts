import { sleeperFetch } from "./client";
import { getSleeperLeagueId } from "./config";
import type { SleeperUser } from "./types";

export async function getOwners(): Promise<SleeperUser[]> {
  const leagueId = getSleeperLeagueId();

  return sleeperFetch<SleeperUser[]>(`/league/${leagueId}/users`, {
    next: { revalidate: 300 },
  });
}
