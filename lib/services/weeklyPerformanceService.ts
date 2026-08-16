import {
  getLeagueSeasonChain,
  getRostersForLeague,
  getOwnersForLeague,
  getAllMatchupsForLeague,
  getSleeperLeagueId,
} from "@/lib/sleeper";
import { normalizeWeekMatchups } from "@/lib/import/normalizer";
import type { WeeklyPerformance } from "@/lib/models";

/**
 * A WeeklyPerformance row with owner identity resolved. roster_id only
 * means anything within one league_id (one season) — Sleeper's
 * previous_league_id chain gives each season a fresh set of roster_ids,
 * so career stats across seasons have to be attributed by owner_id
 * (stable to a real Sleeper account) instead, which is exactly the
 * problem this service exists to solve.
 */
export type OwnerWeeklyPerformance = WeeklyPerformance & {
  ownerId: string | null;
  ownerName: string | null;
  opponentOwnerId: string | null;
  opponentOwnerName: string | null;
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
  const seasonChain = await getLeagueSeasonChain(rootLeagueId);

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
        const ownerId = ownerIdByRosterId.get(rosterId) ?? null;
        return {
          ownerId,
          ownerName: ownerId ? ownerNameByOwnerId.get(ownerId) ?? null : null,
        };
      }

      const season = Number(league.season);
      const performances: OwnerWeeklyPerformance[] = [];

      for (const { week, matchups } of weeks) {
        if (matchups.length === 0) continue;

        for (const performance of normalizeWeekMatchups(
          league.league_id,
          season,
          week,
          matchups
        )) {
          const owner = resolveOwner(performance.rosterId);
          const opponent = resolveOwner(performance.opponentRosterId);

          performances.push({
            ...performance,
            ownerId: owner.ownerId,
            ownerName: owner.ownerName,
            opponentOwnerId: opponent.ownerId,
            opponentOwnerName: opponent.ownerName,
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
