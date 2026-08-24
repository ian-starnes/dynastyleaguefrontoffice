import {
  getLeagueSeasonChain,
  getRostersForLeague,
  getOwnersForLeague,
  getAllMatchupsForLeague,
  getSleeperLeagueId,
} from "@/lib/sleeper";
import { normalizeWeekMatchups } from "@/lib/import/normalizer";
import { getFranchiseIdentityMap, canonicalizeOwnerId } from "./franchiseIdentityService";
import { WEEKLY_RESULT_CORRECTIONS } from "@/lib/config/historicalResultCorrections";
import type { WeeklyPerformance } from "@/lib/models";

/**
 * Applies any explicit, confirmed override from historicalResultCorrections.ts
 * — see that file's doc comment. Only ever touches `result`; the real
 * recorded point totals are left exactly as Sleeper reported them, since
 * what's disputed is who won, not the scores themselves. Returns whether
 * a correction actually applied, so callers can flag the row and keep
 * margin-derived stats (which assume win implies the higher score) from
 * treating it as a real blowout or nail-biter it never was.
 */
function applyResultCorrection(
  performance: WeeklyPerformance
): { performance: WeeklyPerformance; corrected: boolean } {
  const correction = WEEKLY_RESULT_CORRECTIONS.find(
    (c) => c.season === performance.season && c.week === performance.week
  );
  if (!correction) return { performance, corrected: false };

  if (performance.rosterId === correction.winningRosterId) {
    return { performance: { ...performance, result: "win" }, corrected: true };
  }
  if (performance.rosterId === correction.losingRosterId) {
    return { performance: { ...performance, result: "loss" }, corrected: true };
  }
  return { performance, corrected: false };
}

/**
 * A WeeklyPerformance row with owner identity resolved. roster_id only
 * means anything within one league_id (one season) — Sleeper's
 * previous_league_id chain gives each season a fresh set of roster_ids,
 * so career stats across seasons have to be attributed by owner_id
 * instead, which is exactly the problem this service exists to solve.
 * ownerId is further canonicalized through franchiseIdentityService so a
 * manager succession (same roster, new Sleeper account) doesn't fracture
 * one franchise's career history across two different ids — see that
 * service's doc comment for the real, confirmed case this handles.
 */
export type OwnerWeeklyPerformance = WeeklyPerformance & {
  ownerId: string | null;
  ownerName: string | null;
  opponentOwnerId: string | null;
  opponentOwnerName: string | null;
  /**
   * True when historicalResultCorrections.ts overrode this game's result.
   * The recorded teamScore/opponentScore are NOT corrected (no real
   * corrected score exists to fabricate), so win/loss-based stats
   * (records, streaks, championships) can trust `result` directly, but
   * anything margin-derived (largest blowout, closest victory, biggest
   * win/loss) must skip these rows — otherwise a "win" with a lower
   * score than the opponent produces a nonsensical negative margin.
   */
  resultManuallyCorrected: boolean;
};

/**
 * Live equivalent of what lib/import/leagueImportService.ts writes to the
 * weekly_performances table — no database exists yet to read that back
 * from, so this walks the full season chain and normalizes matchups the
 * same way, on demand. Once Postgres is provisioned this can switch to
 * WeeklyPerformanceRepository.getWeeklyPerformancesForLeague() without
 * changing its return shape or any caller.
 *
 * Deliberately computes win/loss/points from the raw per-week matchup
 * pairs (via normalizeWeekMatchups), never from roster.settings.wins —
 * this league's league_average_match setting doubles every roster's
 * win/loss total against a synthetic "league average" opponent that
 * doesn't appear in the matchups endpoint itself, so trusting the raw
 * pairs sidesteps that double-counting entirely rather than needing to
 * know about it.
 */
export async function getAllWeeklyPerformances(): Promise<OwnerWeeklyPerformance[]> {
  const rootLeagueId = getSleeperLeagueId();
  const [seasonChain, franchiseIdentity] = await Promise.all([
    getLeagueSeasonChain(rootLeagueId),
    getFranchiseIdentityMap(),
  ]);

  const perSeason = await Promise.all(
    seasonChain.map(async (league) => {
      const [rosters, owners, weeks] = await Promise.all([
        getRostersForLeague(league.league_id),
        getOwnersForLeague(league.league_id),
        getAllMatchupsForLeague(league.league_id),
      ]);

      const ownerIdByRosterId = new Map(
        rosters.map((roster) => [roster.roster_id, roster.owner_id])
      );
      const ownerNameByOwnerId = new Map(
        owners.map((owner) => [
          owner.user_id,
          owner.metadata?.team_name ?? owner.display_name,
        ])
      );

      function resolveOwner(rosterId: number | null) {
        if (rosterId === null) return { ownerId: null, ownerName: null };
        const rawOwnerId = ownerIdByRosterId.get(rosterId) ?? null;
        if (!rawOwnerId) return { ownerId: null, ownerName: null };
        const ownerId = canonicalizeOwnerId(rawOwnerId, franchiseIdentity);
        const ownerName =
          franchiseIdentity.currentOwnerName.get(ownerId) ??
          ownerNameByOwnerId.get(rawOwnerId) ??
          null;
        return { ownerId, ownerName };
      }

      const season = Number(league.season);
      const performances: OwnerWeeklyPerformance[] = [];

      for (const { week, matchups } of weeks) {
        if (matchups.length === 0) continue;

        for (const rawPerformance of normalizeWeekMatchups(
          league.league_id,
          season,
          week,
          matchups
        )) {
          const { performance, corrected } = applyResultCorrection(rawPerformance);
          const owner = resolveOwner(performance.rosterId);
          const opponent = resolveOwner(performance.opponentRosterId);

          performances.push({
            ...performance,
            ownerId: owner.ownerId,
            ownerName: owner.ownerName,
            opponentOwnerId: opponent.ownerId,
            opponentOwnerName: opponent.ownerName,
            resultManuallyCorrected: corrected,
          });
        }
      }

      return performances;
    })
  );

  return perSeason.flat();
}

/** The single highest team score across every week, every season. */
export function getHighestWeeklyTeamScore(
  performances: OwnerWeeklyPerformance[]
): OwnerWeeklyPerformance | null {
  return performances.reduce<OwnerWeeklyPerformance | null>(
    (highest, performance) =>
      !highest || performance.teamScore > highest.teamScore ? performance : highest,
    null
  );
}

export type PlayerWeekScore = {
  playerId: string;
  points: number;
  season: number;
  week: number;
  ownerId: string | null;
  ownerName: string | null;
};

/**
 * The single highest individual scoring performance across every week,
 * every season — STARTED points only, matching the Ring of Honor
 * convention (production while started, not bench stat-padding).
 */
export function getHighestScoringPlayerWeek(
  performances: OwnerWeeklyPerformance[]
): PlayerWeekScore | null {
  let highest: PlayerWeekScore | null = null;

  for (const performance of performances) {
    for (const playerId of performance.starterPlayerIds) {
      const points = performance.pointsByPlayerId[playerId];
      if (points === undefined) continue;
      if (!highest || points > highest.points) {
        highest = {
          playerId,
          points,
          season: performance.season,
          week: performance.week,
          ownerId: performance.ownerId,
          ownerName: performance.ownerName,
        };
      }
    }
  }

  return highest;
}

export type OwnerCareerStats = {
  ownerId: string;
  ownerName: string | null;
  gamesPlayed: number;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  /** Manager career stats use full team scoring, per the brief — not started-only like Ring of Honor. */
  averagePointsPerWeek: number;
};

/**
 * Per-owner career record across every season this owner has appeared in
 * this league, keyed on owner_id so it survives the roster_id reset that
 * happens at every season boundary.
 */
export function getCareerStatsByOwner(
  performances: OwnerWeeklyPerformance[]
): Map<string, OwnerCareerStats> {
  const statsByOwnerId = new Map<string, OwnerCareerStats>();

  for (const performance of performances) {
    if (!performance.ownerId || performance.opponentScore === null) continue;

    const existing = statsByOwnerId.get(performance.ownerId) ?? {
      ownerId: performance.ownerId,
      ownerName: performance.ownerName,
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      ties: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      averagePointsPerWeek: 0,
    };

    existing.gamesPlayed += 1;
    existing.pointsFor += performance.teamScore;
    existing.pointsAgainst += performance.opponentScore;
    if (performance.result === "win") existing.wins += 1;
    else if (performance.result === "loss") existing.losses += 1;
    else if (performance.result === "tie") existing.ties += 1;

    statsByOwnerId.set(performance.ownerId, existing);
  }

  for (const stats of statsByOwnerId.values()) {
    stats.averagePointsPerWeek =
      stats.gamesPlayed > 0 ? stats.pointsFor / stats.gamesPlayed : 0;
  }

  return statsByOwnerId;
}

/**
 * Longest consecutive run of a given result within one already-filtered
 * set of performances (e.g. one owner's games, or one owner's games in
 * one season) — a shared primitive so league-wide "longest streak ever"
 * and one manager's own longest streak don't duplicate this logic.
 * Chronological order isn't assumed — this sorts by season/week itself.
 */
export function computeLongestStreak(
  performances: OwnerWeeklyPerformance[],
  result: "win" | "loss"
): number {
  const sorted = [...performances].sort((a, b) => a.season - b.season || a.week - b.week);
  let current = 0;
  let longest = 0;
  for (const performance of sorted) {
    if (performance.result === result) {
      current += 1;
      longest = Math.max(longest, current);
    } else {
      current = 0;
    }
  }
  return longest;
}
