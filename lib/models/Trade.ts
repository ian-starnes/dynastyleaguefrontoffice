/**
 * A trade event. Players/picks kept as plain arrays rather than a web of
 * join tables — a trade is read and reasoned about as one whole event,
 * not queried player-by-player.
 */
export type TradeRecord = {
  leagueId: string;
  sleeperTransactionId: string;
  occurredAt: number; // epoch ms
  rosterIdsInvolved: number[];
  /** player_id -> roster_id it moved to. */
  playersInvolved: Record<string, number>;
  /** From this trade transaction's own draft_picks field — which picks changed hands in THIS trade specifically. */
  picksInvolved: Array<{
    season: string;
    round: number;
    rosterId: number;
    previousOwnerRosterId: number;
  }>;
};
