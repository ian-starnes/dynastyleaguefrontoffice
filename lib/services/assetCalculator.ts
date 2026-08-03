import { convertFantasyCalcToMarketValue } from "./marketValueService";

const KEEPER_INFLATION_PER_YEAR = 5;

/**
 * How many offseasons a keeper contract runs before the player returns to
 * the draft pool. Shared with lib/valuation/placeholder-contract.ts so
 * there's one canonical definition of the contract length, not two
 * constants that could drift apart.
 */
export const MAX_KEEPER_YEARS = 5;

export type AssetCalculatorInput = {
  /** Raw FantasyCalc points, live from lib/services/fantasycalc.ts. Null if unmatched. */
  fantasyCalc: number | null;
  /** Stored fact — what the asset actually sold for, originally. */
  originalAuctionPrice: number;
  /** Stored fact — offseasons remaining before this contract expires (1-MAX_KEEPER_YEARS). */
  keeperYearsRemaining: number;
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
  keeperYearsRemaining,
}: AssetCalculatorInput): AssetEconomics {
  const marketValue =
    fantasyCalc !== null ? convertFantasyCalcToMarketValue(fantasyCalc) : null;

  // Keeper Cost is determined exclusively by league history —
  // originalAuctionPrice plus $5/year inflation for every offseason
  // already kept. Never derived from fantasyCalc/marketValue.
  const yearsAlreadyKept = MAX_KEEPER_YEARS - keeperYearsRemaining;
  const keeperCost =
    originalAuctionPrice + KEEPER_INFLATION_PER_YEAR * yearsAlreadyKept;

  // TODO(auction-value): once real Market AUCTION Value exists (as opposed
  // to this estimated market value), swap it in here — marketValue is a
  // stand-in until then.
  const keeperSurplus = marketValue !== null ? marketValue - keeperCost : null;
  const assetValue =
    marketValue !== null ? marketValue + (keeperSurplus as number) : null;

  return { marketValue, keeperCost, keeperSurplus, assetValue };
}
