import { MAX_KEEPER_YEARS } from "@/lib/services/assetCalculator";

/**
 * The last remaining placeholder contract fact — how many offseasons are
 * left on a keeper contract. Deterministic per player (same input always
 * produces the same output) so it looks stable across reloads.
 *
 * originalAuctionPrice and draftYear are no longer placeholders: they now
 * come from lib/services/auctionHistoryService.ts's real prior-season
 * auction data (see lib/league-players.ts). keeperYearsRemaining stays
 * here because it isn't derivable from a single prior season — knowing
 * how many consecutive years a player has already been kept needs the
 * full multi-season history lib/import/leagueImportService.ts builds,
 * which isn't wired to a real database yet.
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
function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function getPlaceholderKeeperYearsRemaining(playerId: string): number {
  const hash = hashString(`contract:${playerId}`);
  return (hash % MAX_KEEPER_YEARS) + 1; // 1-MAX_KEEPER_YEARS
}
