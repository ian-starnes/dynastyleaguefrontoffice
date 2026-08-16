import type { AssetEconomics } from "@/lib/services/assetCalculator";

/** How the current owner came to hold this asset. */
export type AcquisitionType =
  | "auction"
  | "keeper"
  | "trade"
  | "waiver"
  | "free_agent"
  | "undrafted";

/**
 * The stored, persisted facts about a player-as-asset in one league —
 * exactly what lives in the `assets` table. Deliberately does NOT include
 * keeperCost/marketValue/keeperSurplus/assetValue: those are all derived,
 * not stored, so they can never go stale relative to a cached column. See
 * AssetEconomics in lib/services/assetCalculator.ts, the one place that
 * computes them — keeperCost included, from originalAuctionPrice and
 * keeperYearsRemaining below.
 *
 * Populated by the live compute path today via
 * lib/league-players.ts's toAssetRecord() — lib/services/contractLineageService.ts
 * traces contractStartSeason/originalDraftOwner/acquisitionType/acquisitionDate
 * through the real auction-era chain (2023+) and transaction log, not
 * assumed from a single season. No database exists yet to actually write
 * this to, but the shape is real and ready — AssetRepository.upsertAsset
 * just needs a caller once Postgres is provisioned.
 */
export type AssetRecord = {
  leagueId: string;
  playerId: string;
  currentOwnerId: string | null;
  originalAuctionPrice: number;
  keeperYearsRemaining: number;
  draftYear: number;
  /** The season this player's contract lineage actually began — not necessarily draftYear. */
  contractStartSeason: number;
  acquisitionType: AcquisitionType;
  /** Epoch ms of the acquisition event (trade/waiver/free-agent); null for an auction/keeper, which has only a season. */
  acquisitionDate: number | null;
  /** Who originally drafted this player, even if they've since been traded/dropped/reclaimed. Null if undrafted. */
  originalDraftOwner: string | null;
};

/**
 * The full view of an asset — stored facts plus the Asset Calculator's
 * derived economics. This is the shape that matches the "Asset" fields
 * listed in the DLFO architecture brief; it's assembled at read time, not
 * persisted as a single row.
 */
export type Asset = AssetRecord & AssetEconomics;
