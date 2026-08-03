import { sleeperFetch } from "./client";
import { getSleeperLeagueId } from "./config";
import type { SleeperDraft, SleeperDraftPick, SleeperTradedPick } from "./types";

/** Unlike getDrafts(), takes an arbitrary league_id — needed for historical seasons. */
export async function getDraftsForLeague(
  leagueId: string
): Promise<SleeperDraft[]> {
  return sleeperFetch<SleeperDraft[]>(`/league/${leagueId}/drafts`, {
    next: { revalidate: 3600 },
  });
}

export async function getDrafts(): Promise<SleeperDraft[]> {
  return getDraftsForLeague(getSleeperLeagueId());
}

export async function getDraftPicks(draftId: string): Promise<SleeperDraftPick[]> {
  return sleeperFetch<SleeperDraftPick[]>(`/draft/${draftId}/picks`, {
    next: { revalidate: 3600 },
  });
}

/** Which draft picks (future rookie picks) have changed hands via trade. */
export async function getTradedPicksForLeague(
  leagueId: string
): Promise<SleeperTradedPick[]> {
  return sleeperFetch<SleeperTradedPick[]>(
    `/league/${leagueId}/traded_picks`,
    { next: { revalidate: 300 } }
  );
}
