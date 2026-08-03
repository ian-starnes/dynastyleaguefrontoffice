export type TransactionType =
  | "auction"
  | "trade"
  | "waiver"
  | "free_agent"
  | "keeper"
  | "drop"
  | "add";

/**
 * One immutable row in the league ledger — every event, ever. rawPayload
 * keeps the full original Sleeper record so future reprocessing (e.g. a
 * normalizer bug fix) doesn't require re-fetching from Sleeper.
 */
export type TransactionRecord = {
  leagueId: string;
  sleeperTransactionId: string;
  type: TransactionType;
  createdAt: number; // epoch ms
  rawPayload: unknown;
};
