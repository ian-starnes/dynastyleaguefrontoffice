import { sql } from "@/lib/db/client";
import type { TradeRecord } from "@/lib/models";

type TradeRow = {
  league_id: string;
  sleeper_transaction_id: string;
  occurred_at: string;
  teams_involved: number[];
  players_involved: Record<string, number>;
  picks_involved: TradeRecord["picksInvolved"];
};

function rowToTrade(row: TradeRow): TradeRecord {
  return {
    leagueId: row.league_id,
    sleeperTransactionId: row.sleeper_transaction_id,
    occurredAt: new Date(row.occurred_at).getTime(),
    rosterIdsInvolved: row.teams_involved,
    playersInvolved: row.players_involved,
    picksInvolved: row.picks_involved,
  };
}

/** Idempotent on (league_id, sleeper_transaction_id). */
export class TradeRepository {
  async upsertTrade(trade: TradeRecord): Promise<void> {
    await sql`
      insert into trades (
        league_id, sleeper_transaction_id, occurred_at,
        teams_involved, players_involved, picks_involved
      )
      values (
        ${trade.leagueId}, ${trade.sleeperTransactionId}, ${new Date(trade.occurredAt).toISOString()},
        ${JSON.stringify(trade.rosterIdsInvolved)},
        ${JSON.stringify(trade.playersInvolved)},
        ${JSON.stringify(trade.picksInvolved)}
      )
      on conflict (league_id, sleeper_transaction_id) do update set
        occurred_at = excluded.occurred_at,
        teams_involved = excluded.teams_involved,
        players_involved = excluded.players_involved,
        picks_involved = excluded.picks_involved
    `;
  }

  async getTradesForLeague(leagueId: string): Promise<TradeRecord[]> {
    const rows = (await sql`
      select league_id, sleeper_transaction_id, occurred_at, teams_involved, players_involved, picks_involved
      from trades
      where league_id = ${leagueId}
      order by occurred_at desc
    `) as TradeRow[];
    return rows.map(rowToTrade);
  }
}
