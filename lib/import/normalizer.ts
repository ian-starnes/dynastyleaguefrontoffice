import type {
  SleeperUser,
  SleeperRoster,
  SleeperTransaction,
  SleeperDraftPick,
  SleeperMatchup,
  SleeperBracketMatch,
} from "@/lib/sleeper";
import type {
  Owner,
  Team,
  TransactionRecord,
  TransactionType,
  AuctionRecord,
  TradeRecord,
  WeeklyPerformance,
  KeeperDeclaration,
  PlayoffResult,
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
    // Previously left empty — Sleeper's traded_picks endpoint isn't linked
    // to a transaction_id, so attributing picks to THIS trade specifically
    // wasn't derivable from that endpoint. But transaction.draft_picks
    // (confirmed live during the Phase 1 API audit) is scoped to this
    // exact transaction, so it resolves that limitation directly.
    picksInvolved: transaction.draft_picks.map((pick) => ({
      season: pick.season,
      round: pick.round,
      rosterId: pick.owner_id,
      previousOwnerRosterId: pick.previous_owner_id,
    })),
  };
}

/**
 * One week's matchups -> one WeeklyPerformance row per roster, opponent
 * resolved by pairing rosters that share the same matchup_id. Confirmed
 * live that Sleeper always pairs exactly 2 rosters per matchup_id in this
 * league (league_average_match doesn't add a third synthetic side to the
 * raw matchups payload) — defensively falls back to "no opponent" if that
 * ever isn't true rather than guessing which side is real.
 */
export function normalizeWeekMatchups(
  leagueId: string,
  season: number,
  week: number,
  matchups: SleeperMatchup[]
): WeeklyPerformance[] {
  const byMatchupId = new Map<number, SleeperMatchup[]>();
  const standalone: SleeperMatchup[] = [];

  for (const matchup of matchups) {
    if (matchup.matchup_id === null) {
      standalone.push(matchup);
      continue;
    }
    const group = byMatchupId.get(matchup.matchup_id) ?? [];
    group.push(matchup);
    byMatchupId.set(matchup.matchup_id, group);
  }

  function toPerformance(
    matchup: SleeperMatchup,
    opponent: SleeperMatchup | null
  ): WeeklyPerformance {
    const starters = new Set(matchup.starters);
    const result: WeeklyPerformance["result"] =
      opponent === null
        ? null
        : matchup.points > opponent.points
          ? "win"
          : matchup.points < opponent.points
            ? "loss"
            : "tie";

    return {
      leagueId,
      season,
      week,
      rosterId: matchup.roster_id,
      matchupId: matchup.matchup_id,
      opponentRosterId: opponent?.roster_id ?? null,
      teamScore: matchup.points,
      opponentScore: opponent?.points ?? null,
      result,
      starterPlayerIds: matchup.starters,
      benchPlayerIds: matchup.players.filter((id) => !starters.has(id)),
      pointsByPlayerId: matchup.players_points,
    };
  }

  const performances: WeeklyPerformance[] = standalone.map((matchup) =>
    toPerformance(matchup, null)
  );

  for (const group of byMatchupId.values()) {
    if (group.length === 2) {
      performances.push(toPerformance(group[0], group[1]));
      performances.push(toPerformance(group[1], group[0]));
    } else {
      // Unexpected group size — record each side with no resolved
      // opponent rather than guessing a pairing.
      for (const matchup of group) {
        performances.push(toPerformance(matchup, null));
      }
    }
  }

  return performances;
}

/**
 * Sleeper's own pre-draft keeper declarations, where the roster.keepers
 * field is populated — see lib/models/KeeperDeclaration.ts for why this
 * is a secondary signal, not authoritative on its own.
 */
export function normalizeKeeperDeclarations(
  leagueId: string,
  season: number,
  rosters: SleeperRoster[]
): KeeperDeclaration[] {
  const declarations: KeeperDeclaration[] = [];
  for (const roster of rosters) {
    if (!roster.keepers) continue;
    for (const playerId of roster.keepers) {
      declarations.push({
        leagueId,
        season,
        rosterId: roster.roster_id,
        playerId,
      });
    }
  }
  return declarations;
}

/**
 * Winners + losers bracket -> final per-roster placements. CONFIRMED LIVE
 * (Phase 2 audit): losers_bracket's `p` field is relative to the
 * consolation bracket only, not an absolute league placement — offset by
 * playoffTeams so e.g. p:1 in the losers bracket becomes the real place
 * right after the last playoff spot (playoffTeams + 1), not "1st place."
 * Matches with no `p` field are mid-bracket progression, not a final
 * placement, and are skipped.
 */
export function normalizePlayoffResults(
  leagueId: string,
  season: number,
  winnersBracket: SleeperBracketMatch[],
  losersBracket: SleeperBracketMatch[],
  playoffTeams: number
): PlayoffResult[] {
  const results: PlayoffResult[] = [];

  function addPlacements(matches: SleeperBracketMatch[], placeOffset: number) {
    for (const match of matches) {
      if (match.p === undefined || match.w === null || match.l === null) continue;
      const winnerPlace = placeOffset + match.p;
      results.push({ leagueId, season, rosterId: match.w, place: winnerPlace });
      results.push({ leagueId, season, rosterId: match.l, place: winnerPlace + 1 });
    }
  }

  addPlacements(winnersBracket, 0);
  addPlacements(losersBracket, playoffTeams);

  return results;
}
