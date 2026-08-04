import { convertFantasyCalcToMarketValue } from "./marketValueService";

const KEEPER_INFLATION_PER_YEAR = 5;

/**
 * How many offseasons a keeper contract runs before the player returns to
 * the draft pool. Shared with lib/services/keeperClockService.ts so
 * there's one canonical definition of the contract length, not two
 * constants that could drift apart.
 */
export const MAX_KEEPER_YEARS = 5;

export type AssetCalculatorInput = {
  /** Raw FantasyCalc points, live from lib/services/fantasycalc.ts. Null if unmatched. */
  fantasyCalc: number | null;
  /** Stored fact — what the asset actually sold for, as of yearsSincePriceSet seasons ago. */
  originalAuctionPrice: number;
  /**
   * How many offseasons have passed since originalAuctionPrice was set —
   * NOT how long the player has been kept in total. originalAuctionPrice
   * already reflects whatever historical keeper inflation applied up
   * through the season it was captured in, so only the offseasons since
   * THEN need a new $5 step. Distinct from keeperYearsRemaining (the
   * contract's total tenure toward the MAX_KEEPER_YEARS cap, tracked by
   * lib/services/keeperClockService.ts) — conflating the two would
   * double-count inflation for anyone kept more than one year.
   */
  yearsSincePriceSet: number;
};

export type AssetEconomics = {
  marketValue: number | null;
  keeperCost: number;
  keeperSurplus: number | null;
  assetValue: number | null;
};

/**
 * The ONLY place Market Value, Keeper Cost, Keeper Surplus, and Asset
 * Value get computed. Every caller — the live Sleeper/FantasyCalc path in
 * lib/league-players.ts today, and the database-backed path once
 * lib/repositories/AssetRepository.ts is wired to real Postgres facts —
 * goes through this function so the formulas can never drift out of sync
 * between two places that both happen to do the same arithmetic.
 *
 * Deliberately takes originalAuctionPrice + keeperYearsRemaining (the
 * stored FACTS) rather than a pre-computed keeperCost — keeperCost itself
 * is derived, not stored, precisely so nothing else in the codebase can
 * end up holding a stale copy of it.
 *
 * Pure and synchronous on purpose: no I/O, no async, so it's trivial to
 * unit test and impossible to accidentally introduce a stale cached read
 * inside it.
 */
export function calculateAssetEconomics({
  fantasyCalc,
  originalAuctionPrice,
  yearsSincePriceSet,
}: AssetCalculatorInput): AssetEconomics {
  const marketValue =
    fantasyCalc !== null ? convertFantasyCalcToMarketValue(fantasyCalc) : null;

  // Keeper Cost is determined exclusively by league history —
  // originalAuctionPrice plus $5 for every offseason since that price was
  // set. Never derived from fantasyCalc/marketValue.
  const keeperCost =
    originalAuctionPrice + KEEPER_INFLATION_PER_YEAR * yearsSincePriceSet;

  // TODO(auction-value): once real Market AUCTION Value exists (as opposed
  // to this estimated market value), swap it in here — marketValue is a
  // stand-in until then.
  const keeperSurplus = marketValue !== null ? marketValue - keeperCost : null;
  const assetValue =
    marketValue !== null ? marketValue + (keeperSurplus as number) : null;

  return { marketValue, keeperCost, keeperSurplus, assetValue };
}
