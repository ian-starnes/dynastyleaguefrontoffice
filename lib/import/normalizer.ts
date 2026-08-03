import type {
  SleeperUser,
  SleeperRoster,
  SleeperTransaction,
  SleeperDraftPick,
} from "@/lib/sleeper";
import type {
  Owner,
  Team,
  TransactionRecord,
  TransactionType,
  AuctionRecord,
  TradeRecord,
} from "@/lib/models";

export function normalizeOwner(user: SleeperUser): Owner {
  return {
    ownerId: user.user_id,
    displayName: user.display_name,
    teamName: user.metadata?.team_name ?? null,
  };
}

export function normalizeTeam(leagueId: string, roster: SleeperRoster): Team {
  return {
    leagueId,
    rosterId: roster.roster_id,
    ownerId: roster.owner_id,
  };
}

/**
 * Sleeper's raw transaction `type` is always "trade" | "waiver" |
 * "free_agent" — "auction"/"keeper" events come from draft picks instead
 * (see normalizeAuctionRecord below), and "drop"/"add" aren't split out
 * as their own transaction type by this normalizer, only as fields within
 * a waiver/free_agent transaction. Both remain part of TransactionType
 * for architectural completeness even though this function never
 * produces them.
 */
export function normalizeTransaction(
  leagueId: string,
  transaction: SleeperTransaction
): TransactionRecord {
  return {
    leagueId,
    sleeperTransactionId: transaction.transaction_id,
    type: transaction.type as TransactionType,
    createdAt: transaction.created,
    rawPayload: transaction,
  };
}

/**
 * Draft picks -> auction/keeper history. Only meaningful for auction-type
 * drafts — callers should skip picks from a non-auction (snake) draft
 * entirely, since those have no metadata.amount.
 */
export function normalizeAuctionRecord(
  leagueId: string,
  season: number,
  pick: SleeperDraftPick,
  rosterIdToOwnerId: Map<number, string>
): AuctionRecord {
  return {
    leagueId,
    season,
    playerId: pick.player_id,
    ownerId: rosterIdToOwnerId.get(pick.roster_id) ?? null,
    winningBid: Number(pick.metadata?.amount ?? 0),
    isKeeper: pick.is_keeper ?? false,
    // Not derivable from a single pick — would need to track consecutive
    // is_keeper years per player across the whole season chain. See the
    // Limitations note in the architecture plan.
    keeperYear: null,
  };
}

export function normalizeTrade(
  leagueId: string,
  transaction: SleeperTransaction
): TradeRecord {
  return {
    leagueId,
    sleeperTransactionId: transaction.transaction_id,
    occurredAt: transaction.created,
    rosterIdsInvolved: transaction.roster_ids,
    playersInvolved: { ...(transaction.adds ?? {}) },
    // Sleeper's traded_picks endpoint isn't linked to a specific
    // transaction_id, so reliably attributing which picks moved in THIS
    // trade (vs. a different one involving the same rosters) isn't
    // derivable from the API — left empty rather than guessed. Documented
    // limitation, not a bug.
    picksInvolved: [],
  };
}
