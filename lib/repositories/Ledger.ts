import { TransactionRepository } from "./TransactionRepository";
import { AuctionRecordRepository } from "./AuctionRecordRepository";
import { TradeRepository } from "./TradeRepository";
import type { TransactionRecord, AuctionRecord, TradeRecord } from "@/lib/models";

export type LedgerEntry =
  | { kind: "transaction"; occurredAt: number; transaction: TransactionRecord }
  | { kind: "auction"; occurredAt: number; record: AuctionRecord }
  | { kind: "trade"; occurredAt: number; trade: TradeRecord };

const transactionRepository = new TransactionRepository();
const auctionRecordRepository = new AuctionRecordRepository();
const tradeRepository = new TradeRepository();

/**
 * "2024 Auction — Bijan Robinson — Owner: Ian — Winning Bid: $43" and
 * similar events, in one chronological list. Not a physical table —
 * storing the same fact twice (once in its own table, once in a
 * redundant ledger table) is exactly the kind of duplication that goes
 * stale. This merges transactions + auction_records + trades at read
 * time instead.
 *
 * Trades are excluded from the raw `transactions` entries here (even
 * though every trade also gets a type='trade' row there, for the
 * immutable raw-payload record) — they're represented once, via the
 * richer TradeRecord from the `trades` table, not twice.
 */
export async function getLedger(leagueId: string): Promise<LedgerEntry[]> {
  const [transactions, auctionRecords, trades] = await Promise.all([
    transactionRepository.getTransactionsForLeague(leagueId),
    auctionRecordRepository.getAuctionRecordsForLeague(leagueId),
    tradeRepository.getTradesForLeague(leagueId),
  ]);

  const entries: LedgerEntry[] = [
    ...transactions
      .filter((transaction) => transaction.type !== "trade")
      .map(
        (transaction): LedgerEntry => ({
          kind: "transaction",
          occurredAt: transaction.createdAt,
          transaction,
        })
      ),
    ...auctionRecords.map(
      (record): LedgerEntry => ({
        kind: "auction",
        // AuctionRecord has no exact timestamp, only a season — September
        // 1st of that season is an approximate ordering anchor, not a real
        // draft date.
        occurredAt: new Date(`${record.season}-09-01`).getTime(),
        record,
      })
    ),
    ...trades.map(
      (trade): LedgerEntry => ({
        kind: "trade",
        occurredAt: trade.occurredAt,
        trade,
      })
    ),
  ];

  return entries.sort((a, b) => b.occurredAt - a.occurredAt);
}
