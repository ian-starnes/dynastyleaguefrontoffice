import { getLeagueSeasonChain, getSleeperLeagueId } from "@/lib/sleeper";
import type { OwnerWeeklyPerformance } from "./weeklyPerformanceService";

export type OwnerSeasonStanding = {
  season: number;
  ownerId: string;
  ownerName: string | null;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  /** 1 = best regular-season record that season. */
  rank: number;
};

/**
 * Regular-season-only standings, per season — deliberately NOT the same
 * as a completed roster's cumulative Sleeper record, which includes
 * playoff weeks too. Needed for two things the brief is explicit about:
 * Wall of Shame's "10th place at the START of playoffs" (the worst rank
 * here, not the eventual consolation-bracket finish) and Wall of
 * Champions' "regular season champion" (rank 1 here, which may differ
 * from who actually won the title).
 *
 * Takes performances already fetched by getAllWeeklyPerformances() rather
 * than re-fetching — this only adds one small call per season (the
 * league settings, for playoff_week_start) on top of that.
 */
export async function getSeasonStandings(
  performances: OwnerWeeklyPerformance[]
): Promise<OwnerSeasonStanding[]> {
  const fullChain = await getLeagueSeasonChain(getSleeperLeagueId());

  const playoffWeekStartBySeason = new Map<number, number>();
  for (const league of fullChain) {
    playoffWeekStartBySeason.set(
      Number(league.season),
      Number(league.settings.playoff_week_start ?? 15)
    );
  }

  type Accumulator = {
    ownerId: string;
    ownerName: string | null;
    wins: number;
    losses: number;
    ties: number;
    pointsFor: number;
  };
  const bySeasonOwner = new Map<string, Accumulator>();

  for (const performance of performances) {
    if (!performance.ownerId) continue;
    const playoffWeekStart = playoffWeekStartBySeason.get(performance.season);
    if (playoffWeekStart === undefined || performance.week >= playoffWeekStart) continue;

    const key = `${performance.season}:${performance.ownerId}`;
    const existing = bySeasonOwner.get(key) ?? {
      ownerId: performance.ownerId,
      ownerName: performance.ownerName,
      wins: 0,
      losses: 0,
      ties: 0,
      pointsFor: 0,
    };

    existing.pointsFor += performance.teamScore;
    if (performance.result === "win") existing.wins += 1;
    else if (performance.result === "loss") existing.losses += 1;
    else if (performance.result === "tie") existing.ties += 1;

    bySeasonOwner.set(key, existing);
  }

  const bySeasonList = new Map<number, Accumulator[]>();
  for (const [key, value] of bySeasonOwner) {
    const season = Number(key.split(":")[0]);
    const list = bySeasonList.get(season) ?? [];
    list.push(value);
    bySeasonList.set(season, list);
  }

  const standings: OwnerSeasonStanding[] = [];
  for (const [season, owners] of bySeasonList) {
    const sorted = [...owners].sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      return b.pointsFor - a.pointsFor;
    });
    sorted.forEach((owner, index) => {
      standings.push({ season, ...owner, rank: index + 1 });
    });
  }

  return standings;
}
