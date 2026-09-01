import { getLeaguePlayers, type LeaguePlayer } from "@/lib/league-players";
import { getRosters, getOwners } from "@/lib/sleeper";
import { getProjectedAuctionBudgets } from "./futurePicksService";

export type FranchiseValuation = {
  ownerId: string;
  ownerName: string;
  rosterAssetValue: number;
  futurePickValue: number;
  franchiseValue: number;
  /**
   * 1 = strongest real roster (highest Roster Asset Value) in the league.
   * Deliberately NOT based on franchiseValue — see getFranchiseValuations()
   * for why blending in Future Pick Value would distort this.
   */
  rank: number;
};

export type LeagueEconomicsSummary = {
  /** Ranked by real Roster Asset Value descending — see getFranchiseValuations(). */
  franchises: FranchiseValuation[];
  /** Across every currently-rostered player in the league. */
  averageAssetValue: number;
  /** Summed across every currently-rostered player's Keeper Surplus. */
  totalKeeperSurplus: number;
  largestKeeperSurplus: { player: LeaguePlayer } | null;
  largestContract: { player: LeaguePlayer } | null;
};

/**
 * The shared franchise valuation model. Any future feature that needs
 * "what is this team worth" — trade analyzer, championship odds,
 * contender/rebuilder classification, cap flexibility, age curves, power
 * rankings — should call getFranchiseValuations() directly rather than
 * recomputing roster/pick sums itself, so there's exactly one definition
 * of Franchise Value in the codebase.
 */
export class FranchiseValueService {
  /**
   * Per-franchise valuations, ranked by real Roster Asset Value descending
   * — NOT by the blended franchiseValue total. Future Pick Value is a
   * structural auction-budget number: every owner defaults to the same
   * $200/year, adjusted only by real traded-round credits, so it's
   * inherently near-flat across the whole league (confirmed real spread
   * ~$150) next to Roster Asset Value's real, player-driven spread
   * (confirmed ~$303). Ranking by the summed total let that flat
   * component swamp genuine roster-quality differences — 5 of 10 teams'
   * ranks changed depending on whether picks were included. franchiseValue
   * itself is still computed and shown as an informational total; only
   * what determines `rank` changed.
   */
  async getFranchiseValuations(): Promise<FranchiseValuation[]> {
    const [players, rosters, owners, projectedBudgets] = await Promise.all([
      getLeaguePlayers(),
      getRosters(),
      getOwners(),
      getProjectedAuctionBudgets(),
    ]);

    const ownerNameByUserId = new Map(
      owners.map((owner) => [
        owner.user_id,
        owner.metadata?.team_name ?? owner.display_name,
      ])
    );

    // Total Roster Asset Value: sum of every rostered player's Asset
    // Value, grouped by owner.
    const rosterAssetValueByOwnerId = new Map<string, number>();
    for (const player of players) {
      if (!player.currentOwnerId || player.assetValue === null) continue;
      rosterAssetValueByOwnerId.set(
        player.currentOwnerId,
        (rosterAssetValueByOwnerId.get(player.currentOwnerId) ?? 0) +
          player.assetValue
      );
    }

    // Total Future Pick Value: each projected season defaults to the
    // standard $200 auction budget per owner, adjusted only by real
    // traded-round credits (see getProjectedAuctionBudgets) — not a sum
    // of currently-held pick credits, which would undercount by half
    // for anyone who hasn't traded anything.
    const futurePickValueByOwnerId = new Map<string, number>();
    for (const budget of projectedBudgets) {
      futurePickValueByOwnerId.set(
        budget.ownerId,
        (futurePickValueByOwnerId.get(budget.ownerId) ?? 0) + budget.budget
      );
    }

    return rosters
      .filter((roster): roster is typeof roster & { owner_id: string } =>
        Boolean(roster.owner_id)
      )
      .map((roster) => {
        const ownerId = roster.owner_id;
        const rosterAssetValue = rosterAssetValueByOwnerId.get(ownerId) ?? 0;
        const futurePickValue = futurePickValueByOwnerId.get(ownerId) ?? 0;

        return {
          ownerId,
          ownerName: ownerNameByUserId.get(ownerId) ?? "Unknown",
          rosterAssetValue,
          futurePickValue,
          franchiseValue: rosterAssetValue + futurePickValue,
        };
      })
      .sort((a, b) => b.rosterAssetValue - a.rosterAssetValue)
      .map((valuation, index) => ({ ...valuation, rank: index + 1 }));
  }

  /**
   * Builds on getFranchiseValuations() with the league-wide superlative
   * stats the Front Office dashboard needs. These scope to currently
   * ROSTERED players only — a free agent's placeholder contract isn't a
   * real "contract" to compare against.
   */
  async getLeagueEconomicsSummary(): Promise<LeagueEconomicsSummary> {
    const [franchises, players] = await Promise.all([
      this.getFranchiseValuations(),
      getLeaguePlayers(),
    ]);

    const rosteredPlayers = players.filter(
      (player) => player.currentOwnerId !== null
    );

    const assetValues = rosteredPlayers
      .map((player) => player.assetValue)
      .filter((value): value is number => value !== null);
    const averageAssetValue =
      assetValues.length > 0
        ? assetValues.reduce((sum, value) => sum + value, 0) /
          assetValues.length
        : 0;

    const totalKeeperSurplus = rosteredPlayers.reduce(
      (sum, player) => sum + (player.keeperSurplus ?? 0),
      0
    );

    const rosteredWithSurplus = rosteredPlayers.filter(
      (player): player is LeaguePlayer & { keeperSurplus: number } =>
        player.keeperSurplus !== null
    );
    const largestKeeperSurplusPlayer = [...rosteredWithSurplus].sort(
      (a, b) => b.keeperSurplus - a.keeperSurplus
    )[0];

    const largestContractPlayer = [...rosteredPlayers].sort(
      (a, b) => b.keeperCost - a.keeperCost
    )[0];

    return {
      franchises,
      averageAssetValue,
      totalKeeperSurplus,
      largestKeeperSurplus: largestKeeperSurplusPlayer
        ? { player: largestKeeperSurplusPlayer }
        : null,
      largestContract: largestContractPlayer
        ? { player: largestContractPlayer }
        : null,
    };
  }
}
