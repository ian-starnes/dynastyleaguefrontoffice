import { TransactionRepository } from "./TransactionRepository";
import { AuctionRecordRepository } from "./AuctionRecordRepository";
import { TradeRepository } from "./TradeRepository";
import { KeeperDeclarationRepository } from "./KeeperDeclarationRepository";
import { PlayoffResultRepository } from "./PlayoffResultRepository";
import type {
  TransactionRecord,
  AuctionRecord,
  TradeRecord,
  KeeperDeclaration,
  PlayoffResult,
} from "@/lib/models";

export type LedgerEntry =
  | { kind: "transaction"; occurredAt: number; transaction: TransactionRecord }
  | { kind: "auction"; occurredAt: number; record: AuctionRecord }
  | { kind: "trade"; occurredAt: number; trade: TradeRecord }
  | { kind: "keeper_declaration"; occurredAt: number; declaration: KeeperDeclaration }
  | { kind: "playoff_result"; occurredAt: number; result: PlayoffResult };

const transactionRepository = new TransactionRepository();
const auctionRecordRepository = new AuctionRecordRepository();
const tradeRepository = new TradeRepository();
const keeperDeclarationRepository = new KeeperDeclarationRepository();
const playoffResultRepository = new PlayoffResultRepository();

/** Same approximate-ordering caveat as auction records — a season has no exact date, so this anchors to a fixed point within it for chronological sort purposes only. */
function seasonAnchor(season: number, monthDay: string): number {
  return new Date(`${season}-${monthDay}`).getTime();
}

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
 *
 * WeeklyPerformance is deliberately NOT merged in here, even though
 * "weekly matchup"/"starting lineup" are named events in the historical
 * ledger's event list — it's queried very differently (bulk, by
 * season/roster, for stat aggregation) from the rest of this narrative
 * per-event list, and 100+ rows/season would drown out the discrete
 * events this function is actually for. See WeeklyPerformanceRepository
 * for that data instead.
 */
export async function getLedger(leagueId: string): Promise<LedgerEntry[]> {
  const [transactions, auctionRecords, trades, keeperDeclarations, playoffResults] =
    await Promise.all([
      transactionRepository.getTransactionsForLeague(leagueId),
      auctionRecordRepository.getAuctionRecordsForLeague(leagueId),
      tradeRepository.getTradesForLeague(leagueId),
      keeperDeclarationRepository.getKeeperDeclarationsForLeague(leagueId),
      playoffResultRepository.getPlayoffResultsForLeague(leagueId),
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
        occurredAt: seasonAnchor(record.season, "09-01"),
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
    ...keeperDeclarations.map(
      (declaration): LedgerEntry => ({
        kind: "keeper_declaration",
        // Also no exact timestamp — anchored just before the auction anchor
        // above, since a keeper declaration happens shortly before the draft.
        occurredAt: seasonAnchor(declaration.season, "08-15"),
        declaration,
      })
    ),
    ...playoffResults.map(
      (result): LedgerEntry => ({
        kind: "playoff_result",
        // Anchored near the end of the season, well after the auction anchor.
        occurredAt: seasonAnchor(result.season + 1, "01-01"),
        result,
      })
    ),
  ];

  return entries.sort((a, b) => b.occurredAt - a.occurredAt);
}
