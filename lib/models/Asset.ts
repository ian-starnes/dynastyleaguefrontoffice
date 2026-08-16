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
 * NOT yet populated by the live compute path (lib/league-players.ts) —
 * that still only carries draftYear, and only ever one season back. Per
 * the league's real contract rules, a drafted player's salary lineage
 * traces back to whichever season they were ORIGINALLY auctioned (2023
 * at the earliest, confirmed via the season-chain draft-type audit — not
 * always "last season"). contractStartSeason/originalDraftOwner exist
 * here so Phase 5 (auction/keeper/contract ledger) has somewhere correct
 * to write that lineage once it's actually traced through auction_records
 * across multiple seasons, instead of assumed from a single season.
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
