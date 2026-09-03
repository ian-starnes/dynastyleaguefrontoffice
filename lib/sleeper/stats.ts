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

/**
 * Confirmed live (direct API check, 2026-09-03) that this is a real,
 * forward-looking projection, not disguised historical stats: fields
 * like rush_att/rush_td carry FRACTIONAL values (e.g. 17.64, 0.6) that
 * are only possible from a projection model — a real completed game
 * always has integer counts. Unauthenticated, same as every other
 * Sleeper endpoint. Deliberately typed narrowly to only the fields
 * rosStatsService.ts actually reads — the real payload has many more
 * (ADP variants, per-distance reception buckets, etc.) that aren't
 * needed here. No opportunity-share fields (targets, snaps, red-zone,
 * air yards) exist in this payload at all — confirmed by inspecting the
 * full real response — so this can only feed a production/points
 * signal, never the opportunity composite.
 */
export type SleeperSeasonProjection = {
  /** Projected games played this season — 0 or absent means no real projected role (e.g. season-ending injury). */
  gp?: number;
  pts_half_ppr?: number;
};

export type SleeperSeasonProjectionsMap = Record<string, SleeperSeasonProjection>;

/**
 * A full season's projected production, keyed by player_id — the real
 * sibling of getWeeklyStats's URL shape (/stats/nfl/... ->
 * /projections/nfl/...), just with no trailing /{week} segment for the
 * season-long aggregate. Used by rosStatsService.ts only when the
 * current season has no real games of its own yet.
 */
export async function getSeasonProjections(
  season: number,
  seasonType: "regular" | "pre" | "post" = "regular"
): Promise<SleeperSeasonProjectionsMap> {
  return sleeperFetch<SleeperSeasonProjectionsMap>(
    `/projections/nfl/${seasonType}/${season}`,
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
