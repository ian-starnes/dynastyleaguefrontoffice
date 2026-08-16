import { getLeagueSeasonChain, getOwnersForLeague, getOwners, getSleeperLeagueId } from "@/lib/sleeper";
import {
  getAllWeeklyPerformances,
  computeLongestStreak,
  getCareerStatsByOwner,
} from "./weeklyPerformanceService";
import { getAllPlayoffResults } from "./playoffResultsService";
import { getTransactionHistory } from "./transactionHistoryService";
import { FranchiseValueService } from "./franchiseValueService";

export type ManagerProfile = {
  ownerId: string;
  displayName: string;
  teamName: string | null;
  /** Real, user-uploaded avatar image URL — null if they never set one. Never fabricated. */
  avatarUrl: string | null;
  /** Earliest season this owner_id appears in the league — "member of THIS league since," not a Sleeper-platform account date (which Sleeper doesn't expose). */
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

  const [performances, playoffResults, transactionHistory, currentOwners, franchiseValuations] =
    await Promise.all([
      getAllWeeklyPerformances(),
      getAllPlayoffResults(),
      getTransactionHistory(),
      getOwners(),
      new FranchiseValueService().getFranchiseValuations(),
    ]);

  const playoffWeekStartBySeason = new Map<number, number>();
  for (const league of fullChain) {
    playoffWeekStartBySeason.set(
      Number(league.season),
      Number(league.settings.playoff_week_start ?? 15)
    );
  }

  const memberSinceBySeason = new Map<string, number>();
  const seasonsPerOwner = await Promise.all(
    fullChain.map(async (league) => {
      const owners = await getOwnersForLeague(league.league_id);
      return { season: Number(league.season), ownerIds: owners.map((o) => o.user_id) };
    })
  );
  for (const { season, ownerIds } of seasonsPerOwner) {
    for (const ownerId of ownerIds) {
      const existing = memberSinceBySeason.get(ownerId);
      if (existing === undefined || season < existing) {
        memberSinceBySeason.set(ownerId, season);
      }
    }
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

    profiles.set(ownerId, {
      ownerId,
      displayName: owner.display_name,
      teamName: owner.metadata?.team_name ?? null,
      avatarUrl: owner.metadata?.avatar ?? null,
      memberSinceSeason: memberSinceBySeason.get(ownerId) ?? Number(fullChain[fullChain.length - 1].season),
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
    });
  }

  return profiles;
}
