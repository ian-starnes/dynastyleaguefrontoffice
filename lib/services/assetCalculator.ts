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

export type MultiYearProjection = {
  /** Total surplus capturable over the projected years — assumes market value holds flat and a rational team stops keeping once keeper cost would exceed it. */
  cumulativeSurplus: number;
  /** How many of the requested years were actually worth keeping through; may be less than yearsToProject. */
  yearsCapturable: number;
};

/**
 * Projects cumulative Keeper Surplus over multiple future seasons — the
 * basis for Trade Center's "multi-year franchise impact" evaluation
 * (DLFO brief section 7). A trade does NOT change Market Value or
 * Keeper Cost the instant it happens — both are already fixed facts —
 * so a same-day Asset Value comparison between the current and
 * acquiring owner would always show zero difference. The real thing a
 * trade changes is the RESET of years remaining for the acquiring team
 * (see keeperClockService.ts's trade-breaks-continuity rule); this
 * projects what that reset is actually worth in capturable surplus.
 *
 * Explicit simplifying assumption, stated plainly rather than hidden:
 * marketValue is assumed to hold flat across the projection window —
 * there's no reliable way to forecast a real player's future dynasty
 * value, so holding it constant is the only honest baseline available.
 * keeperCost grows by the real $5/year league rule. Stops accumulating
 * once projected keeperCost would meet or exceed marketValue (a
 * rational GM releases the player rather than keep at a loss), which is
 * why yearsCapturable can come back lower than yearsToProject.
 */
export function projectMultiYearSurplus(
  marketValue: number,
  currentKeeperCost: number,
  yearsToProject: number
): MultiYearProjection {
  let cumulativeSurplus = 0;
  let yearsCapturable = 0;

  for (let yearOffset = 0; yearOffset < yearsToProject; yearOffset++) {
    const projectedKeeperCost =
      currentKeeperCost + KEEPER_INFLATION_PER_YEAR * yearOffset;
    const projectedSurplus = marketValue - projectedKeeperCost;
    if (projectedSurplus <= 0) break;
    cumulativeSurplus += projectedSurplus;
    yearsCapturable++;
  }

  return { cumulativeSurplus, yearsCapturable };
}
