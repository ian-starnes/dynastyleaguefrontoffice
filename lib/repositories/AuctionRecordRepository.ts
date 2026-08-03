import { sql } from "@/lib/db/client";
import type { AuctionRecord } from "@/lib/models";

type AuctionRecordRow = {
  league_id: string;
  season: number;
  player_id: string;
  owner_id: string | null;
  winning_bid: number;
  is_keeper: boolean;
  keeper_year: number | null;
};

function rowToAuctionRecord(row: AuctionRecordRow): AuctionRecord {
  return {
    leagueId: row.league_id,
    season: row.season,
    playerId: row.player_id,
    ownerId: row.owner_id,
    winningBid: row.winning_bid,
    isKeeper: row.is_keeper,
    keeperYear: row.keeper_year,
  };
}

/**
 * The real (not placeholder) source of auction/keeper history, once
 * populated by lib/import/leagueImportService.ts. Idempotent on
 * (league_id, season, player_id).
 */
export class AuctionRecordRepository {
  async upsertAuctionRecord(record: AuctionRecord): Promise<void> {
    await sql`
      insert into auction_records (league_id, season, player_id, owner_id, winning_bid, is_keeper, keeper_year)
      values (
        ${record.leagueId}, ${record.season}, ${record.playerId}, ${record.ownerId},
        ${record.winningBid}, ${record.isKeeper}, ${record.keeperYear}
      )
      on conflict (league_id, season, player_id) do update set
        owner_id = excluded.owner_id,
        winning_bid = excluded.winning_bid,
        is_keeper = excluded.is_keeper,
        keeper_year = excluded.keeper_year
    `;
  }

  async getAuctionHistoryForPlayer(
    leagueId: string,
    playerId: string
  ): Promise<AuctionRecord[]> {
    const rows = (await sql`
      select league_id, season, player_id, owner_id, winning_bid, is_keeper, keeper_year
      from auction_records
      where league_id = ${leagueId} and player_id = ${playerId}
      order by season asc
    `) as AuctionRecordRow[];
    return rows.map(rowToAuctionRecord);
  }

  async getAuctionRecordsForLeague(leagueId: string): Promise<AuctionRecord[]> {
    const rows = (await sql`
      select league_id, season, player_id, owner_id, winning_bid, is_keeper, keeper_year
      from auction_records
      where league_id = ${leagueId}
      order by season asc
    `) as AuctionRecordRow[];
    return rows.map(rowToAuctionRecord);
  }
}
