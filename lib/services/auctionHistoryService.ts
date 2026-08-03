import {
  getLeague,
  getDraftsForLeague,
  getDraftPicks,
} from "@/lib/sleeper";

export type PriorSeasonAuctionData = {
  season: number;
  /** Real winning bid, in dollars, keyed by Sleeper player_id. */
  pricesByPlayerId: Map<string, number>;
};

/**
 * Real winning bids from the prior season's completed auction draft — the
 * actual source of truth for a player's originalAuctionPrice, replacing
 * the old hash-based placeholder for anyone who was part of it. A player
 * currently rostered but absent from this map (picked up via waiver/free
 * agency since) is a $5 contract by convention — that fallback lives in
 * lib/league-players.ts, not here, since "not in this map" is all this
 * function needs to report.
 *
 * Deliberately scoped to exactly one season back, not the full historical
 * chain — lib/import/leagueImportService.ts remains the path to real
 * multi-season history once a database exists; this is the live-fetch
 * equivalent for right now, with no persistence involved. If/when
 * lib/repositories/AuctionRecordRepository.ts is wired to a real Postgres
 * database, this function could be swapped to read from there instead,
 * keeping the same return shape.
 */
export async function getPriorSeasonAuctionData(): Promise<PriorSeasonAuctionData | null> {
  const currentLeague = await getLeague();
  const priorLeagueId = currentLeague.previous_league_id;
  if (!priorLeagueId) return null;

  const drafts = await getDraftsForLeague(priorLeagueId);
  const auctionDrafts = drafts.filter(
    (draft) => draft.type === "auction" && draft.status === "complete"
  );
  if (auctionDrafts.length === 0) return null;

  const pricesByPlayerId = new Map<string, number>();
  let season = Number(auctionDrafts[0].season);

  for (const draft of auctionDrafts) {
    season = Number(draft.season);
    const picks = await getDraftPicks(draft.draft_id);
    for (const pick of picks) {
      if (!pick.metadata?.amount) continue;
      pricesByPlayerId.set(pick.player_id, Number(pick.metadata.amount));
    }
  }

  return { season, pricesByPlayerId };
}
