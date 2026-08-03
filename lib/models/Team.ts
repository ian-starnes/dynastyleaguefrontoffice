/**
 * One team, scoped to one league-season — Sleeper's roster_id is only
 * unique within a single league_id, not across the previous_league_id
 * chain, so a "team" here is (leagueId, rosterId), not a standalone
 * cross-season identity.
 */
export type Team = {
  leagueId: string;
  rosterId: number;
  ownerId: string | null;
};
