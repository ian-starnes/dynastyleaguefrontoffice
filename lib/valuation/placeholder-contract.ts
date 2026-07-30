/**
 * Stand-ins for DLFO's future keeper contract system. Deterministic per
 * player (same input always produces the same output) so numbers look
 * stable across reloads — none of this reflects a real auction result.
 * It exists purely so Keeper Cost, Keeper Surplus, and Asset Value can be
 * demonstrated in real dollars before real contract history exists.
 *
 * Contract Philosophy (documented here, NOT implemented yet):
 *   - Keeper Cost is determined exclusively by league history — never
 *     derived from FantasyCalc or Market Value — and never changes except
 *     annual $5/year inflation, or voiding entirely if the player becomes
 *     undrafted.
 *   - Keeper Years Remaining starts at 5, decreases by 1 each offseason,
 *     and resets to 5 whenever the player is traded.
 *   - keeperCost = originalAuctionPrice + ($5 × years already kept)
 *
 * Once lib/auction-history.ts is populated with real results, this whole
 * module goes away — originalAuctionPrice, draftYear, and keeperCost will
 * come directly from a player's actual auction history instead.
 */

const MAX_KEEPER_YEARS = 5;
// TODO: pull the real season from lib/sleeper's getLeague() once this
// stops being a placeholder.
const CURRENT_SEASON = 2026;

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export type PlaceholderContract = {
  originalAuctionPrice: number;
  keeperCost: number;
  draftYear: number;
  keeperYearsRemaining: number;
};

/**
 * marketValue (in dollars) only anchors the placeholder
 * originalAuctionPrice so it looks plausible relative to it — a real
 * originalAuctionPrice will come from AuctionHistory and have zero
 * dependency on current market value.
 */
export function getPlaceholderContract(
  playerId: string,
  marketValue: number | null
): PlaceholderContract {
  const hash = hashString(`contract:${playerId}`);

  const keeperYearsRemaining = (hash % MAX_KEEPER_YEARS) + 1; // 1-5
  const yearsAlreadyKept = MAX_KEEPER_YEARS - keeperYearsRemaining;

  const priceFactor = 0.5 + ((hash >>> 3) % 1000) / 1000; // 0.5-1.499
  const base = marketValue ?? 5;
  const originalAuctionPrice = Math.max(1, Math.round(base * priceFactor));

  const keeperCost = originalAuctionPrice + 5 * yearsAlreadyKept;
  const draftYear = CURRENT_SEASON - yearsAlreadyKept;

  return { originalAuctionPrice, keeperCost, draftYear, keeperYearsRemaining };
}
