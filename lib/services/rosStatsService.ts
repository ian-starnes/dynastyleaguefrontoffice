import { getWeeklyStats, getSeasonProjections, getNflState, getPlayers, type NFLPlayer, type SleeperWeeklyStat, type SleeperWeeklyStatsMap, type SleeperSeasonProjectionsMap } from "@/lib/sleeper";
import { RECENCY_WEIGHTING } from "@/lib/config/rosValuationConfig";

export type ROSStats = {
  playerId: string;
  gamesPlayed: number;
  /**
   * Recency-weighted PPG — the core rest-of-season production estimate
   * (brief's Component A). Never season-long PPG alone. Before this
   * season has any real games of its own (weeksUsed === 0), this is
   * instead a real, live 2026 season projection (see getROSStats' doc
   * comment) — still a genuine forward-looking PPG figure, just not
   * derived from completed box scores.
   */
  weightedPPG: number;
  /** Unweighted season PPG, kept only for transparency/comparison — never used as the projection itself. Equal to weightedPPG when sourced from a projection (weeksUsed === 0), since there's only one real figure to compare against. */
  seasonPPG: number;
  /** Player's share of their team's total targets across the weeks in scope. Null for non-pass-catchers or teams with zero recorded targets. */
  targetShare: number | null;
  /** Player's share of their team's total offensive snaps. Null if snap data is missing. */
  snapShare: number | null;
  /** Player's share of their team's total red-zone targets. Null for non-pass-catchers or no red-zone-target data. */
  redZoneTargetShare: number | null;
  /** Player's share of their team's total rush attempts — the "expected carries" signal for RBs specifically. Null for non-runners or no rush data. */
  rushAttemptShare: number | null;
  /** Player's share of their team's total rush red-zone attempts — the goal-line-role signal, distinct from receiving red-zone usage. */
  rushRedZoneAttemptShare: number | null;
  /** Player's share of their team's total pass attempts — meaningful for a QB-competition backfield; ~1.0 for an undisputed starter. */
  passAttemptShare: number | null;
  /** Player's share of their team's total receiving air yards — the "downfield role" signal the brief calls out for WRs specifically. */
  airYardShare: number | null;
  /** Which season this figure is actually drawn from — always the CURRENT season now (see getROSStats' doc comment); never a completed prior season. */
  seasonUsed: number;
  /** How many real completed weeks this is derived from. 0 means this came from a real 2026 season projection instead — no completed weeks exist yet to derive it from. */
  weeksUsed: number;
};

const MAX_WEEK = 18;

/** Raw per-week fields aggregated at the TEAM level so individual players' shares are computable. */
const TEAM_AGGREGATE_FIELDS = [
  "rec_tgt",
  "rec_rz_tgt",
  "rush_att",
  "rush_rz_att",
  "pass_att",
  "rec_air_yd",
] as const;
type TeamAggregateField = (typeof TEAM_AGGREGATE_FIELDS)[number];
type TeamTotals = Record<TeamAggregateField, number>;

function emptyTeamTotals(): TeamTotals {
  return { rec_tgt: 0, rec_rz_tgt: 0, rush_att: 0, rush_rz_att: 0, pass_att: 0, rec_air_yd: 0 };
}

/**
 * Real rest-of-season stats, per player, live from Sleeper's own weekly
 * stats endpoint — confirmed (via direct API check) to expose genuine
 * underlying box-score data (targets, snaps, red-zone targets, rushing
 * and passing volume, air yards), not just fantasy points.
 *
 * SCORING (confirmed against the real league, not assumed): this
 * league's real scoring_settings show rec=0.5, pass_td=4, rush_td=6,
 * rec_td=6 — exactly Sleeper's own standard half-PPR definition, so
 * Sleeper's precomputed pts_half_ppr field is the correct one to read,
 * not the generic pts_ppr this originally used (a confirmed bug from
 * the first verification pass — that mismatch silently overvalued
 * high-target-volume players relative to this league's real rules).
 *
 * SEASON-IN-SCOPE LOGIC (confirmed live, not assumed): Sleeper's
 * /state/nfl reports whether the current season has actually started
 * generating regular-season stats. If it has, this uses the current
 * season's completed weeks. Once the regular season ends and the real
 * NFL playoffs begin, state.season_type flips to "post" while
 * state.season stays the year whose regular season just finished — that
 * full season (all MAX_WEEK weeks) is the most recent real baseline, NOT
 * state.previous_season (a confirmed bug: the original "regular" check
 * missed "post" entirely and fell back a full extra year stale during
 * every real NFL playoff window). Recency weighting is always applied to
 * whichever weeks are in scope (fixed from an earlier version that
 * skipped weighting entirely in a fallback case — a real bug the first
 * verification pass surfaced: a player who struggled early but finished
 * strong was getting dragged down by an unweighted average instead of
 * reflecting their more recent, more predictive form).
 *
 * NO REAL CURRENT-SEASON GAMES YET (genuine preseason, or regular week 1
 * before it's actually been played): this used to fall back to the most
 * recently COMPLETED prior season's full-year stats — a real, stated
 * limitation, not a fabrication, but still last year's players/roles/
 * teams standing in for this year's. Confirmed live (2026-09-03) that
 * Sleeper exposes a real, forward-looking projections endpoint for the
 * CURRENT season instead (getSeasonProjections — same URL shape as
 * getWeeklyStats, /stats/nfl/... -> /projections/nfl/..., unauthenticated,
 * confirmed genuine by its fractional values like rush_att: 17.64, which
 * only a projection model produces, never a completed game). This now
 * uses that real 2026 projection in place of the 2025 fallback — see
 * buildROSStatsFromProjections. The one real limitation: Sleeper's
 * projections payload carries no opportunity-share fields (targets,
 * snaps, red-zone, air yards) at all, so every share field on the
 * result is null during this window — Component B correctly renormalizes
 * away rather than being backfilled with a stale 2025 proxy that would
 * reintroduce the exact "not actually 2026" problem this was fixed for.
 *
 * KNOWN LIMITATION (not fixed, documented instead): team-level share
 * metrics (targetShare, snapShare, etc.) attribute every week in scope
 * to a player's CURRENT team (from precomputedPlayers/getPlayers()'s
 * today snapshot), not whichever team they were actually on that
 * specific historical week. Sleeper's weekly stats payload has no
 * per-week team field to do this correctly (confirmed via direct API
 * check), and reconstructing real per-week rosters historically would
 * need a materially different, much more expensive data source. This
 * only matters for a player who was traded mid-season within the
 * season in scope — their pre-trade weeks get double-counted into
 * their new team's totals and dropped from their old team's — everyone
 * else is unaffected. A player's OWN weightedPPG/seasonPPG (the
 * dominant Component A signal) is unaffected either way, since that's
 * accumulated per-player regardless of team.
 */
export async function getROSStats(
  precomputedPlayers?: NFLPlayer[]
): Promise<Map<string, ROSStats>> {
  const state = await getNflState();
  const currentSeason = Number(state.season);

  let seasonUsed: number;
  let weeksInScope: number[];

  if (state.season_type === "regular" && state.week > 1) {
    seasonUsed = currentSeason;
    weeksInScope = Array.from({ length: state.week - 1 }, (_, i) => i + 1);
  } else if (state.season_type === "post") {
    seasonUsed = currentSeason;
    weeksInScope = Array.from({ length: MAX_WEEK }, (_, i) => i + 1);
  } else {
    // No real games exist yet for the CURRENT season — use a real 2026
    // projection instead of a completed PRIOR season's stats. See the
    // "NO REAL CURRENT-SEASON GAMES YET" section above.
    return buildROSStatsFromProjections(currentSeason);
  }

  const [weeklyStatsByWeek, players] = await Promise.all([
    Promise.all(
      weeksInScope.map(async (week) => {
        try {
          return await getWeeklyStats(seasonUsed, week);
        } catch (error: unknown) {
          // One flaky week (rate limit, timeout) shouldn't take down
          // Market Value league-wide — degrade that single week to "no
          // data" rather than rejecting the whole valuation, which the
          // top-level caller in lib/league-players.ts would otherwise
          // turn into "—" for every player, not just the affected week.
          console.error(
            `Weekly stats fetch failed for season ${seasonUsed} week ${week}, treating as no data for that week:`,
            error
          );
          return {} as SleeperWeeklyStatsMap;
        }
      })
    ),
    precomputedPlayers ?? getPlayers(),
  ]);

  const teamByPlayerId = new Map(players.map((p) => [p.id, p.nflTeam]));

  /** Linear ramp: 1.0 at the oldest week in scope, maxWeekMultiplier at the most recent. A single-week scope (weeksInScope.length === 1) just uses the max weight. */
  function recencyWeight(weekIndex: number): number {
    if (weeksInScope.length <= 1) return RECENCY_WEIGHTING.maxWeekMultiplier;
    const progress = weekIndex / (weeksInScope.length - 1); // 0 (oldest) .. 1 (most recent)
    return 1 + progress * (RECENCY_WEIGHTING.maxWeekMultiplier - 1);
  }

  type Accumulator = {
    weightedPointsSum: number;
    weightedGamesSum: number;
    totalPoints: number;
    gamesPlayed: number;
    own: TeamTotals;
  };
  const byPlayer = new Map<string, Accumulator>();
  const teamTotalsByWeek: Map<number, Map<string, TeamTotals>> = new Map();

  // First pass: accumulate each team's totals per week for every share metric.
  // Same !stat.gp skip as the player pass below — a player's row for a
  // week they didn't play should be all-zero already, but this doesn't
  // rely on that being guaranteed by Sleeper's payload.
  weeksInScope.forEach((week, weekIndex) => {
    const stats = weeklyStatsByWeek[weekIndex];
    const teamTotals = new Map<string, TeamTotals>();
    for (const [playerId, stat] of Object.entries(stats)) {
      if (!stat.gp) continue;
      const team = teamByPlayerId.get(playerId);
      if (!team) continue;
      const totals = teamTotals.get(team) ?? emptyTeamTotals();
      for (const field of TEAM_AGGREGATE_FIELDS) {
        totals[field] += stat[field] ?? 0;
      }
      teamTotals.set(team, totals);
    }
    teamTotalsByWeek.set(week, teamTotals);
  });

  // Second pass: accumulate each player's own stats, weighted by recency
  // (applied uniformly, whether this is the in-progress current season
  // or the completed-season fallback — see doc comment above).
  weeksInScope.forEach((week, weekIndex) => {
    const stats: SleeperWeeklyStatsMap = weeklyStatsByWeek[weekIndex];
    const weight = recencyWeight(weekIndex);

    for (const [playerId, stat] of Object.entries(stats)) {
      if (!stat.gp) continue; // didn't play this week — don't count a $0 game against them

      const existing = byPlayer.get(playerId) ?? {
        weightedPointsSum: 0,
        weightedGamesSum: 0,
        totalPoints: 0,
        gamesPlayed: 0,
        own: emptyTeamTotals(),
      };

      const points = stat.pts_half_ppr ?? 0;
      existing.weightedPointsSum += points * weight;
      existing.weightedGamesSum += weight;
      existing.totalPoints += points;
      existing.gamesPlayed += 1;
      for (const field of TEAM_AGGREGATE_FIELDS) {
        existing.own[field] += stat[field] ?? 0;
      }

      byPlayer.set(playerId, existing);
    }
  });

  function shareOf(field: TeamAggregateField, own: TeamTotals, team: string | undefined): number | null {
    if (!team) return null;
    const teamTotal = weeksInScope.reduce(
      (sum, week) => sum + (teamTotalsByWeek.get(week)?.get(team)?.[field] ?? 0),
      0
    );
    return teamTotal > 0 ? own[field] / teamTotal : null;
  }

  const results = new Map<string, ROSStats>();
  for (const [playerId, acc] of byPlayer) {
    const team = teamByPlayerId.get(playerId);

    results.set(playerId, {
      playerId,
      gamesPlayed: acc.gamesPlayed,
      weightedPPG: acc.weightedGamesSum > 0 ? acc.weightedPointsSum / acc.weightedGamesSum : 0,
      seasonPPG: acc.gamesPlayed > 0 ? acc.totalPoints / acc.gamesPlayed : 0,
      targetShare: shareOf("rec_tgt", acc.own, team),
      snapShare: null, // set below — computed directly from off_snp/tm_off_snp, not a TEAM_AGGREGATE_FIELDS share
      redZoneTargetShare: shareOf("rec_rz_tgt", acc.own, team),
      rushAttemptShare: shareOf("rush_att", acc.own, team),
      rushRedZoneAttemptShare: shareOf("rush_rz_att", acc.own, team),
      passAttemptShare: shareOf("pass_att", acc.own, team),
      airYardShare: shareOf("rec_air_yd", acc.own, team),
      seasonUsed,
      weeksUsed: weeksInScope.length,
    });
  }

  // snapShare needs the player's own off_snp vs their team's tm_off_snp
  // (a field Sleeper already reports as a team total on every player's
  // own row, unlike the other metrics which need aggregating across all
  // of a team's players) — a second lightweight pass keeps this
  // consistent with the rest of ROSStats's shape instead of a special case.
  const offSnapsByPlayer = new Map<string, { own: number; team: number }>();
  weeksInScope.forEach((week, weekIndex) => {
    const stats = weeklyStatsByWeek[weekIndex];
    for (const [playerId, stat] of Object.entries(stats)) {
      if (!stat.gp) continue;
      const existing = offSnapsByPlayer.get(playerId) ?? { own: 0, team: 0 };
      existing.own += stat.off_snp ?? 0;
      existing.team += stat.tm_off_snp ?? 0;
      offSnapsByPlayer.set(playerId, existing);
    }
  });
  for (const [playerId, snaps] of offSnapsByPlayer) {
    const existing = results.get(playerId);
    if (!existing) continue;
    existing.snapShare = snaps.team > 0 ? snaps.own / snaps.team : null;
  }

  return results;
}

/**
 * Builds ROSStats from a real 2026 season projection instead of
 * completed box scores — see getROSStats' "NO REAL CURRENT-SEASON GAMES
 * YET" doc comment for why and when this runs. Deliberately much
 * simpler than the trailing-stats path above: there's no per-week
 * recency weighting to apply (a season-long projection is already one
 * single forward-looking figure, not a series of real weeks to weight),
 * and no team-relative share metrics to compute (Sleeper's projections
 * payload — confirmed live — carries no target/snap/red-zone/air-yard
 * fields at all, only points and core volume stats), so every share
 * field is left null rather than backfilled from a stale prior-season
 * proxy. blendProjection (rosValuationService.ts) already renormalizes
 * across whichever components have real data, so a null
 * opportunityScore here correctly falls back to Components A+C only.
 */
async function buildROSStatsFromProjections(season: number): Promise<Map<string, ROSStats>> {
  const projections = await getSeasonProjections(season, "regular").catch(
    (error: unknown) => {
      console.error(
        `Season projections fetch failed for ${season}, treating as no data:`,
        error
      );
      return {} as SleeperSeasonProjectionsMap;
    }
  );

  const results = new Map<string, ROSStats>();
  for (const [playerId, projection] of Object.entries(projections)) {
    const gamesPlayed = projection.gp ?? 0;
    if (gamesPlayed <= 0) continue; // no real projected role this season — never fabricate a value

    const weightedPPG = (projection.pts_half_ppr ?? 0) / gamesPlayed;

    results.set(playerId, {
      playerId,
      gamesPlayed,
      weightedPPG,
      seasonPPG: weightedPPG,
      targetShare: null,
      snapShare: null,
      redZoneTargetShare: null,
      rushAttemptShare: null,
      rushRedZoneAttemptShare: null,
      passAttemptShare: null,
      airYardShare: null,
      seasonUsed: season,
      weeksUsed: 0,
    });
  }

  return results;
}
