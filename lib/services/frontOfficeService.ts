import { getLeague, getAllTransactions, getOwners, getRosters } from "@/lib/sleeper";
import { getLeaguePlayers, type LeaguePlayer } from "@/lib/league-players";
import { FranchiseValueService } from "./franchiseValueService";
import { getProjectedAuctionBudgets } from "./futurePicksService";
import { getAllWeeklyPerformances } from "./weeklyPerformanceService";
import { getSeasonStandings } from "./seasonStandingsService";

export type RecentMovement = {
  transactionId: string;
  type: string;
  createdAt: number;
  summary: string;
};

export type FrontOfficeSummary = {
  ownerId: string;
  ownerName: string | null;
  franchiseValue: number;
  franchiseValueRank: number;
  totalFranchises: number;
  currentSeasonRank: number | null;
  rosterMarketValue: number;
  futurePickValue: number;
  /** The brief asks for the next 3 years specifically (e.g. 2027/2028/2029 from a 2026 current season). */
  projectedAuctionBudgetBySeason: { season: number; value: number }[];
  totalKeeperSurplus: number;
  expiringContracts: LeaguePlayer[];
  mostValuableAssets: LeaguePlayer[];
  recentMovement: RecentMovement[];
  leagueActivity: RecentMovement[];
};

/**
 * Everything DLFO's Front Office landing page needs for "my" franchise —
 * composes the engines built in Phases 6/7 rather than computing
 * anything new. No championship odds, no NFL schedule/next-game info,
 * per the brief's explicit exclusions for this page.
 */
export async function getFrontOfficeSummary(
  ownerId: string
): Promise<FrontOfficeSummary | null> {
  const [league, players, valuations, projectedBudgets, performances, currentTransactions, owners, rosters] =
    await Promise.all([
      getLeague(),
      getLeaguePlayers(),
      new FranchiseValueService().getFranchiseValuations(),
      getProjectedAuctionBudgets(),
      getAllWeeklyPerformances(),
      getAllTransactions().catch((error: unknown) => {
        console.error("Current-season transactions fetch failed for Front Office:", error);
        return [];
      }),
      getOwners(),
      getRosters(),
    ]);

  const myValuation = valuations.find((v) => v.ownerId === ownerId);
  if (!myValuation) return null;

  const currentSeason = Number(league.season);
  const standings = await getSeasonStandings(performances);
  const myStanding = standings.find(
    (s) => s.season === currentSeason && s.ownerId === ownerId
  );

  const myRosterId = rosters.find((r) => r.owner_id === ownerId)?.roster_id;
  const myRoster = players.filter((p) => p.currentOwnerId === ownerId);

  const totalKeeperSurplus = myRoster.reduce(
    (sum, p) => sum + (p.keeperSurplus ?? 0),
    0
  );

  const expiringContracts = [...myRoster]
    .filter((p) => p.keeperYearsRemaining <= 1)
    .sort((a, b) => (b.assetValue ?? 0) - (a.assetValue ?? 0));

  const mostValuableAssets = [...myRoster]
    .filter((p) => p.assetValue !== null)
    .sort((a, b) => (b.assetValue ?? 0) - (a.assetValue ?? 0))
    .slice(0, 5);

  const myBudgetBySeason = new Map(
    projectedBudgets.filter((b) => b.ownerId === ownerId).map((b) => [b.season, b.budget])
  );
  const projectedAuctionBudgetBySeason = [
    currentSeason + 1,
    currentSeason + 2,
    currentSeason + 3,
  ].map((season) => ({
    season,
    value: myBudgetBySeason.get(season) ?? 0,
  }));

  const ownerNameByOwnerId = new Map(
    owners.map((owner) => [owner.user_id, owner.metadata?.team_name ?? owner.display_name])
  );
  const ownerIdByRosterId = new Map(rosters.map((r) => [r.roster_id, r.owner_id]));

  function describeTransaction(transaction: (typeof currentTransactions)[number]): string {
    const addedCount = Object.keys(transaction.adds ?? {}).length;
    const droppedCount = Object.keys(transaction.drops ?? {}).length;
    const parts: string[] = [];
    if (addedCount > 0) parts.push(`added ${addedCount} player${addedCount > 1 ? "s" : ""}`);
    if (droppedCount > 0) parts.push(`dropped ${droppedCount} player${droppedCount > 1 ? "s" : ""}`);
    return parts.length > 0 ? parts.join(", ") : transaction.type;
  }

  const completedTransactions = currentTransactions
    .filter((t) => t.status === "complete")
    .sort((a, b) => b.created - a.created);

  const recentMovement: RecentMovement[] = completedTransactions
    .filter((t) => myRosterId !== undefined && t.roster_ids.includes(myRosterId))
    .slice(0, 8)
    .map((t) => ({
      transactionId: t.transaction_id,
      type: t.type,
      createdAt: t.created,
      summary: describeTransaction(t),
    }));

  const leagueActivity: RecentMovement[] = completedTransactions.slice(0, 8).map((t) => {
    const teamNames = t.roster_ids
      .map((rosterId) => {
        const rosterOwnerId = ownerIdByRosterId.get(rosterId);
        return rosterOwnerId ? ownerNameByOwnerId.get(rosterOwnerId) ?? "Unknown" : "Unknown";
      })
      .join(" / ");
    return {
      transactionId: t.transaction_id,
      type: t.type,
      createdAt: t.created,
      summary: `${teamNames}: ${describeTransaction(t)}`,
    };
  });

  return {
    ownerId,
    ownerName: myValuation.ownerName,
    franchiseValue: myValuation.franchiseValue,
    franchiseValueRank: myValuation.rank,
    totalFranchises: valuations.length,
    currentSeasonRank: myStanding?.rank ?? null,
    rosterMarketValue: myValuation.rosterMarketValue,
    futurePickValue: myValuation.futurePickValue,
    projectedAuctionBudgetBySeason,
    totalKeeperSurplus,
    expiringContracts,
    mostValuableAssets,
    recentMovement,
    leagueActivity,
  };
}
