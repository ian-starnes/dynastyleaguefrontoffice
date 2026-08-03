/**
 * One drafted-or-kept player, in one season. The real (not placeholder)
 * source of originalAuctionPrice/draftYear/keeperCost once populated —
 * see lib/import/leagueImportService.ts, which builds these from Sleeper
 * draft picks (metadata.amount = winningBid, is_keeper flag).
 */
export type AuctionRecord = {
  leagueId: string;
  season: number;
  playerId: string;
  ownerId: string | null;
  winningBid: number;
  isKeeper: boolean;
  /**
   * Which year of a keeper cycle this was (1st year kept, 2nd, ...); null
   * for a fresh auction. NOT populated by the importer yet — Sleeper
   * doesn't expose this directly, and deriving it means tracking
   * consecutive is_keeper years per player across the whole season chain.
   * See the Limitations note in the architecture plan.
   */
  keeperYear: number | null;
};
