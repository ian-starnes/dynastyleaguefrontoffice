import { sql } from "@/lib/db/client";
import type { TransactionRecord, TransactionType } from "@/lib/models";

type TransactionRow = {
  league_id: string;
  sleeper_transaction_id: string;
  type: string;
  created_at: string;
  raw_payload: unknown;
};

function rowToTransaction(row: TransactionRow): TransactionRecord {
  return {
    leagueId: row.league_id,
    sleeperTransactionId: row.sleeper_transaction_id,
    type: row.type as TransactionType,
    createdAt: new Date(row.created_at).getTime(),
    rawPayload: row.raw_payload,
  };
}

/**
 * The immutable ledger's raw event log. Idempotent on
 * (league_id, sleeper_transaction_id) — re-running the importer over
 * unchanged Sleeper data is always a safe no-op here.
 */
export class TransactionRepository {
  async upsertTransaction(transaction: TransactionRecord): Promise<void> {
    await sql`
      insert into transactions (league_id, sleeper_transaction_id, type, created_at, raw_payload)
      values (
        ${transaction.leagueId},
        ${transaction.sleeperTransactionId},
        ${transaction.type},
        ${new Date(transaction.createdAt).toISOString()},
        ${JSON.stringify(transaction.rawPayload)}
      )
      on conflict (league_id, sleeper_transaction_id) do update set
        type = excluded.type,
        created_at = excluded.created_at,
        raw_payload = excluded.raw_payload
    `;
  }

  async getTransactionsForLeague(
    leagueId: string
  ): Promise<TransactionRecord[]> {
    const rows = (await sql`
      select league_id, sleeper_transaction_id, type, created_at, raw_payload
      from transactions
      where league_id = ${leagueId}
      order by created_at desc
    `) as TransactionRow[];
    return rows.map(rowToTransaction);
  }

  /** rawPayload is searched client-side here — adds/drops live inside it, not as their own columns. */
  async getTransactionsForPlayer(
    leagueId: string,
    playerId: string
  ): Promise<TransactionRecord[]> {
    const all = await this.getTransactionsForLeague(leagueId);
    return all.filter((transaction) => {
      const payload = transaction.rawPayload as {
        adds?: Record<string, number> | null;
        drops?: Record<string, number> | null;
      };
      return (
        (payload.adds && playerId in payload.adds) ||
        (payload.drops && playerId in payload.drops)
      );
    });
  }
}
