/**
 * A pre-draft keeper declaration — player_ids an owner marked as keepers
 * going into that season's draft, from Sleeper's roster.keepers field
 * (lib/sleeper/types.ts's SleeperRoster).
 *
 * NOT authoritative on its own: confirmed (via live API audit) present
 * for some seasons in this league's history and entirely absent for
 * others despite a real auction having happened. Use auction_records'
 * is_keeper flag (set at the draft itself) as the primary signal for
 * "was this player kept that year" — this is a secondary, best-effort
 * corroborating signal for whichever seasons Sleeper happens to have it.
 */
export type KeeperDeclaration = {
  leagueId: string;
  season: number;
  rosterId: number;
  playerId: string;
};
