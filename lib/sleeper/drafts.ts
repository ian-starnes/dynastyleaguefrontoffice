import { sleeperFetch } from "./client";
import { getSleeperLeagueId } from "./config";
import type { SleeperDraft, SleeperDraftPick } from "./types";

export async function getDrafts(): Promise<SleeperDraft[]> {
  const leagueId = getSleeperLeagueId();

  return sleeperFetch<SleeperDraft[]>(`/league/${leagueId}/drafts`, {
    next: { revalidate: 3600 },
  });
}

export async function getDraftPicks(draftId: string): Promise<SleeperDraftPick[]> {
  return sleeperFetch<SleeperDraftPick[]>(`/draft/${draftId}/picks`, {
    next: { revalidate: 3600 },
  });
}
