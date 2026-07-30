/**
 * Every real auction result from league history, once it exists. NOT
 * populated yet — this is architecture, prepared ahead of the data.
 *
 * Once populated, this becomes the source of truth for a player's
 * originalAuctionPrice/draftYear/keeperCost — replacing
 * lib/valuation/placeholder-contract.ts entirely — and one of several
 * inputs into lib/services/marketValueService.ts's eventual trained
 * valuation model.
 */
export type AuctionHistory = {
  playerId: string;
  season: number;
  auctionPrice: number;
  draftedBy: string;
  isKeeper: boolean;
  /** Which year of a keeper cycle this was (1st year kept, 2nd, ...); null for a fresh auction. */
  keeperYear: number | null;
};
