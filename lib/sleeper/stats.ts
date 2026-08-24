import { sleeperFetch } from "./client";

/**
 * Confirmed live (direct API check) that Sleeper's weekly stats payload
 * includes real underlying box-score stats, not just fantasy points —
 * targets, snaps (both the player's and the team's, so snap share is
 * directly computable), red-zone targets, air yards, carries. Only the
 * fields DLFO actually reads are typed here; the raw payload has more.
 */
export type SleeperWeeklyStat = {
  gp?: number;
  pts_ppr?: number;
  pts_half_ppr?: number;
  pts_std?: number;
  rec_tgt?: number;
  rec?: number;
  rush_att?: number;
  off_snp?: number;
  tm_off_snp?: number;
  rec_rz_tgt?: number;
  rec_air_yd?: number;
  /** QB passing volume — this league's real opportunity signal for QBs (confirmed: no dedicated rushing red-zone field for QBs beyond these). */
  pass_att?: number;
  pass_yd?: number;
  pass_td?: number;
  rush_yd?: number;
  rush_td?: number;
  rush_rz_att?: number;
};

export type SleeperWeeklyStatsMap = Record<string, SleeperWeeklyStat>;

/**
 * One week's real stat line for every player who played, keyed by
 * player_id. A week with no games yet (future, or a season that hasn't
 * started) returns an empty object, not an error — callers should treat
 * an empty map as "no data for this week" rather than special-case it.
 */
export async function getWeeklyStats(
  season: number,
  week: number,
  seasonType: "regular" | "pre" | "post" = "regular"
): Promise<SleeperWeeklyStatsMap> {
  return sleeperFetch<SleeperWeeklyStatsMap>(
    `/stats/nfl/${seasonType}/${season}/${week}`,
    { next: { revalidate: 3600 } }
  );
}

export type SleeperNflState = {
  week: number;
  season: string;
  season_type: string;
  previous_season: string;
};

/** Sleeper's own notion of "what week/season is it right now" — the source of truth for whether the current season has any real games yet. */
export async function getNflState(): Promise<SleeperNflState> {
  return sleeperFetch<SleeperNflState>("/state/nfl", {
    next: { revalidate: 3600 },
  });
}
