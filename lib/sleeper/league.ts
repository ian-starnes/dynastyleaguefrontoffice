import { sleeperFetch } from "./client";
import { getSleeperLeagueId } from "./config";
import type { SleeperLeague } from "./types";

export async function getLeague(): Promise<SleeperLeague> {
  const leagueId = getSleeperLeagueId();

  return sleeperFetch<SleeperLeague>(`/league/${leagueId}`, {
    next: { revalidate: 300 },
  });
}
