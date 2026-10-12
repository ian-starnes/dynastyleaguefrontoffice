import { getPlayers, type NFLPlayer } from "@/lib/sleeper";
import { getROSStats, type ROSStats } from "./rosStatsService";
import { getROSConsensusValues, normalizeConsensusRank, type ROSConsensusPlayer } from "./rosConsensusService";
import { normalizePlayerName } from "./fantasycalc";
import {
  ROS_VALUATION_WEIGHTS,
  ROSTER_REQUIREMENTS,
  AUCTION_ECONOMY,
  ROSTERABLE_POOL_MULTIPLIER,
} from "@/lib/config/rosValuationConfig";

export type ROSValuation = {
  playerId: string;
  /** Blended rest-of-season PPG projection (Components A+B+C, renormalized for missing C) — NOT season-long PPG, NOT a raw stat. */
  rosProjection: number;
  /**
   * Position-specific replacement-level ROS PPG (brief section 4) — the
   * BLENDED rosProjection (same Components A+B+C basis as every player's
   * own rosProjection above, not raw weightedPPG) of whoever sits exactly
   * at that position's real starting-lineup-demand rank. Computed on the
   * same scale as rosProjection deliberately: a threshold measured on a
   * different basis than the value it's subtracted from (a confirmed real
   * bug — a raw-PPG-ranked replacement level could sit above a player's
   * blended projection even when that same player ranked well inside the
   * replacement cutoff by blended merit, incorrectly flooring their
   * marginal value to zero) would make marginalValue incoherent.
   */
  replacementValue: number;
  /** rosProjection minus replacementValue, floored at 0 — production above replacement. */
  marginalValue: number;
  /** 0-1 normalized consensus rank score. Null when no real consensus data exists (today: always null — see rosConsensusService.ts). */
  consensusScore: number | null;
  /** 0-1 position-specific composite opportunity score (targets/snaps/red-zone/carries, position-weighted). Null if no real opportunity data exists for this player. */
  opportunityScore: number | null;
  /** Final integer auction dollar value — "what should an owner reasonably pay for this player's remaining production, today." */
  auctionValue: number;
};

export type ROSValuationContext = {
  rosStats: Map<string, ROSStats>;
  consensusValues: Map<string, ROSConsensusPlayer>;
  players: NFLPlayer[];
};

const FANTASY_POSITIONS = ["QB", "RB", "WR", "TE"] as const;
type FantasyPosition = (typeof FANTASY_POSITIONS)[number];

function isFantasyPosition(position: string): position is FantasyPosition {
  return (FANTASY_POSITIONS as readonly string[]).includes(position);
}

/**
 * How many players at a position have real starting-lineup demand, given
 * ROSTER_REQUIREMENTS — not just "top N by some arbitrary cutoff." FLEX
 * slots are split across RB/WR/TE per the configured allocation (not a
 * measured fact, a documented estimate — see
 * lib/config/rosValuationConfig.ts).
 */
function replacementRankForPosition(position: FantasyPosition): number {
  const { numTeams, starters, flexAllocation } = ROSTER_REQUIREMENTS;
  const flexShare = position === "QB" ? 0 : flexAllocation[position];
  const dedicatedStarters = starters[position];
  return Math.round(numTeams * (dedicatedStarters + flexShare * starters.FLEX));
}

/**
 * Assembles everything calculateROSAuctionValue needs, once — every
 * component here is a real live data fetch (rosStatsService's Sleeper
 * stats, rosConsensus's stub). Expensive, so callers computing many
 * players' values should build this once and reuse it, not call it per
 * player. Replacement level is NOT precomputed here — it depends on every
 * player's blended rosProjection, which only exists once
 * calculateAllROSAuctionValues actually runs the blend, so it's derived
 * inline there instead (see that function's doc comment).
 */
export async function buildROSValuationContext(
  precomputedPlayers?: NFLPlayer[]
): Promise<ROSValuationContext> {
  const players = precomputedPlayers ?? (await getPlayers());
  const [rosStats, consensusValues] = await Promise.all([
    getROSStats(players),
    getROSConsensusValues(),
  ]);
  return { rosStats, consensusValues, players };
}

/**
 * Position-specific opportunity composite (brief section 3B) — each
 * position weighs the real Sleeper-derived share metrics differently,
 * matching the brief's own position breakdown. Returns null when NONE
 * of the position's relevant metrics have real data, rather than
 * silently scoring an unknown player as "zero opportunity."
 */
function computeOpportunityScore(position: FantasyPosition, stats: ROSStats): number | null {
  const weighted: Array<[number | null, number]> = (() => {
    switch (position) {
      case "RB":
        // Goal-line role uses rushRedZoneAttemptShare (a runner's actual
        // goal-line carries), not the receiving red-zone metric — that's
        // WR/TE's signal, not a back's.
        return [
          [stats.snapShare, 0.35],
          [stats.rushAttemptShare, 0.3],
          [stats.rushRedZoneAttemptShare, 0.2],
          [stats.targetShare, 0.15],
        ];
      case "WR":
        return [
          [stats.targetShare, 0.4],
          [stats.snapShare, 0.25],
          [stats.airYardShare, 0.2],
          [stats.redZoneTargetShare, 0.15],
        ];
      case "TE":
        return [
          [stats.targetShare, 0.45],
          [stats.snapShare, 0.4],
          [stats.redZoneTargetShare, 0.15],
        ];
      case "QB":
        // Passing volume is the dominant signal for a QB's opportunity —
        // an undisputed starter takes ~100% of a team's pass attempts;
        // rushRedZoneAttemptShare captures a real rushing-TD-opportunity
        // signal (the brief's "expected TD opportunity") without
        // fabricating a passing-TD-opportunity metric Sleeper doesn't
        // expose as a shareable team total.
        return [
          [stats.passAttemptShare, 0.6],
          [stats.rushRedZoneAttemptShare, 0.2],
          [stats.snapShare, 0.2],
        ];
    }
  })();

  const available = weighted.filter((entry): entry is [number, number] => entry[0] !== null);
  if (available.length === 0) return null;

  const totalWeight = available.reduce((sum, [, weight]) => sum + weight, 0);
  const score = available.reduce((sum, [value, weight]) => sum + value * weight, 0) / totalWeight;
  return Math.max(0, Math.min(1, score));
}

type PositionDistribution = { mean: number; stdDev: number };

/**
 * Mean/stdDev of real weightedPPG within one position's active player
 * pool — the basis for z-score blending, so Components A/B/C (which are
 * on different scales — PPG, a 0-1 share composite, a 0-1 rank score)
 * combine as normalized positions within their own real distribution
 * rather than being averaged as if they were the same unit.
 */
function computePositionPPGDistribution(
  position: FantasyPosition,
  players: NFLPlayer[],
  rosStats: Map<string, ROSStats>
): PositionDistribution {
  const ppgValues = players
    .filter((p) => p.position === position)
    .map((p) => rosStats.get(p.id))
    .filter((s): s is ROSStats => s !== undefined && s.gamesPlayed > 0)
    .map((s) => s.weightedPPG);

  if (ppgValues.length === 0) return { mean: 0, stdDev: 1 };

  const mean = ppgValues.reduce((sum, v) => sum + v, 0) / ppgValues.length;
  const variance = ppgValues.reduce((sum, v) => sum + (v - mean) ** 2, 0) / ppgValues.length;
  return { mean, stdDev: Math.sqrt(variance) || 1 };
}

/**
 * Similarly, the mean/stdDev of the opportunity composite within one
 * position's pool (players with a real opportunity score only) — needed
 * to convert an opportunity SCORE (0-1) into a z-score comparable to
 * Component A's PPG z-score, since "0.6 opportunity" isn't inherently
 * comparable to "14.2 PPG" without knowing where 0.6 sits in the real
 * distribution.
 */
function computePositionOpportunityDistribution(
  position: FantasyPosition,
  players: NFLPlayer[],
  rosStats: Map<string, ROSStats>
): PositionDistribution {
  const scores = players
    .filter((p) => p.position === position)
    .map((p) => {
      const stats = rosStats.get(p.id);
      return stats ? computeOpportunityScore(position, stats) : null;
    })
    .filter((s): s is number => s !== null);

  if (scores.length === 0) return { mean: 0, stdDev: 1 };

  const mean = scores.reduce((sum, v) => sum + v, 0) / scores.length;
  const variance = scores.reduce((sum, v) => sum + (v - mean) ** 2, 0) / scores.length;
  return { mean, stdDev: Math.sqrt(variance) || 1 };
}

/**
 * Peter Acklam's rational approximation for the probit function (inverse
 * of the standard normal CDF) — accurate to about 1.15e-9, a standard,
 * widely-used technique for converting a percentile/rank into a real
 * z-score (the same idea behind "normal scores"/rankits in statistics).
 * Clamped away from the exact 0/1 boundary (where the true probit is
 * +-Infinity) so the single #1-ranked player in a pool gets a large but
 * finite z-score (~5.7) instead of blowing up the blend.
 */
function probit(p: number): number {
  const clamped = Math.min(1 - 1e-9, Math.max(1e-9, p));

  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.383577518672690e2, -3.066479806614716e1, 2.506628277459239e0];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838e0, -2.549732539343734e0, 4.374664141464968e0, 2.938163982698783e0];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996e0, 3.754408661907416e0];

  const pLow = 0.02425;
  const pHigh = 1 - pLow;

  if (clamped < pLow) {
    const q = Math.sqrt(-2 * Math.log(clamped));
    return (
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  }
  if (clamped <= pHigh) {
    const q = clamped - 0.5;
    const r = q * q;
    return (
      ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
    );
  }
  const q = Math.sqrt(-2 * Math.log(1 - clamped));
  return -(
    (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
    ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
  );
}

/**
 * Blends Components A (rest-of-season PPG projection), B (opportunity),
 * and C (consensus, real FantasyPros data when a key is configured —
 * see rosConsensusService.ts) via z-scores within the player's own
 * position pool, per ROS_VALUATION_WEIGHTS — renormalized across
 * whichever components actually have real data for this player, rather
 * than silently shrinking a player's score because one input is missing.
 * The blended z-score is converted back into PPG units (position mean +
 * z*stdDev) so it stays directly comparable to replacementValue, which
 * is also a real PPG figure from the same distribution.
 */
function blendProjection(
  position: FantasyPosition,
  stats: ROSStats,
  opportunityScore: number | null,
  consensusScore: number | null,
  ppgDist: PositionDistribution,
  opportunityDist: PositionDistribution
): number {
  const ppgZ = (stats.weightedPPG - ppgDist.mean) / ppgDist.stdDev;
  const opportunityZ =
    opportunityScore !== null ? (opportunityScore - opportunityDist.mean) / opportunityDist.stdDev : null;
  // Consensus's 0-1 score converts to a real z-score via probit (the
  // inverse standard normal CDF), not a naive linear rescale — confirmed
  // live with real 2026 draft consensus that a linear rescale of even a
  // position-scoped percentile barely moves the blend (a real McCaffrey
  // RB3 vs Gibbs RB1 gap produced a ~0.006 score difference on a 0-1
  // scale, invisible next to ppgZ/opportunityZ's real range). probit
  // preserves separation at the extremes the way real expert disagreement
  // actually concentrates there — RB1 vs RB3 out of 222 ranked backs is a
  // much bigger real signal than RB110 vs RB112, and this reflects that
  // instead of treating every rank step as equally significant.
  const consensusZ = consensusScore !== null ? probit(consensusScore) : null;

  const components: Array<[number | null, number]> = [
    [ppgZ, ROS_VALUATION_WEIGHTS.rosProjection],
    [opportunityZ, ROS_VALUATION_WEIGHTS.rosOpportunity],
    [consensusZ, ROS_VALUATION_WEIGHTS.consensus],
  ];
  const available = components.filter((entry): entry is [number, number] => entry[0] !== null);
  const totalWeight = available.reduce((sum, [, weight]) => sum + weight, 0);
  const blendedZ =
    totalWeight > 0
      ? available.reduce((sum, [z, weight]) => sum + z * weight, 0) / totalWeight
      : 0;

  return ppgDist.mean + blendedZ * ppgDist.stdDev;
}

/**
 * The full ROS valuation for every fantasy-relevant player at once —
 * needed (not just convenient) because Component D's dollar conversion
 * is inherently pool-relative: marginal value only becomes a dollar
 * figure once scaled against the total real $2,000 league economy and
 * every other player's marginal value. A single player's auction value
 * cannot be computed in isolation from the rest of the pool.
 *
 * Also why replacement level is derived HERE rather than fetched as a
 * precomputed input: it's the blended rosProjection (Components A+B+C)
 * of whoever sits at each position's replacement rank, and that blend
 * only exists once every player's z-scores are computed below. An
 * earlier version ranked the replacement player by raw weightedPPG alone
 * (Component A only) and then subtracted THAT raw figure from every
 * player's full blended rosProjection — a real, confirmed bug: a
 * player can rank highly by blended merit (strong opportunity + expert
 * consensus) while a small-sample raw-PPG outlier elsewhere at the same
 * position set a higher raw threshold, incorrectly flooring the first
 * player's marginal value to zero even though they clearly belonged
 * above replacement. Comparing rosProjection against a threshold
 * computed on the exact same basis fixes that.
 */
export async function calculateAllROSAuctionValues(
  context?: ROSValuationContext
): Promise<Map<string, ROSValuation>> {
  const ctx = context ?? (await buildROSValuationContext());
  const { rosStats, consensusValues, players } = ctx;

  const ppgDistByPosition = new Map<FantasyPosition, PositionDistribution>();
  const opportunityDistByPosition = new Map<FantasyPosition, PositionDistribution>();
  for (const position of FANTASY_POSITIONS) {
    ppgDistByPosition.set(position, computePositionPPGDistribution(position, players, rosStats));
    opportunityDistByPosition.set(
      position,
      computePositionOpportunityDistribution(position, players, rosStats)
    );
  }

  // Pool size MUST be scoped to the player's own position — a global
  // cross-position count (~900+ players) is what compressed real
  // top-of-market separation to nothing (see rosConsensusService.ts's
  // ROSConsensusPlayer.fantasyProsRosRank doc comment for the confirmed
  // real example).
  const consensusPoolSizeByPosition = new Map<FantasyPosition, number>();
  for (const consensusPlayer of consensusValues.values()) {
    if (!isFantasyPosition(consensusPlayer.position ?? "")) continue;
    const position = consensusPlayer.position as FantasyPosition;
    consensusPoolSizeByPosition.set(position, (consensusPoolSizeByPosition.get(position) ?? 0) + 1);
  }

  type PreReplacement = {
    player: NFLPlayer;
    rosProjection: number;
    consensusScore: number | null;
    opportunityScore: number | null;
  };

  // Pass 1: every eligible player's blended projection — marginal value
  // isn't computable yet, since replacement level (below) depends on
  // every player at a position already having one of these.
  const preReplacementByPosition = new Map<FantasyPosition, PreReplacement[]>();
  for (const player of players) {
    if (!isFantasyPosition(player.position)) continue;
    const stats = rosStats.get(player.id);
    if (!stats || stats.gamesPlayed === 0) continue;

    const opportunityScore = computeOpportunityScore(player.position, stats);

    // FantasyPros' API exposes no Sleeper ID (confirmed live) — matched
    // by normalized name only, same fallback pattern used for FantasyCalc
    // elsewhere in this codebase.
    const consensus =
      consensusValues.get(player.id) ??
      consensusValues.get(normalizePlayerName(player.fullName));
    const consensusRank = consensus?.fantasyProsRosRank ?? consensus?.pffRosRank ?? null;
    const consensusScore = normalizeConsensusRank(
      consensusRank,
      consensusPoolSizeByPosition.get(player.position) ?? 0
    );

    const rosProjection = blendProjection(
      player.position,
      stats,
      opportunityScore,
      consensusScore,
      ppgDistByPosition.get(player.position)!,
      opportunityDistByPosition.get(player.position)!
    );

    const list = preReplacementByPosition.get(player.position) ?? [];
    list.push({ player, rosProjection, consensusScore, opportunityScore });
    preReplacementByPosition.set(player.position, list);
  }

  // Replacement level per position: the blended rosProjection of whoever
  // sits exactly at that position's real starting-lineup-demand rank —
  // see this function's doc comment for why this has to be the same
  // blended basis every player's own rosProjection is on, not a
  // separately-ranked raw PPG figure.
  const replacementValueByPosition = new Map<FantasyPosition, number>();
  for (const position of FANTASY_POSITIONS) {
    const list = (preReplacementByPosition.get(position) ?? []).sort(
      (a, b) => b.rosProjection - a.rosProjection
    );
    const rank = replacementRankForPosition(position);
    // Clamp to the actual pool size — a shallow position pool (e.g. very
    // early season) shouldn't index past what real data exists for.
    const index = Math.min(rank, list.length) - 1;
    replacementValueByPosition.set(position, list[Math.max(0, index)]?.rosProjection ?? 0);
  }

  // Pass 2: marginal value, now that each position's replacement level
  // is known.
  type PreDollar = PreReplacement & { replacementValue: number; marginalValue: number };
  const preDollarByPosition = new Map<FantasyPosition, PreDollar[]>();
  for (const position of FANTASY_POSITIONS) {
    const replacementValue = replacementValueByPosition.get(position) ?? 0;
    const list = (preReplacementByPosition.get(position) ?? []).map((p) => ({
      ...p,
      replacementValue,
      marginalValue: Math.max(0, p.rosProjection - replacementValue),
    }));
    preDollarByPosition.set(position, list);
  }

  // Only the top players PER POSITION (by marginal value, up to
  // ROSTERABLE_POOL_MULTIPLIER x that position's replacement rank)
  // compete for the discretionary economy — see that config constant's
  // doc comment for why the full ~579-player pool (most of whom no
  // 10-team league would ever roster) has to be excluded from the
  // denominator for the curve to have both a real elite tier and a real
  // flex/depth tier, not one or the other.
  const rosterablePool: PreDollar[] = [];
  const outsidePool: PreDollar[] = [];
  for (const position of FANTASY_POSITIONS) {
    const list = (preDollarByPosition.get(position) ?? []).sort(
      (a, b) => b.marginalValue - a.marginalValue
    );
    const cutoff = replacementRankForPosition(position) * ROSTERABLE_POOL_MULTIPLIER;
    rosterablePool.push(...list.slice(0, cutoff));
    outsidePool.push(...list.slice(cutoff));
  }

  // Component D: convert marginal production into real auction dollars.
  // Every rosterable player gets the $1 floor guaranteed; the remaining
  // economy is distributed proportional to marginal value's SQUARE
  // ROOT, not the raw figure — verified live (first pass of this
  // engine) that a strictly linear split lets a handful of statistical
  // outliers (a 13+ PPG-above-replacement RB1) absorb nearly the entire
  // discretionary economy, collapsing genuine "strong starter"/"flex"
  // tiers into one indistinguishable floor band. Same square-root-
  // compression principle the now-retired FantasyCalc-points-to-dollars
  // formula used, for an identical reason — real auction bidding rewards
  // being ahead of replacement at a diminishing, not linear, rate.
  // marginalValue itself (the field on ROSValuation)
  // stays the real, uncompressed PPG-above-replacement number for every
  // player, in and out of the rosterable pool alike — compression is
  // only an internal step of the dollar conversion, and only applies to
  // players actually competing for the discretionary economy.
  const totalEconomy = AUCTION_ECONOMY.numTeams * AUCTION_ECONOMY.budgetPerTeam;
  const totalCompressedValue = rosterablePool.reduce((sum, p) => sum + Math.sqrt(p.marginalValue), 0);
  const reservedFloor = rosterablePool.length * AUCTION_ECONOMY.minimumValue;
  const discretionaryEconomy = Math.max(0, totalEconomy - reservedFloor);
  const dollarsPerCompressedPoint =
    totalCompressedValue > 0 ? discretionaryEconomy / totalCompressedValue : 0;

  const results = new Map<string, ROSValuation>();
  for (const p of rosterablePool) {
    const auctionValue = Math.max(
      AUCTION_ECONOMY.minimumValue,
      Math.round(AUCTION_ECONOMY.minimumValue + Math.sqrt(p.marginalValue) * dollarsPerCompressedPoint)
    );

    results.set(p.player.id, {
      playerId: p.player.id,
      rosProjection: p.rosProjection,
      replacementValue: p.replacementValue,
      marginalValue: p.marginalValue,
      consensusScore: p.consensusScore,
      opportunityScore: p.opportunityScore,
      auctionValue,
    });
  }
  // Outside the rosterable pool: still a real projection, just floored —
  // these players genuinely aren't competing for the auction economy.
  for (const p of outsidePool) {
    results.set(p.player.id, {
      playerId: p.player.id,
      rosProjection: p.rosProjection,
      replacementValue: p.replacementValue,
      marginalValue: p.marginalValue,
      consensusScore: p.consensusScore,
      opportunityScore: p.opportunityScore,
      auctionValue: AUCTION_ECONOMY.minimumValue,
    });
  }

  return results;
}

/**
 * Single-player convenience wrapper matching the brief's requested
 * calculateROSAuctionValue(player, leagueContext) signature. Internally
 * still needs the full pool (see calculateAllROSAuctionValues) — pass a
 * pre-built context when calling this for many players so the expensive
 * pool computation isn't repeated per player.
 */
export async function calculateROSAuctionValue(
  playerId: string,
  context?: ROSValuationContext
): Promise<ROSValuation | null> {
  const all = await calculateAllROSAuctionValues(context);
  return all.get(playerId) ?? null;
}
