import { MAX_KEEPER_YEARS } from "@/lib/services/assetCalculator";

/**
 * Stand-ins for DLFO's future keeper contract FACTS. Deterministic per
 * player (same input always produces the same output) so numbers look
 * stable across reloads — none of this reflects a real auction result.
 * Used only until lib/repositories/AssetRepository.ts has real rows to
 * read instead (backed by lib/repositories/AuctionRecordRepository.ts's
 * historical import data).
 *
 * Deliberately produces FACTS only (originalAuctionPrice, draftYear,
 * keeperYearsRemaining) — not keeperCost. Keeper Cost is a derived
 * economics figure now computed exclusively by
 * lib/services/assetCalculator.ts, from these facts, so there's exactly
 * one place in the codebase that does that arithmetic.
 *
 * Contract Philosophy (documented here, NOT implemented yet):
 *   - Keeper Cost is determined exclusively by league history — never
 *     derived from FantasyCalc or Market Value — and never changes except
 *     annual $5/year inflation, or voiding entirely if the player becomes
 *     undrafted.
 *   - Keeper Years Remaining starts at MAX_KEEPER_YEARS, decreases by 1
 *     each offseason, and resets to MAX_KEEPER_YEARS whenever the player
 *     is traded.
 */

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

export type PlaceholderContractFacts = {
  originalAuctionPrice: number;
  draftYear: number;
  keeperYearsRemaining: number;
};

/**
 * marketValue (in dollars) only anchors the placeholder
 * originalAuctionPrice so it looks plausible relative to it — a real
 * originalAuctionPrice will come from AuctionRecord history and have zero
 * dependency on current market value.
 */
export function getPlaceholderContractFacts(
  playerId: string,
  marketValue: number | null
): PlaceholderContractFacts {
  const hash = hashString(`contract:${playerId}`);

  const keeperYearsRemaining = (hash % MAX_KEEPER_YEARS) + 1; // 1-MAX_KEEPER_YEARS
  const yearsAlreadyKept = MAX_KEEPER_YEARS - keeperYearsRemaining;

  const priceFactor = 0.5 + ((hash >>> 3) % 1000) / 1000; // 0.5-1.499
  const base = marketValue ?? 5;
  const originalAuctionPrice = Math.max(1, Math.round(base * priceFactor));

  const draftYear = CURRENT_SEASON - yearsAlreadyKept;

  return { originalAuctionPrice, draftYear, keeperYearsRemaining };
}
