import { sql } from "@/lib/db/client";
import type { AssetRecord } from "@/lib/models";

type AssetRow = {
  league_id: string;
  player_id: string;
  current_owner_id: string | null;
  original_auction_price: number;
  keeper_years_remaining: number;
  draft_year: number;
};

function rowToAssetRecord(row: AssetRow): AssetRecord {
  return {
    leagueId: row.league_id,
    playerId: row.player_id,
    currentOwnerId: row.current_owner_id,
    originalAuctionPrice: row.original_auction_price,
    keeperYearsRemaining: row.keeper_years_remaining,
    draftYear: row.draft_year,
  };
}

/**
 * Stores only the FACTS about an asset's contract — never keeperCost,
 * marketValue, keeperSurplus, or assetValue. Those are always derived at
 * read time by lib/services/assetCalculator.ts from these facts plus live
 * FantasyCalc data, so a stale cached column here could never cause them
 * to drift.
 */
export class AssetRepository {
  async upsertAsset(asset: AssetRecord): Promise<void> {
    await sql`
      insert into assets (
        league_id, player_id, current_owner_id,
        original_auction_price, keeper_years_remaining, draft_year
      )
      values (
        ${asset.leagueId}, ${asset.playerId}, ${asset.currentOwnerId},
        ${asset.originalAuctionPrice}, ${asset.keeperYearsRemaining}, ${asset.draftYear}
      )
      on conflict (league_id, player_id) do update set
        current_owner_id = excluded.current_owner_id,
        original_auction_price = excluded.original_auction_price,
        keeper_years_remaining = excluded.keeper_years_remaining,
        draft_year = excluded.draft_year,
        updated_at = now()
    `;
  }

  async getAsset(
    leagueId: string,
    playerId: string
  ): Promise<AssetRecord | null> {
    const rows = (await sql`
      select league_id, player_id, current_owner_id,
             original_auction_price, keeper_years_remaining, draft_year
      from assets
      where league_id = ${leagueId} and player_id = ${playerId}
    `) as AssetRow[];
    return rows[0] ? rowToAssetRecord(rows[0]) : null;
  }

  async getAssetsForLeague(leagueId: string): Promise<AssetRecord[]> {
    const rows = (await sql`
      select league_id, player_id, current_owner_id,
             original_auction_price, keeper_years_remaining, draft_year
      from assets
      where league_id = ${leagueId}
    `) as AssetRow[];
    return rows.map(rowToAssetRecord);
  }
}
