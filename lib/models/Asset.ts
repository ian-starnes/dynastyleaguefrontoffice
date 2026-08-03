import type { AssetEconomics } from "@/lib/services/assetCalculator";

/**
 * The stored, persisted facts about a player-as-asset in one league —
 * exactly what lives in the `assets` table. Deliberately does NOT include
 * keeperCost/marketValue/keeperSurplus/assetValue: those are all derived,
 * not stored, so they can never go stale relative to a cached column. See
 * AssetEconomics in lib/services/assetCalculator.ts, the one place that
 * computes them — keeperCost included, from originalAuctionPrice and
 * keeperYearsRemaining below.
 */
export type AssetRecord = {
  leagueId: string;
  playerId: string;
  currentOwnerId: string | null;
  originalAuctionPrice: number;
  keeperYearsRemaining: number;
  draftYear: number;
};

/**
 * The full view of an asset — stored facts plus the Asset Calculator's
 * derived economics. This is the shape that matches the "Asset" fields
 * listed in the DLFO architecture brief; it's assembled at read time, not
 * persisted as a single row.
 */
export type Asset = AssetRecord & AssetEconomics;
