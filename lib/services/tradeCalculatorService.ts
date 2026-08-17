import { getRosters, getOwners } from "@/lib/sleeper";
import { getLeaguePlayers, type LeaguePlayer } from "@/lib/league-players";
import { getFuturePicks, type FuturePick } from "./futurePicksService";
import { MAX_KEEPER_YEARS, projectMultiYearSurplus } from "./assetCalculator";

export type TradeAsset =
  | { kind: "player"; playerId: string }
  | { kind: "pick"; season: number; round: number };

export type TradeSide = {
  ownerId: string;
  /** Assets this owner is sending to the OTHER side. */
  gives: TradeAsset[];
};

export type TradeProposal = {
  sideA: TradeSide;
  sideB: TradeSide;
};

export type EvaluatedAsset = {
  asset: TradeAsset;
  label: string;
  /** Today's single-year Asset Value snapshot — null for a pick, which has no such concept, only a flat credit. */
  currentAssetValue: number | null;
  /** Null for a pick. */
  currentOwnerYearsRemaining: number | null;
  /**
   * Multi-year projected surplus capturable by whoever CURRENTLY holds
   * this, using their actual years remaining. For a pick, this is just
   * its flat Appendix A credit value (no multi-year concept applies).
   */
  currentOwnerProjectedSurplus: number;
  /** Null for a pick — a player's keeper term always resets to MAX_KEEPER_YEARS for whoever acquires them in a trade. */
  acquiringOwnerYearsRemaining: number | null;
  /**
   * Multi-year projected surplus capturable by the ACQUIRING owner —
   * for a player, this is where the "receiving-team contract reset"
   * bonus shows up, since it always projects a fresh MAX_KEEPER_YEARS
   * regardless of how many years the current owner had left. Identical
   * to currentOwnerProjectedSurplus for a pick.
   */
  acquiringOwnerProjectedSurplus: number;
};

export type TradeSideEvaluation = {
  ownerId: string;
  ownerName: string | null;
  assetsGivenUp: EvaluatedAsset[];
  assetsReceived: EvaluatedAsset[];
  /** Sum of assetsGivenUp's currentOwnerProjectedSurplus — what this side forfeits by trading these away. */
  valueGivenUp: number;
  /** Sum of assetsReceived's acquiringOwnerProjectedSurplus — what this side gains, WITH the contract reset applied to any players received. */
  valueReceived: number;
  netChange: number;
};

export type TradeEvaluation = {
  sideA: TradeSideEvaluation;
  sideB: TradeSideEvaluation;
};

function evaluatePlayerAsset(
  playerId: string,
  playersById: Map<string, LeaguePlayer>
): Omit<EvaluatedAsset, "asset"> | null {
  const player = playersById.get(playerId);
  if (!player || player.marketValue === null) return null;

  const currentProjection = projectMultiYearSurplus(
    player.marketValue,
    player.keeperCost,
    player.keeperYearsRemaining
  );
  const acquiringProjection = projectMultiYearSurplus(
    player.marketValue,
    player.keeperCost,
    MAX_KEEPER_YEARS
  );

  return {
    label: player.nflPlayer.fullName,
    currentAssetValue: player.assetValue,
    currentOwnerYearsRemaining: player.keeperYearsRemaining,
    currentOwnerProjectedSurplus: currentProjection.cumulativeSurplus,
    acquiringOwnerYearsRemaining: MAX_KEEPER_YEARS,
    acquiringOwnerProjectedSurplus: acquiringProjection.cumulativeSurplus,
  };
}

function evaluatePickAsset(
  season: number,
  round: number,
  ownerRosterId: number,
  picks: FuturePick[]
): Omit<EvaluatedAsset, "asset"> | null {
  const pick = picks.find(
    (p) =>
      p.season === season && p.round === round && p.currentOwnerRosterId === ownerRosterId
  );
  if (!pick) return null;

  return {
    label: `${season} Round ${round} Pick`,
    currentAssetValue: null,
    currentOwnerYearsRemaining: null,
    currentOwnerProjectedSurplus: pick.value,
    acquiringOwnerYearsRemaining: null,
    acquiringOwnerProjectedSurplus: pick.value,
  };
}

/**
 * Evaluates a proposed (not yet executed) trade between two owners —
 * DLFO's Trade Center core, per brief section 7. The critical insight
 * the brief calls out: a trade does NOT change a player's Market Value
 * or Keeper Cost the instant it happens, so comparing single-year Asset
 * Value before/after would always show zero difference. What actually
 * changes is the acquiring team's keeper years remaining, which always
 * resets to MAX_KEEPER_YEARS regardless of how many years the sending
 * team had left (lib/services/keeperClockService.ts's real behavior,
 * simulated here for a hypothetical trade that hasn't happened yet).
 * This function projects cumulative capturable surplus over those years
 * for both the current holder and the acquiring team, so the real value
 * of "resetting the clock" is visible instead of hidden.
 *
 * Picks are valued at their flat Appendix A credit (lib/config/
 * auctionBudgetAppendixA.ts) either way — no reset concept applies to a
 * draft pick.
 */
export async function evaluateTrade(proposal: TradeProposal): Promise<TradeEvaluation> {
  const [players, rosters, owners, picks] = await Promise.all([
    getLeaguePlayers(),
    getRosters(),
    getOwners(),
    getFuturePicks(),
  ]);

  const playersById = new Map(players.map((p) => [p.nflPlayer.id, p]));
  const ownerNameByOwnerId = new Map(
    owners.map((owner) => [owner.user_id, owner.metadata?.team_name ?? owner.display_name])
  );
  const rosterIdByOwnerId = new Map(
    rosters.filter((r) => r.owner_id).map((r) => [r.owner_id as string, r.roster_id])
  );

  function evaluateAsset(asset: TradeAsset, ownerId: string): EvaluatedAsset | null {
    if (asset.kind === "player") {
      const evaluated = evaluatePlayerAsset(asset.playerId, playersById);
      return evaluated ? { asset, ...evaluated } : null;
    }
    const rosterId = rosterIdByOwnerId.get(ownerId);
    if (rosterId === undefined) return null;
    const evaluated = evaluatePickAsset(asset.season, asset.round, rosterId, picks);
    return evaluated ? { asset, ...evaluated } : null;
  }

  function evaluateSide(
    giver: TradeSide,
    receiver: TradeSide
  ): TradeSideEvaluation {
    const assetsGivenUp = giver.gives
      .map((asset) => evaluateAsset(asset, giver.ownerId))
      .filter((a): a is EvaluatedAsset => a !== null);
    const assetsReceived = receiver.gives
      .map((asset) => evaluateAsset(asset, receiver.ownerId))
      .filter((a): a is EvaluatedAsset => a !== null);

    const valueGivenUp = assetsGivenUp.reduce(
      (sum, a) => sum + a.currentOwnerProjectedSurplus,
      0
    );
    const valueReceived = assetsReceived.reduce(
      (sum, a) => sum + a.acquiringOwnerProjectedSurplus,
      0
    );

    return {
      ownerId: giver.ownerId,
      ownerName: ownerNameByOwnerId.get(giver.ownerId) ?? null,
      assetsGivenUp,
      assetsReceived,
      valueGivenUp,
      valueReceived,
      netChange: valueReceived - valueGivenUp,
    };
  }

  return {
    sideA: evaluateSide(proposal.sideA, proposal.sideB),
    sideB: evaluateSide(proposal.sideB, proposal.sideA),
  };
}
