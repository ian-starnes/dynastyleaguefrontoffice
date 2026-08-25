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

async function getPlayoffWeekStartBySeason(): Promise<Map<number, number>> {
  const fullChain = await getLeagueSeasonChain(getSleeperLeagueId());
  const map = new Map<number, number>();
  for (const league of fullChain) {
    map.set(Number(league.season), Number(league.settings.playoff_week_start ?? 15));
  }
  return map;
}

export type HeadToHead = {
  ownerAId: string;
  ownerAName: string | null;
  ownerBId: string;
  ownerBName: string | null;
  ownerAWins: number;
  ownerBWins: number;
  ties: number;
  regularSeason: { ownerAWins: number; ownerBWins: number; ties: number };
  playoffs: { ownerAWins: number; ownerBWins: number; ties: number };
  averageMargin: number; // from owner A's perspective — positive means A tends to win by more
  biggestWin: { season: number; week: number; margin: number } | null; // A's biggest margin of victory
  biggestLoss: { season: number; week: number; margin: number } | null; // A's biggest margin of defeat
  highestCombinedScore: { season: number; week: number; total: number } | null;
  /** Most recent first. */
  last10Meetings: { season: number; week: number; ownerAScore: number; ownerBScore: number; winner: "A" | "B" | "tie" }[];
  currentStreak: { owner: "A" | "B" | "tie"; length: number } | null;
  ownerACareerPointsFor: number;
  ownerACareerPointsAgainst: number;
};

/**
 * Every owner pair that has ever played each other, with the full
 * record the brief's All-Time Head-to-Head section asks for. Built from
 * one owner's perspective per pair (ownerAId < ownerBId alphabetically)
 * — each real meeting already appears twice in getAllWeeklyPerformances
 * (once from each side), so this reads only the ownerA-perspective rows
 * for a pair, never double-counts.
 */
export function computeHeadToHead(
  performances: OwnerWeeklyPerformance[],
  playoffWeekStartBySeason: Map<number, number>
): HeadToHead[] {
  const meetingsByPairKey = new Map<
    string,
    { ownerAId: string; ownerBId: string; games: OwnerWeeklyPerformance[] }
  >();

  for (const performance of performances) {
    if (!performance.ownerId || !performance.opponentOwnerId) continue;
    if (performance.opponentScore === null) continue;

    const [ownerAId, ownerBId] =
      performance.ownerId < performance.opponentOwnerId
        ? [performance.ownerId, performance.opponentOwnerId]
        : [performance.opponentOwnerId, performance.ownerId];

    // Only accumulate from the perspective where performance.ownerId === ownerAId,
    // so each real meeting is counted exactly once.
    if (performance.ownerId !== ownerAId) continue;

    const key = `${ownerAId}:${ownerBId}`;
    const existing = meetingsByPairKey.get(key) ?? { ownerAId, ownerBId, games: [] };
    existing.games.push(performance);
    meetingsByPairKey.set(key, existing);
  }

  const results: HeadToHead[] = [];

  for (const { ownerAId, ownerBId, games } of meetingsByPairKey.values()) {
    const sorted = [...games].sort((a, b) => a.season - b.season || a.week - b.week);

    let ownerAWins = 0;
    let ownerBWins = 0;
    let ties = 0;
    let regularAWins = 0,
      regularBWins = 0,
      regularTies = 0;
    let playoffAWins = 0,
      playoffBWins = 0,
      playoffTies = 0;
    let marginSum = 0;
    let biggestWin: HeadToHead["biggestWin"] = null;
    let biggestLoss: HeadToHead["biggestLoss"] = null;
    let highestCombined: HeadToHead["highestCombinedScore"] = null;
    let careerPointsFor = 0;
    let careerPointsAgainst = 0;

    // Games flagged resultManuallyCorrected (see historicalResultCorrections.ts)
    // have a real, honest win/loss outcome but NOT a real corresponding
    // score — the winner is confirmed, no corrected score was ever
    // fabricated to match. Every margin-derived figure below (average
    // margin, biggest win/loss) has to skip those rows, or a "win" that
    // still shows the opponent's real, higher score turns into a
    // nonsensical negative "blowout." Win/loss counts and points for/
    // against are unaffected — those are correct either way.
    let marginSampleCount = 0;

    for (const game of sorted) {
      const margin = game.teamScore - game.opponentScore!;
      careerPointsFor += game.teamScore;
      careerPointsAgainst += game.opponentScore!;

      const isPlayoff =
        game.week >= (playoffWeekStartBySeason.get(game.season) ?? Infinity);

      if (game.result === "win") {
        ownerAWins++;
        if (isPlayoff) playoffAWins++;
        else regularAWins++;
        if (!game.resultManuallyCorrected) {
          marginSum += margin;
          marginSampleCount++;
          if (!biggestWin || margin > biggestWin.margin) {
            biggestWin = { season: game.season, week: game.week, margin };
          }
        }
      } else if (game.result === "loss") {
        ownerBWins++;
        if (isPlayoff) playoffBWins++;
        else regularBWins++;
        if (!game.resultManuallyCorrected) {
          marginSum += margin;
          marginSampleCount++;
          if (!biggestLoss || margin < biggestLoss.margin) {
            biggestLoss = { season: game.season, week: game.week, margin };
          }
        }
      } else {
        ties++;
        if (isPlayoff) playoffTies++;
        else regularTies++;
        marginSum += margin; // always 0 for a tie — harmless either way
        marginSampleCount++;
      }

      const combined = game.teamScore + game.opponentScore!;
      if (!highestCombined || combined > highestCombined.total) {
        highestCombined = { season: game.season, week: game.week, total: combined };
      }
    }

    const last10 = sorted.slice(-10).reverse().map((game) => ({
      season: game.season,
      week: game.week,
      ownerAScore: game.teamScore,
      ownerBScore: game.opponentScore!,
      winner: (game.result === "win" ? "A" : game.result === "loss" ? "B" : "tie") as
        | "A"
        | "B"
        | "tie",
    }));

    let currentStreak: HeadToHead["currentStreak"] = null;
    for (const meeting of last10) {
      if (!currentStreak) {
        currentStreak = { owner: meeting.winner, length: 1 };
      } else if (currentStreak.owner === meeting.winner) {
        currentStreak.length++;
      } else {
        break;
      }
    }

    results.push({
      ownerAId,
      ownerAName: sorted[0]?.ownerName ?? null,
      ownerBId,
      ownerBName: sorted[0]?.opponentOwnerName ?? null,
      ownerAWins,
      ownerBWins,
      ties,
      regularSeason: { ownerAWins: regularAWins, ownerBWins: regularBWins, ties: regularTies },
      playoffs: { ownerAWins: playoffAWins, ownerBWins: playoffBWins, ties: playoffTies },
      averageMargin: marginSampleCount > 0 ? marginSum / marginSampleCount : 0,
      biggestWin,
      biggestLoss,
      highestCombinedScore: highestCombined,
      last10Meetings: last10,
      currentStreak,
      ownerACareerPointsFor: careerPointsFor,
      ownerACareerPointsAgainst: careerPointsAgainst,
    });
  }

  return results;
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
  standings: OwnerSeasonStanding[]
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
    const lowestWeek = seasonPerformances.reduce<OwnerWeeklyPerformance | null>(
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
  mostThirdPlaceFinishes: { ownerId: string; ownerName: string | null; count: number } | null;
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
  auctionPurchases: AuctionPurchase[]
): LeagueRecords {
  const highestWeek = performances.reduce<OwnerWeeklyPerformance | null>(
    (highest, p) => (!highest || p.teamScore > highest.teamScore ? p : highest),
    null
  );
  const lowestWeek = performances.reduce<OwnerWeeklyPerformance | null>(
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

  // Excludes resultManuallyCorrected rows — see the doc comment in
  // computeHeadToHead for why a corrected win's margin can't be trusted.
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
    mostThirdPlaceFinishes: topPlacementCounter((place) => place === 3),
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
  headToHead: HeadToHead[];
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
  const [performances, playoffResults, transactionHistory, playoffWeekStartBySeason] =
    await Promise.all([
      getAllWeeklyPerformances(),
      getAllPlayoffResults(),
      getTransactionHistory(),
      getPlayoffWeekStartBySeason(),
    ]);

  const standings = await getSeasonStandings(performances);

  return {
    headToHead: computeHeadToHead(performances, playoffWeekStartBySeason),
    wallOfChampions: computeWallOfChampions(playoffResults, standings),
    wallOfShame: computeWallOfShame(performances, standings),
    records: computeLeagueRecords(
      performances,
      playoffResults,
      transactionHistory.statsByOwnerId,
      transactionHistory.auctionPurchases
    ),
  };
}
