/**
 * One roster's final placement in one league-season — reconstructed from
 * Sleeper's winners_bracket/losers_bracket endpoints (lib/sleeper/brackets.ts),
 * which record which roster won/lost each bracket match and, via the
 * optional `p` field, which final place that match decided.
 *
 * Powers Wall of Champions (place 1-3) directly. Wall of Shame's "10th
 * place at the START of playoffs" is NOT this — that's a regular-season
 * standing computed from WeeklyPerformance for weeks before
 * playoff_week_start, since a completed roster's cumulative Sleeper
 * record includes playoff weeks too. This model only covers the
 * post-playoff final standing.
 *
 * CONFIRMED GOTCHA (live-verified, not assumed): winners_bracket's `p`
 * field is an absolute league placement (1, 3, 5...), but losers_bracket's
 * `p` field is relative to the CONSOLATION bracket only — this league's
 * 2025 season showed a "place 1" in both brackets simultaneously (the
 * true champion, and separately the winner of the losers-bracket, who
 * actually finished well below the playoff cutoff). Whatever populates
 * this table (Phase 5/8) must offset losers_bracket placements by
 * league.settings.playoff_teams before writing `place`, never trust its
 * `p` value directly.
 */
export type PlayoffResult = {
  leagueId: string;
  season: number;
  rosterId: number;
  place: number;
};
