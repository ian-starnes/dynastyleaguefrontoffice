import { getLeagueSeasonChain, getOwners, getSleeperLeagueId } from "@/lib/sleeper";
import {
  getAllWeeklyPerformances,
  computeLongestStreak,
  getCareerStatsByOwner,
} from "./weeklyPerformanceService";
import { getAllPlayoffResults } from "./playoffResultsService";
import { getTransactionHistory } from "./transactionHistoryService";
import { FranchiseValueService } from "./franchiseValueService";
import { getFranchiseIdentityMap } from "./franchiseIdentityService";
import { getRingOfHonor, type RingOfHonorEntry } from "./ringOfHonorService";

/** Ring of Honor "headliner" qualifying thresholds — a real sample-size floor so a single hot week doesn't crown a headliner off a handful of starts. */
const RING_OF_HONOR_HEADLINER_MIN_STARTS = 20;
const RING_OF_HONOR_HEADLINER_MIN_POINTS = 200;

export type ManagerProfile = {
  ownerId: string;
  displayName: string;
  teamName: string | null;
  /** Real, user-uploaded avatar image URL — null if they never set one. Never fabricated. */
  avatarUrl: string | null;
  /**
   * Earliest season THIS FRANCHISE has existed in the league — i.e. when
   * the roster this manager now runs first appeared, not necessarily when
   * this specific Sleeper account joined. A manager who took over an
   * existing team via a real manager succession (see
   * franchiseIdentityService.ts) inherits its founding season, per "team
   * history travels with the team."
   */
  memberSinceSeason: number;
  championships: number;
  runnerUps: number;
  thirdPlaceFinishes: number;
  /** Lowest (best) final place ever achieved; null if they have no playoff-result history. */
  bestFinish: number | null;
  averageFinish: number | null;
  allTimeWins: number;
  allTimeLosses: number;
  allTimeTies: number;
  winningPercentage: number;
  playoffWins: number;
  playoffLosses: number;
  playoffTies: number;
  averagePointsPerWeekAllTime: number;
  highestScoringWeekAllTime: { season: number; week: number; points: number } | null;
  highestScoringPlayerEver: { playerId: string; points: number; season: number; week: number } | null;
  careerPointsFor: number;
  careerPointsAgainst: number;
  longestWinningStreak: number;
  longestLosingStreak: number;
  totalTrades: number;
  totalWaiverClaims: number;
  totalFaabSpent: number;
  /** Null if this owner no longer holds a roster in the current season (e.g. left the league). */
  currentFranchiseValue: number | null;
  /**
   * This franchise's best qualifying Ring of Honor entry — the
   * highest-total-points player among those started at least
   * RING_OF_HONOR_HEADLINER_MIN_STARTS times with at least
   * RING_OF_HONOR_HEADLINER_MIN_POINTS while on this roster. Null if no
   * player meets both thresholds yet (a young or small-sample franchise).
   */
  ringOfHonorHeadliner: {
    playerId: string;
    totalStartingLineupPoints: number;
    gamesStarted: number;
  } | null;
  /** 1 = highest career points-for among every current manager. */
  careerPointsForRank: number;
  /** 1 = highest all-time win percentage among every current manager. */
  winningPercentageRank: number;
  /** How many current managers these two ranks are out of. */
  totalManagers: number;
};

/**
 * Every field the brief's Manager Profiles section asks for EXCEPT phone
 * number and location — confirmed unavailable via the Phase 1 API audit
 * (checked the full Sleeper user object and its metadata; neither field
 * exists anywhere in the API). Those would need a separate, manually-
 * maintained DLFO data store, which is a product decision, not something
 * this function can source. Deliberately omitted rather than left as an
 * always-null field that looks like a bug.
 */
export async function getManagerProfiles(): Promise<Map<string, ManagerProfile>> {
  const rootLeagueId = getSleeperLeagueId();
  const fullChain = await getLeagueSeasonChain(rootLeagueId);

  const [performances, playoffResults, transactionHistory, currentOwners, franchiseValuations, franchiseIdentity] =
    await Promise.all([
      getAllWeeklyPerformances(),
      getAllPlayoffResults(),
      getTransactionHistory(),
      getOwners(),
      new FranchiseValueService().getFranchiseValuations(),
      getFranchiseIdentityMap(),
    ]);
  // Reuses the performances/playoffResults already fetched above rather
  // than letting getRingOfHonor() re-fetch and recompute them itself.
  const ringOfHonor = await getRingOfHonor({ performances, playoffResults });

  const playoffWeekStartBySeason = new Map<number, number>();
  for (const league of fullChain) {
    playoffWeekStartBySeason.set(
      Number(league.season),
      Number(league.settings.playoff_week_start ?? 15)
    );
  }

  const careerStats = getCareerStatsByOwner(performances);
  const franchiseValueByOwnerId = new Map(
    franchiseValuations.map((v) => [v.ownerId, v.franchiseValue])
  );

  const performancesByOwnerId = new Map<string, typeof performances>();
  for (const performance of performances) {
    if (!performance.ownerId) continue;
    const list = performancesByOwnerId.get(performance.ownerId) ?? [];
    list.push(performance);
    performancesByOwnerId.set(performance.ownerId, list);
  }

  // ringOfHonor is already sorted highest-total-points first, so the
  // first qualifying entry seen per owner is that franchise's headliner.
  const ringOfHonorHeadlinerByOwnerId = new Map<string, RingOfHonorEntry>();
  for (const entry of ringOfHonor) {
    if (
      entry.gamesStarted < RING_OF_HONOR_HEADLINER_MIN_STARTS ||
      entry.totalStartingLineupPoints < RING_OF_HONOR_HEADLINER_MIN_POINTS
    ) {
      continue;
    }
    if (!ringOfHonorHeadlinerByOwnerId.has(entry.ownerId)) {
      ringOfHonorHeadlinerByOwnerId.set(entry.ownerId, entry);
    }
  }

  const profiles = new Map<string, ManagerProfile>();

  for (const owner of currentOwners) {
    const ownerId = owner.user_id;
    const ownerPerformances = performancesByOwnerId.get(ownerId) ?? [];
    const stats = careerStats.get(ownerId);

    const playoffGames = ownerPerformances.filter(
      (p) => p.week >= (playoffWeekStartBySeason.get(p.season) ?? Infinity)
    );
    const playoffWins = playoffGames.filter((p) => p.result === "win").length;
    const playoffLosses = playoffGames.filter((p) => p.result === "loss").length;
    const playoffTies = playoffGames.filter((p) => p.result === "tie").length;

    const ownerPlayoffResults = playoffResults.filter((r) => r.ownerId === ownerId);
    const finishes = ownerPlayoffResults.map((r) => r.place);
    const bestFinish = finishes.length > 0 ? Math.min(...finishes) : null;
    const averageFinish =
      finishes.length > 0 ? finishes.reduce((sum, f) => sum + f, 0) / finishes.length : null;

    let highestScoringWeek: ManagerProfile["highestScoringWeekAllTime"] = null;
    let highestScoringPlayer: ManagerProfile["highestScoringPlayerEver"] = null;
    for (const performance of ownerPerformances) {
      if (!highestScoringWeek || performance.teamScore > highestScoringWeek.points) {
        highestScoringWeek = {
          season: performance.season,
          week: performance.week,
          points: performance.teamScore,
        };
      }
      for (const playerId of performance.starterPlayerIds) {
        const points = performance.pointsByPlayerId[playerId];
        if (points === undefined) continue;
        if (!highestScoringPlayer || points > highestScoringPlayer.points) {
          highestScoringPlayer = {
            playerId,
            points,
            season: performance.season,
            week: performance.week,
          };
        }
      }
    }

    const txStats = transactionHistory.statsByOwnerId.get(ownerId);
    const wins = stats?.wins ?? 0;
    const losses = stats?.losses ?? 0;
    const ties = stats?.ties ?? 0;
    const totalGames = wins + losses + ties;

    const headliner = ringOfHonorHeadlinerByOwnerId.get(ownerId) ?? null;

    profiles.set(ownerId, {
      ownerId,
      displayName: owner.display_name,
      teamName: owner.metadata?.team_name ?? null,
      avatarUrl: owner.metadata?.avatar ?? null,
      memberSinceSeason:
        franchiseIdentity.franchiseFoundedSeason.get(ownerId) ??
        Number(fullChain[fullChain.length - 1].season),
      championships: ownerPlayoffResults.filter((r) => r.place === 1).length,
      runnerUps: ownerPlayoffResults.filter((r) => r.place === 2).length,
      thirdPlaceFinishes: ownerPlayoffResults.filter((r) => r.place === 3).length,
      bestFinish,
      averageFinish,
      allTimeWins: wins,
      allTimeLosses: losses,
      allTimeTies: ties,
      winningPercentage: totalGames > 0 ? wins / totalGames : 0,
      playoffWins,
      playoffLosses,
      playoffTies,
      averagePointsPerWeekAllTime: stats?.averagePointsPerWeek ?? 0,
      highestScoringWeekAllTime: highestScoringWeek,
      highestScoringPlayerEver: highestScoringPlayer,
      careerPointsFor: stats?.pointsFor ?? 0,
      careerPointsAgainst: stats?.pointsAgainst ?? 0,
      longestWinningStreak: computeLongestStreak(ownerPerformances, "win"),
      longestLosingStreak: computeLongestStreak(ownerPerformances, "loss"),
      totalTrades: txStats?.trades ?? 0,
      totalWaiverClaims: txStats?.waiverClaims ?? 0,
      totalFaabSpent: txStats?.faabSpent ?? 0,
      currentFranchiseValue: franchiseValueByOwnerId.get(ownerId) ?? null,
      ringOfHonorHeadliner: headliner
        ? {
            playerId: headliner.playerId,
            totalStartingLineupPoints: headliner.totalStartingLineupPoints,
            gamesStarted: headliner.gamesStarted,
          }
        : null,
      // Ranks filled in below, once every profile exists to rank against.
      careerPointsForRank: 0,
      winningPercentageRank: 0,
      totalManagers: currentOwners.length,
    });
  }

  const allProfiles = [...profiles.values()];
  const byCareerPointsFor = [...allProfiles].sort((a, b) => b.careerPointsFor - a.careerPointsFor);
  byCareerPointsFor.forEach((profile, index) => {
    profiles.get(profile.ownerId)!.careerPointsForRank = index + 1;
  });
  const byWinningPercentage = [...allProfiles].sort(
    (a, b) => b.winningPercentage - a.winningPercentage
  );
  byWinningPercentage.forEach((profile, index) => {
    profiles.get(profile.ownerId)!.winningPercentageRank = index + 1;
  });

  return profiles;
}
