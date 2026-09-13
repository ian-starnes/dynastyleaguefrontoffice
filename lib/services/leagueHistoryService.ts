import { getLeagueSeasonChain, getSleeperLeagueId } from "@/lib/sleeper";
import {
  getAllWeeklyPerformances,
  computeLongestStreak,
  type OwnerWeeklyPerformance,
} from "./weeklyPerformanceService";
import { getSeasonStandings, type OwnerSeasonStanding } from "./seasonStandingsService";
import { getAllPlayoffResults, type OwnerPlayoffResult } from "./playoffResultsService";
import {
  getTransactionHistory,
  type OwnerTransactionStats,
  type AuctionPurchase,
} from "./transactionHistoryService";

/**
 * Per-season league settings every downstream computation in this file
 * needs to tell regular-season weeks/placements apart from playoff ones —
 * fetched once here rather than separately by each caller.
 */
async function getSeasonSettingsBySeason(): Promise<{
  playoffWeekStartBySeason: Map<number, number>;
  playoffTeamsBySeason: Map<number, number>;
}> {
  const fullChain = await getLeagueSeasonChain(getSleeperLeagueId());
  const playoffWeekStartBySeason = new Map<number, number>();
  const playoffTeamsBySeason = new Map<number, number>();
  for (const league of fullChain) {
    const season = Number(league.season);
    playoffWeekStartBySeason.set(season, Number(league.settings.playoff_week_start ?? 15));
    playoffTeamsBySeason.set(season, Number(league.settings.playoff_teams ?? 6));
  }
  return { playoffWeekStartBySeason, playoffTeamsBySeason };
}

export type SeasonChampionship = {
  season: number;
  championOwnerId: string | null;
  championOwnerName: string | null;
  runnerUpOwnerId: string | null;
  runnerUpOwnerName: string | null;
  thirdPlaceOwnerId: string | null;
  thirdPlaceOwnerName: string | null;
  regularSeasonChampionOwnerId: string | null;
  regularSeasonChampionOwnerName: string | null;
  /** Highest REGULAR-SEASON points that season — see doc note on the assumption this makes. */
  highestScoringOwnerId: string | null;
  highestScoringOwnerName: string | null;
  highestScoringPoints: number | null;
};

/**
 * "Highest scoring team" is computed from regular-season points only
 * (OwnerSeasonStanding.pointsFor), matching the same standings this
 * function already needs for "regular season champion" — not full-season
 * (incl. playoffs) totals. Documented assumption, not verified against
 * an explicit league ruling either way.
 */
export function computeWallOfChampions(
  playoffResults: OwnerPlayoffResult[],
  standings: OwnerSeasonStanding[]
): SeasonChampionship[] {
  const seasons = [...new Set(playoffResults.map((r) => r.season))].sort();
  const standingsBySeasonRank = new Map<string, OwnerSeasonStanding>();
  for (const standing of standings) {
    standingsBySeasonRank.set(`${standing.season}:${standing.rank}`, standing);
  }
  const standingsBySeasonOwner = new Map<string, OwnerSeasonStanding>();
  for (const standing of standings) {
    standingsBySeasonOwner.set(`${standing.season}:${standing.ownerId}`, standing);
  }

  return seasons.map((season) => {
    const resultsThisSeason = playoffResults.filter((r) => r.season === season);
    const byPlace = new Map(resultsThisSeason.map((r) => [r.place, r]));

    const regularSeasonChampion = standingsBySeasonRank.get(`${season}:1`);
    const highestScoring = standings
      .filter((s) => s.season === season)
      .sort((a, b) => b.pointsFor - a.pointsFor)[0];

    return {
      season,
      championOwnerId: byPlace.get(1)?.ownerId ?? null,
      championOwnerName: byPlace.get(1)?.ownerName ?? null,
      runnerUpOwnerId: byPlace.get(2)?.ownerId ?? null,
      runnerUpOwnerName: byPlace.get(2)?.ownerName ?? null,
      thirdPlaceOwnerId: byPlace.get(3)?.ownerId ?? null,
      thirdPlaceOwnerName: byPlace.get(3)?.ownerName ?? null,
      regularSeasonChampionOwnerId: regularSeasonChampion?.ownerId ?? null,
      regularSeasonChampionOwnerName: regularSeasonChampion?.ownerName ?? null,
      highestScoringOwnerId: highestScoring?.ownerId ?? null,
      highestScoringOwnerName: highestScoring?.ownerName ?? null,
      highestScoringPoints: highestScoring?.pointsFor ?? null,
    };
  });
}

export type SeasonShame = {
  season: number;
  lastPlaceOwnerId: string | null; // 10th place AT START of playoffs — see standings' own doc note
  lastPlaceOwnerName: string | null;
  worstRecordWins: number | null;
  worstRecordLosses: number | null;
  lowestSeasonPointsOwnerId: string | null;
  lowestSeasonPointsOwnerName: string | null;
  lowestSeasonPoints: number | null;
  lowestWeeklyScore: { ownerId: string | null; ownerName: string | null; week: number; score: number } | null;
  longestLosingStreak: { ownerId: string | null; ownerName: string | null; length: number } | null;
};

export function computeWallOfShame(
  performances: OwnerWeeklyPerformance[],
  standings: OwnerSeasonStanding[],
  playoffWeekStartBySeason: Map<number, number>
): SeasonShame[] {
  const seasons = [...new Set(standings.map((s) => s.season))].sort();

  return seasons.map((season) => {
    const seasonStandings = standings.filter((s) => s.season === season);
    const lastPlace = seasonStandings.reduce<OwnerSeasonStanding | null>(
      (worst, s) => (!worst || s.rank > worst.rank ? s : worst),
      null
    );
    const lowestPoints = seasonStandings.reduce<OwnerSeasonStanding | null>(
      (lowest, s) => (!lowest || s.pointsFor < lowest.pointsFor ? s : lowest),
      null
    );

    const seasonPerformances = performances.filter((p) => p.season === season);
    // Regular season only — an eliminated team resting players (or a
    // depleted bye-week roster) during a meaningless playoff week would
    // otherwise produce a "lowest score" that's about roster management
    // in a dead game, not genuine season-long futility.
    const playoffWeekStart = playoffWeekStartBySeason.get(season) ?? Infinity;
    const regularSeasonPerformances = seasonPerformances.filter((p) => p.week < playoffWeekStart);
    const lowestWeek = regularSeasonPerformances.reduce<OwnerWeeklyPerformance | null>(
      (lowest, p) => (!lowest || p.teamScore < lowest.teamScore ? p : lowest),
      null
    );

    // Longest losing streak that season, per owner, then the max across owners.
    const byOwner = new Map<string, OwnerWeeklyPerformance[]>();
    for (const p of seasonPerformances) {
      if (!p.ownerId) continue;
      const list = byOwner.get(p.ownerId) ?? [];
      list.push(p);
      byOwner.set(p.ownerId, list);
    }
    let longestStreak: SeasonShame["longestLosingStreak"] = null;
    for (const [ownerId, games] of byOwner) {
      const best = computeLongestStreak(games, "loss");
      if (best > 0 && (!longestStreak || best > longestStreak.length)) {
        longestStreak = { ownerId, ownerName: games[0].ownerName, length: best };
      }
    }

    return {
      season,
      lastPlaceOwnerId: lastPlace?.ownerId ?? null,
      lastPlaceOwnerName: lastPlace?.ownerName ?? null,
      worstRecordWins: lastPlace?.wins ?? null,
      worstRecordLosses: lastPlace?.losses ?? null,
      lowestSeasonPointsOwnerId: lowestPoints?.ownerId ?? null,
      lowestSeasonPointsOwnerName: lowestPoints?.ownerName ?? null,
      lowestSeasonPoints: lowestPoints?.pointsFor ?? null,
      lowestWeeklyScore: lowestWeek
        ? {
            ownerId: lowestWeek.ownerId,
            ownerName: lowestWeek.ownerName,
            week: lowestWeek.week,
            score: lowestWeek.teamScore,
          }
        : null,
      longestLosingStreak: longestStreak,
    };
  });
}

export type LeagueRecords = {
  highestWeeklyScore: { ownerId: string | null; ownerName: string | null; season: number; week: number; score: number } | null;
  lowestWeeklyScore: { ownerId: string | null; ownerName: string | null; season: number; week: number; score: number } | null;
  highestSeasonScore: { ownerId: string; ownerName: string | null; season: number; points: number } | null;
  lowestSeasonScore: { ownerId: string; ownerName: string | null; season: number; points: number } | null;
  mostChampionships: { ownerId: string; ownerName: string | null; count: number } | null;
  mostFinalsAppearances: { ownerId: string; ownerName: string | null; count: number } | null;
  mostPlayoffAppearances: { ownerId: string; ownerName: string | null; count: number } | null;
  largestBlowout: { season: number; week: number; winnerOwnerName: string | null; margin: number } | null;
  closestVictory: { season: number; week: number; winnerOwnerName: string | null; margin: number } | null;
  mostTrades: OwnerTransactionStats | null;
  mostWaiverClaims: OwnerTransactionStats | null;
  mostFaabSpent: OwnerTransactionStats | null;
  highestAuctionPurchase: AuctionPurchase | null;
};

export function computeLeagueRecords(
  performances: OwnerWeeklyPerformance[],
  playoffResults: OwnerPlayoffResult[],
  transactionStats: Map<string, OwnerTransactionStats>,
  auctionPurchases: AuctionPurchase[],
  playoffWeekStartBySeason: Map<number, number>,
  playoffTeamsBySeason: Map<number, number>
): LeagueRecords {
  const highestWeek = performances.reduce<OwnerWeeklyPerformance | null>(
    (highest, p) => (!highest || p.teamScore > highest.teamScore ? p : highest),
    null
  );
  // Regular season only — see the identical reasoning in computeWallOfShame:
  // a resting/depleted roster in a meaningless playoff week shouldn't be
  // able to set the league's all-time "lowest score" record.
  const regularSeasonPerformances = performances.filter(
    (p) => p.week < (playoffWeekStartBySeason.get(p.season) ?? Infinity)
  );
  const lowestWeek = regularSeasonPerformances.reduce<OwnerWeeklyPerformance | null>(
    (lowest, p) => (!lowest || p.teamScore < lowest.teamScore ? p : lowest),
    null
  );

  const seasonTotals = new Map<string, { ownerId: string; ownerName: string | null; season: number; points: number }>();
  for (const p of performances) {
    if (!p.ownerId) continue;
    const key = `${p.season}:${p.ownerId}`;
    const existing = seasonTotals.get(key) ?? {
      ownerId: p.ownerId,
      ownerName: p.ownerName,
      season: p.season,
      points: 0,
    };
    existing.points += p.teamScore;
    seasonTotals.set(key, existing);
  }
  const seasonTotalsList = [...seasonTotals.values()];
  const highestSeason = seasonTotalsList.reduce<(typeof seasonTotalsList)[number] | null>(
    (highest, s) => (!highest || s.points > highest.points ? s : highest),
    null
  );
  const lowestSeason = seasonTotalsList.reduce<(typeof seasonTotalsList)[number] | null>(
    (lowest, s) => (!lowest || s.points < lowest.points ? s : lowest),
    null
  );

  function topPlacementCounter(matchesPlace: (place: number) => boolean) {
    const counts = new Map<string, { ownerId: string; ownerName: string | null; count: number }>();
    for (const result of playoffResults) {
      if (!result.ownerId || !matchesPlace(result.place)) continue;
      const existing = counts.get(result.ownerId) ?? {
        ownerId: result.ownerId,
        ownerName: result.ownerName,
        count: 0,
      };
      existing.count += 1;
      counts.set(result.ownerId, existing);
    }
    return [...counts.values()].reduce<{ ownerId: string; ownerName: string | null; count: number } | null>(
      (best, c) => (!best || c.count > best.count ? c : best),
      null
    );
  }

  // "Made the playoffs" that season, not any specific finish — place is
  // an absolute 1..10 league placement (see PlayoffResult's doc comment),
  // and only the top playoffTeams of those actually qualified for the
  // winners bracket rather than starting straight in the consolation one.
  function topPlayoffAppearanceCounter() {
    const counts = new Map<string, { ownerId: string; ownerName: string | null; count: number }>();
    for (const result of playoffResults) {
      if (!result.ownerId) continue;
      const playoffTeams = playoffTeamsBySeason.get(result.season) ?? 6;
      if (result.place > playoffTeams) continue;
      const existing = counts.get(result.ownerId) ?? {
        ownerId: result.ownerId,
        ownerName: result.ownerName,
        count: 0,
      };
      existing.count += 1;
      counts.set(result.ownerId, existing);
    }
    return [...counts.values()].reduce<{ ownerId: string; ownerName: string | null; count: number } | null>(
      (best, c) => (!best || c.count > best.count ? c : best),
      null
    );
  }

  // Excludes resultManuallyCorrected rows — a corrected win/loss has a
  // real, honest outcome but no real corresponding score (see
  // historicalResultCorrections.ts), so a "win" that still shows the
  // opponent's real, higher score would otherwise turn into a nonsensical
  // negative "blowout."
  const winningResults = performances.filter(
    (p) => p.result === "win" && p.opponentScore !== null && !p.resultManuallyCorrected
  );
  const largestBlowout = winningResults.reduce<OwnerWeeklyPerformance | null>(
    (biggest, p) =>
      !biggest || p.teamScore - p.opponentScore! > biggest.teamScore - biggest.opponentScore!
        ? p
        : biggest,
    null
  );
  const closestVictory = winningResults.reduce<OwnerWeeklyPerformance | null>(
    (closest, p) =>
      !closest || p.teamScore - p.opponentScore! < closest.teamScore - closest.opponentScore!
        ? p
        : closest,
    null
  );

  const statsList = [...transactionStats.values()];
  const mostTrades = statsList.reduce<OwnerTransactionStats | null>(
    (best, s) => (!best || s.trades > best.trades ? s : best),
    null
  );
  const mostWaiverClaims = statsList.reduce<OwnerTransactionStats | null>(
    (best, s) => (!best || s.waiverClaims > best.waiverClaims ? s : best),
    null
  );
  const mostFaabSpent = statsList.reduce<OwnerTransactionStats | null>(
    (best, s) => (!best || s.faabSpent > best.faabSpent ? s : best),
    null
  );
  const highestAuctionPurchase = auctionPurchases.reduce<AuctionPurchase | null>(
    (best, a) => (!best || a.price > best.price ? a : best),
    null
  );

  return {
    highestWeeklyScore: highestWeek
      ? {
          ownerId: highestWeek.ownerId,
          ownerName: highestWeek.ownerName,
          season: highestWeek.season,
          week: highestWeek.week,
          score: highestWeek.teamScore,
        }
      : null,
    lowestWeeklyScore: lowestWeek
      ? {
          ownerId: lowestWeek.ownerId,
          ownerName: lowestWeek.ownerName,
          season: lowestWeek.season,
          week: lowestWeek.week,
          score: lowestWeek.teamScore,
        }
      : null,
    highestSeasonScore: highestSeason,
    lowestSeasonScore: lowestSeason,
    mostChampionships: topPlacementCounter((place) => place === 1),
    mostFinalsAppearances: topPlacementCounter((place) => place === 1 || place === 2),
    mostPlayoffAppearances: topPlayoffAppearanceCounter(),
    largestBlowout: largestBlowout
      ? {
          season: largestBlowout.season,
          week: largestBlowout.week,
          winnerOwnerName: largestBlowout.ownerName,
          margin: largestBlowout.teamScore - largestBlowout.opponentScore!,
        }
      : null,
    closestVictory: closestVictory
      ? {
          season: closestVictory.season,
          week: closestVictory.week,
          winnerOwnerName: closestVictory.ownerName,
          margin: closestVictory.teamScore - closestVictory.opponentScore!,
        }
      : null,
    mostTrades,
    mostWaiverClaims,
    mostFaabSpent,
    highestAuctionPurchase,
  };
}

export type LeagueHistory = {
  wallOfChampions: SeasonChampionship[];
  wallOfShame: SeasonShame[];
  records: LeagueRecords;
};

/**
 * Fetches everything once (weekly performances, standings, playoff
 * results, transaction history) and computes every League History
 * section the brief asks for. No database exists yet — this is the live
 * equivalent, same pattern as every other cross-season service this
 * session.
 */
export async function getLeagueHistory(): Promise<LeagueHistory> {
  const [performances, playoffResults, transactionHistory, seasonSettings] =
    await Promise.all([
      getAllWeeklyPerformances(),
      getAllPlayoffResults(),
      getTransactionHistory(),
      getSeasonSettingsBySeason(),
    ]);

  const standings = await getSeasonStandings(performances);

  return {
    wallOfChampions: computeWallOfChampions(playoffResults, standings),
    wallOfShame: computeWallOfShame(
      performances,
      standings,
      seasonSettings.playoffWeekStartBySeason
    ),
    records: computeLeagueRecords(
      performances,
      playoffResults,
      transactionHistory.statsByOwnerId,
      transactionHistory.auctionPurchases,
      seasonSettings.playoffWeekStartBySeason,
      seasonSettings.playoffTeamsBySeason
    ),
  };
}
