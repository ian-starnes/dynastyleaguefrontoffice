import { getRosters, getOwners, getLeague } from "@/lib/sleeper";
import { getLeaguePlayers, type LeaguePlayer } from "@/lib/league-players";
import { getFuturePicks, getProjectedAuctionBudgets, type FuturePick } from "./futurePicksService";
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
  /**
   * Real current-season Market Value for a player, or the flat Appendix A
   * credit for a pick — the basis for franchiseImpact below. Null only
   * for a real rostered player the ROS valuation engine has no live
   * number for yet (e.g. a rookie with zero recorded games) — never
   * fabricated. Distinct from currentAssetValue below, which is the
   * separate keeper-surplus-adjusted metric.
   */
  currentMarketValue: number | null;
  /** Today's single-year Asset Value snapshot — null for a pick (no such concept, only a flat credit) or for a player with no live Market Value yet. */
  currentAssetValue: number | null;
  /** Null for a pick. */
  currentOwnerYearsRemaining: number | null;
  /**
   * Multi-year projected surplus capturable by whoever CURRENTLY holds
   * this, using their actual years remaining. For a pick, this is just
   * its flat Appendix A credit value (no multi-year concept applies).
   * Zero (not omitted) for a player with no live Market Value yet — a
   * real, explicit "no projectable surplus" rather than silently
   * dropping the asset from the evaluation.
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

export type FranchiseValueSnapshot = {
  rosterMarketValue: number;
  futurePickValue: number;
  franchiseValue: number;
};

export type FranchiseValueImpact = {
  /** This owner's REAL current totals — same figures/methodology as the League page (lib/services/franchiseValueService.ts) — before this hypothetical trade. */
  before: FranchiseValueSnapshot;
  /** before, with this trade's assets swapped in/out. */
  after: FranchiseValueSnapshot;
  /** after minus before, per figure — the trade's real, immediate impact. */
  change: FranchiseValueSnapshot;
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
  /** The trade's real, immediate impact on this owner's actual Market Value and Franchise Value — distinct from valueGivenUp/valueReceived above, which are a multi-year keeper-surplus PROJECTION, not today's real totals. */
  franchiseImpact: FranchiseValueImpact;
};

export type TradeEvaluation = {
  /** The real season every Market Value figure in this evaluation is computed for — never hardcoded. */
  currentSeason: number;
  sideA: TradeSideEvaluation;
  sideB: TradeSideEvaluation;
};

function evaluatePlayerAsset(
  playerId: string,
  playersById: Map<string, LeaguePlayer>
): Omit<EvaluatedAsset, "asset"> | null {
  const player = playersById.get(playerId);
  if (!player) return null; // not a real player in this league at all

  if (player.marketValue === null) {
    // A real rostered player, but the ROS valuation engine has no live
    // number for them yet (e.g. a rookie with zero recorded games).
    // Shown with an explicit zero impact rather than silently dropped —
    // silently omitting a selected asset from its own trade evaluation
    // would look like it was never part of the proposal at all.
    return {
      label: player.nflPlayer.fullName,
      currentMarketValue: null,
      currentAssetValue: null,
      currentOwnerYearsRemaining: player.keeperYearsRemaining,
      currentOwnerProjectedSurplus: 0,
      acquiringOwnerYearsRemaining: MAX_KEEPER_YEARS,
      acquiringOwnerProjectedSurplus: 0,
    };
  }

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
    currentMarketValue: player.marketValue,
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
    currentMarketValue: pick.value,
    currentAssetValue: null,
    currentOwnerYearsRemaining: null,
    currentOwnerProjectedSurplus: pick.value,
    acquiringOwnerYearsRemaining: null,
    acquiringOwnerProjectedSurplus: pick.value,
  };
}

/**
 * Evaluates a proposed (not yet executed) trade between two owners —
 * DLFO's Trade Analyzer core, per brief section 7. The critical insight
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
 *
 * SEPARATELY, franchiseImpact answers a different, more immediate
 * question: what does this trade do to each owner's REAL Market Value
 * and Franchise Value right now, using the exact same methodology as
 * franchiseValueService.ts (never re-derived or approximated). Roster
 * Market Value and Future Pick Value are computed directly from the
 * same `players`/`picks` this function already fetches — deliberately
 * NOT by calling FranchiseValueService itself, which would re-fetch
 * getLeaguePlayers() (and therefore Sleeper's ~19MB /players/nfl
 * payload, confirmed too large for Next's fetch cache to dedupe) a
 * second time in the same request.
 */
export async function evaluateTrade(proposal: TradeProposal): Promise<TradeEvaluation> {
  const [players, rosters, owners, picks, league, projectedBudgets] = await Promise.all([
    getLeaguePlayers(),
    getRosters(),
    getOwners(),
    getFuturePicks(),
    getLeague(),
    getProjectedAuctionBudgets(),
  ]);

  const currentSeason = Number(league.season);

  const playersById = new Map(players.map((p) => [p.nflPlayer.id, p]));
  const ownerNameByOwnerId = new Map(
    owners.map((owner) => [owner.user_id, owner.metadata?.team_name ?? owner.display_name])
  );
  const rosterIdByOwnerId = new Map(
    rosters.filter((r) => r.owner_id).map((r) => [r.owner_id as string, r.roster_id])
  );

  // Mirrors franchiseValueService.ts's own real Roster Market Value /
  // Future Pick Value sums exactly — see this function's doc comment for
  // why that service isn't called directly here.
  const rosterMarketValueByOwnerId = new Map<string, number>();
  for (const player of players) {
    if (!player.currentOwnerId || player.marketValue === null) continue;
    rosterMarketValueByOwnerId.set(
      player.currentOwnerId,
      (rosterMarketValueByOwnerId.get(player.currentOwnerId) ?? 0) + player.marketValue
    );
  }
  const futurePickValueByOwnerId = new Map<string, number>();
  for (const budget of projectedBudgets) {
    futurePickValueByOwnerId.set(
      budget.ownerId,
      (futurePickValueByOwnerId.get(budget.ownerId) ?? 0) + budget.budget
    );
  }

  function currentFranchiseSnapshot(ownerId: string): FranchiseValueSnapshot {
    const rosterMarketValue = rosterMarketValueByOwnerId.get(ownerId) ?? 0;
    const futurePickValue = futurePickValueByOwnerId.get(ownerId) ?? 0;
    return {
      rosterMarketValue,
      futurePickValue,
      franchiseValue: rosterMarketValue + futurePickValue,
    };
  }

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

  function franchiseImpactFor(
    ownerId: string,
    assetsGivenUp: EvaluatedAsset[],
    assetsReceived: EvaluatedAsset[]
  ): FranchiseValueImpact {
    const before = currentFranchiseSnapshot(ownerId);

    let rosterMarketValueDelta = 0;
    let futurePickValueDelta = 0;

    for (const a of assetsGivenUp) {
      if (a.currentMarketValue === null) continue; // no real data — never fabricate an impact
      if (a.asset.kind === "player") rosterMarketValueDelta -= a.currentMarketValue;
      else futurePickValueDelta -= a.currentMarketValue;
    }
    for (const a of assetsReceived) {
      if (a.currentMarketValue === null) continue;
      if (a.asset.kind === "player") rosterMarketValueDelta += a.currentMarketValue;
      else futurePickValueDelta += a.currentMarketValue;
    }

    const franchiseValueDelta = rosterMarketValueDelta + futurePickValueDelta;

    return {
      before,
      after: {
        rosterMarketValue: before.rosterMarketValue + rosterMarketValueDelta,
        futurePickValue: before.futurePickValue + futurePickValueDelta,
        franchiseValue: before.franchiseValue + franchiseValueDelta,
      },
      change: {
        rosterMarketValue: rosterMarketValueDelta,
        futurePickValue: futurePickValueDelta,
        franchiseValue: franchiseValueDelta,
      },
    };
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
      franchiseImpact: franchiseImpactFor(giver.ownerId, assetsGivenUp, assetsReceived),
    };
  }

  return {
    currentSeason,
    sideA: evaluateSide(proposal.sideA, proposal.sideB),
    sideB: evaluateSide(proposal.sideB, proposal.sideA),
  };
}
