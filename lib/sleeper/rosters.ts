import { sleeperFetch } from "./client";
import { getSleeperLeagueId } from "./config";
import type { SleeperRoster } from "./types";

export async function getRosters(): Promise<SleeperRoster[]> {
  const leagueId = getSleeperLeagueId();

  return sleeperFetch<SleeperRoster[]>(`/league/${leagueId}/rosters`, {
    next: { revalidate: 300 },
  });
}
