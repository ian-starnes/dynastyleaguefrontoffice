/**
 * One roster's side of one week's matchup, in one league-season — the raw
 * source for weekly scoring history. Sourced from Sleeper's per-week
 * matchups endpoint (lib/sleeper/matchups.ts); two rows sharing the same
 * (leagueId, season, week, matchupId) played each other.
 *
 * pointsByPlayerId covers every rostered player that week (bench
 * included) — starterPlayerIds is the subset actually started. Ring of
 * Honor uses ONLY starter points; manager career stats (PPG, highest
 * week) use teamScore, which already reflects the full started lineup's
 * total per Sleeper's own scoring.
 */
export type WeeklyPerformance = {
  leagueId: string;
  season: number;
  week: number;
  rosterId: number;
  /** Null for a bye week, if this league ever has one. */
  matchupId: number | null;
  opponentRosterId: number | null;
  teamScore: number;
  opponentScore: number | null;
  result: "win" | "loss" | "tie" | null;
  starterPlayerIds: string[];
  benchPlayerIds: string[];
  pointsByPlayerId: Record<string, number>;
};
