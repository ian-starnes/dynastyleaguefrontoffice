import {
  getLeague,
  getDraftsForLeague,
  getDraftPicks,
} from "@/lib/sleeper";

export type PriorSeasonAuctionData = {
  /** The real season these prices came from — NOT necessarily "last season"; see doc comment below. */
  season: number;
  /** Real winning bid, in dollars, keyed by Sleeper player_id. */
  pricesByPlayerId: Map<string, number>;
};

async function getCompletedAuctionPrices(
  leagueId: string
): Promise<Map<string, number> | null> {
  const drafts = await getDraftsForLeague(leagueId);
  const auctionDrafts = drafts.filter(
    (draft) => draft.type === "auction" && draft.status === "complete"
  );
  if (auctionDrafts.length === 0) return null;

  const pricesByPlayerId = new Map<string, number>();
  for (const draft of auctionDrafts) {
    const picks = await getDraftPicks(draft.draft_id);
    for (const pick of picks) {
      if (!pick.metadata?.amount) continue;
      pricesByPlayerId.set(pick.player_id, Number(pick.metadata.amount));
    }
  }
  return pricesByPlayerId;
}

/**
 * Real winning bids from the most recent completed auction draft — the
 * actual source of truth for a player's originalAuctionPrice, replacing
 * the old hash-based placeholder for anyone who was part of it. A player
 * currently rostered but absent from this map (picked up via waiver/free
 * agency since) is a $5 contract by convention — that fallback lives in
 * lib/league-players.ts, not here, since "not in this map" is all this
 * function needs to report.
 *
 * PREFERS THE CURRENT SEASON'S OWN AUCTION, falling back to the prior
 * season's only if the current one hasn't happened yet. This function
 * used to always look at previous_league_id — a real bug confirmed once
 * this league's actual 2026 auction completed: with the current season's
 * own real prices sitting right there, still reading last season's stale
 * ones would have doubled up keeper-cost inflation for every kept player
 * (the $5/year bump lib/league-players.ts applies on top of this data is
 * only correct when this really is a prior, not-yet-superseded season).
 * Once a season's own auction completes, its real prices need zero
 * additional inflation — they already reflect however many years of
 * keeper increments got applied when they were bid.
 *
 * Deliberately scoped to the two most recent seasons, not the full
 * historical chain — lib/import/leagueImportService.ts remains the path
 * to real multi-season history once a database exists; this is the
 * live-fetch equivalent for right now, with no persistence involved.
 * If/when lib/repositories/AuctionRecordRepository.ts is wired to a real
 * Postgres database, this function could be swapped to read from there
 * instead, keeping the same return shape.
 */
export async function getPriorSeasonAuctionData(): Promise<PriorSeasonAuctionData | null> {
  const currentLeague = await getLeague();
  const currentSeason = Number(currentLeague.season);

  const currentSeasonPrices = await getCompletedAuctionPrices(currentLeague.league_id);
  if (currentSeasonPrices) {
    return { season: currentSeason, pricesByPlayerId: currentSeasonPrices };
  }

  const priorLeagueId = currentLeague.previous_league_id;
  if (!priorLeagueId) return null;

  const priorSeasonPrices = await getCompletedAuctionPrices(priorLeagueId);
  if (!priorSeasonPrices) return null;

  return { season: currentSeason - 1, pricesByPlayerId: priorSeasonPrices };
}
