import { getAllWeeklyPerformances, type OwnerWeeklyPerformance } from "./weeklyPerformanceService";
import { getAllPlayoffResults, type OwnerPlayoffResult } from "./playoffResultsService";
import { getLeagueSeasonChain, getSleeperLeagueId } from "@/lib/sleeper";

export type RingOfHonorEntry = {
  playerId: string;
  ownerId: string;
  ownerName: string | null;
  totalStartingLineupPoints: number;
  gamesStarted: number;
  averagePointsPerStart: number;
  winsWhileStarting: number;
  playoffStarts: number;
  championshipStarts: number;
  /** Every season this player was started at least once for this franchise. */
  yearsWithFranchise: number[];
  highestWeeklyScoreWhileOnFranchise: { season: number; week: number; points: number } | null;
  /** Distinct seasons started, oldest to newest — not necessarily consecutive. */
  longestTenure: number;
};

/**
 * Per (player, franchise) production while STARTED — never a player's
 * whole career, only what happened while they were in this owner's
 * starting lineup, per the brief's explicit Ring of Honor definition. A
 * player who moved between franchises gets a separate entry for each one.
 *
 * "Championship starts" needs to know which specific week was the
 * championship game — Sleeper doesn't expose a per-week "this was the
 * title game" flag directly, so it's derived: the highest week number
 * with real performance data in a season is that season's championship
 * week (this league's bracket always resolves by the last scheduled
 * week — verified the same 15/16/17 three-round structure holds across
 * every completed season in the Phase 8 bracket audit), and a start
 * counts as a championship start only if it happened in that exact week
 * FOR the owner who was that season's champion or runner-up (from
 * playoffResultsService, place 1 or 2) — not just "started in the
 * playoffs generally."
 */
export async function getRingOfHonor(
  precomputed?: { performances: OwnerWeeklyPerformance[]; playoffResults: OwnerPlayoffResult[] }
): Promise<RingOfHonorEntry[]> {
  const [performances, playoffResults] = precomputed
    ? [precomputed.performances, precomputed.playoffResults]
    : await Promise.all([getAllWeeklyPerformances(), getAllPlayoffResults()]);

  const fullChain = await getLeagueSeasonChain(getSleeperLeagueId());
  const playoffWeekStartBySeason = new Map<number, number>();
  for (const league of fullChain) {
    playoffWeekStartBySeason.set(
      Number(league.season),
      Number(league.settings.playoff_week_start ?? 15)
    );
  }

  const finalWeekBySeason = new Map<number, number>();
  for (const performance of performances) {
    const currentMax = finalWeekBySeason.get(performance.season) ?? 0;
    if (performance.week > currentMax) finalWeekBySeason.set(performance.season, performance.week);
  }

  const finalistOwnerIdsBySeason = new Map<number, Set<string>>();
  for (const result of playoffResults) {
    if (!result.ownerId || (result.place !== 1 && result.place !== 2)) continue;
    const set = finalistOwnerIdsBySeason.get(result.season) ?? new Set<string>();
    set.add(result.ownerId);
    finalistOwnerIdsBySeason.set(result.season, set);
  }

  type Accumulator = {
    playerId: string;
    ownerId: string;
    ownerName: string | null;
    totalStartingLineupPoints: number;
    gamesStarted: number;
    winsWhileStarting: number;
    playoffStarts: number;
    championshipStarts: number;
    seasons: Set<number>;
    highest: { season: number; week: number; points: number } | null;
  };
  const byKey = new Map<string, Accumulator>();

  for (const performance of performances) {
    if (!performance.ownerId) continue;
    const playoffWeekStart = playoffWeekStartBySeason.get(performance.season) ?? Infinity;
    const isPlayoffWeek = performance.week >= playoffWeekStart;
    const isChampionshipWeek =
      performance.week === finalWeekBySeason.get(performance.season) &&
      finalistOwnerIdsBySeason.get(performance.season)?.has(performance.ownerId) === true;

    for (const playerId of performance.starterPlayerIds) {
      const points = performance.pointsByPlayerId[playerId];
      if (points === undefined) continue;

      const key = `${playerId}:${performance.ownerId}`;
      const existing = byKey.get(key) ?? {
        playerId,
        ownerId: performance.ownerId,
        ownerName: performance.ownerName,
        totalStartingLineupPoints: 0,
        gamesStarted: 0,
        winsWhileStarting: 0,
        playoffStarts: 0,
        championshipStarts: 0,
        seasons: new Set<number>(),
        highest: null,
      };

      existing.totalStartingLineupPoints += points;
      existing.gamesStarted += 1;
      existing.seasons.add(performance.season);
      if (performance.result === "win") existing.winsWhileStarting += 1;
      if (isPlayoffWeek) existing.playoffStarts += 1;
      if (isChampionshipWeek) existing.championshipStarts += 1;
      if (!existing.highest || points > existing.highest.points) {
        existing.highest = { season: performance.season, week: performance.week, points };
      }

      byKey.set(key, existing);
    }
  }

  return [...byKey.values()]
    .map((entry): RingOfHonorEntry => {
      const years = [...entry.seasons].sort((a, b) => a - b);
      return {
        playerId: entry.playerId,
        ownerId: entry.ownerId,
        ownerName: entry.ownerName,
        totalStartingLineupPoints: entry.totalStartingLineupPoints,
        gamesStarted: entry.gamesStarted,
        averagePointsPerStart:
          entry.gamesStarted > 0 ? entry.totalStartingLineupPoints / entry.gamesStarted : 0,
        winsWhileStarting: entry.winsWhileStarting,
        playoffStarts: entry.playoffStarts,
        championshipStarts: entry.championshipStarts,
        yearsWithFranchise: years,
        highestWeeklyScoreWhileOnFranchise: entry.highest,
        longestTenure: years.length,
      };
    })
    .sort((a, b) => b.totalStartingLineupPoints - a.totalStartingLineupPoints);
}
