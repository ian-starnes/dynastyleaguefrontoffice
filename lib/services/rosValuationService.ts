import { getPlayers, type NFLPlayer } from "@/lib/sleeper";
import { getROSStats, type ROSStats } from "./rosStatsService";
import { getReplacementLevels, type ReplacementLevel } from "./replacementLevelService";
import { getROSConsensusValues, normalizeConsensusRank, type ROSConsensusPlayer } from "./rosConsensusService";
import { normalizePlayerName } from "./fantasycalc";
import {
  ROS_VALUATION_WEIGHTS,
  AUCTION_ECONOMY,
  ROSTERABLE_POOL_MULTIPLIER,
} from "@/lib/config/rosValuationConfig";

export type ROSValuation = {
  playerId: string;
  /** Blended rest-of-season PPG projection (Components A+B+C, renormalized for missing C) — NOT season-long PPG, NOT a raw stat. */
  rosProjection: number;
  /** Position-specific replacement-level ROS PPG (brief section 4). */
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
  replacementLevels: Map<string, ReplacementLevel>;
  consensusValues: Map<string, ROSConsensusPlayer>;
  players: NFLPlayer[];
};

const FANTASY_POSITIONS = ["QB", "RB", "WR", "TE"] as const;
type FantasyPosition = (typeof FANTASY_POSITIONS)[number];

function isFantasyPosition(position: string): position is FantasyPosition {
  return (FANTASY_POSITIONS as readonly string[]).includes(position);
}

/**
 * Assembles everything calculateROSAuctionValue needs, once — every
 * component here is a real live data fetch (rosStatsService's Sleeper
 * stats, replacementLevelService's derived thresholds, rosConsensus's
 * stub). Expensive, so callers computing many players' values should
 * build this once and reuse it, not call it per player.
 */
export async function buildROSValuationContext(
  precomputedPlayers?: NFLPlayer[]
): Promise<ROSValuationContext> {
  const players = precomputedPlayers ?? (await getPlayers());
  const [rosStats, consensusValues] = await Promise.all([
    getROSStats(players),
    getROSConsensusValues(),
  ]);
  const replacementLevels = await getReplacementLevels({ rosStats, players });
  return { rosStats, replacementLevels, consensusValues, players };
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
 * Blends Components A (rest-of-season PPG projection), B (opportunity),
 * and C (consensus, currently always null pending real API access) via
 * z-scores within the player's own position pool, per
 * ROS_VALUATION_WEIGHTS — renormalized across whichever components
 * actually have real data for this player, rather than silently
 * shrinking a player's score because one input is missing. The blended
 * z-score is converted back into PPG units (position mean + z*stdDev)
 * so it stays directly comparable to replacementValue, which is also a
 * real PPG figure from the same distribution.
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
  // Consensus is a rank-based 0-1 score already comparable across the
  // full ranked pool by construction (normalizeConsensusRank) — treated
  // as its own z-equivalent centered at 0.5.
  //
  // KNOWN GAP (currently inert, not fixed): this +-2 cap is tighter than
  // ppgZ/opportunityZ's real, unbounded z-scores (which routinely exceed
  // +-2 for outlier players), so once rosConsensusService.ts stops being
  // a stub, Component C's practical influence on the blend will run
  // below its nominal 15% weight. Harmless today only because
  // consensusScore is always null (no licensed consensus API access
  // yet) — every real blend currently excludes this term entirely. Needs
  // re-tuning against real consensus data before that data exists, not
  // guessed at blind now.
  const consensusZ = consensusScore !== null ? (consensusScore - 0.5) * 4 : null;

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
 */
export async function calculateAllROSAuctionValues(
  context?: ROSValuationContext
): Promise<Map<string, ROSValuation>> {
  const ctx = context ?? (await buildROSValuationContext());
  const { rosStats, replacementLevels, consensusValues, players } = ctx;

  const ppgDistByPosition = new Map<FantasyPosition, PositionDistribution>();
  const opportunityDistByPosition = new Map<FantasyPosition, PositionDistribution>();
  for (const position of FANTASY_POSITIONS) {
    ppgDistByPosition.set(position, computePositionPPGDistribution(position, players, rosStats));
    opportunityDistByPosition.set(
      position,
      computePositionOpportunityDistribution(position, players, rosStats)
    );
  }

  const consensusPoolSize = consensusValues.size;

  type PreDollar = {
    player: NFLPlayer;
    rosProjection: number;
    replacementValue: number;
    marginalValue: number;
    consensusScore: number | null;
    opportunityScore: number | null;
  };
  const preDollarByPosition = new Map<FantasyPosition, PreDollar[]>();

  for (const player of players) {
    if (!isFantasyPosition(player.position)) continue;
    const stats = rosStats.get(player.id);
    if (!stats || stats.gamesPlayed === 0) continue;

    const replacementLevel = replacementLevels.get(player.position);
    if (!replacementLevel) continue;

    const opportunityScore = computeOpportunityScore(player.position, stats);

    // FantasyPros' API exposes no Sleeper ID (confirmed live) — matched
    // by normalized name only, same fallback pattern used for FantasyCalc
    // elsewhere in this codebase.
    const consensus =
      consensusValues.get(player.id) ??
      consensusValues.get(normalizePlayerName(player.fullName));
    const consensusRank = consensus?.fantasyProsRosRank ?? consensus?.pffRosRank ?? null;
    const consensusScore = normalizeConsensusRank(consensusRank, consensusPoolSize);

    const rosProjection = blendProjection(
      player.position,
      stats,
      opportunityScore,
      consensusScore,
      ppgDistByPosition.get(player.position)!,
      opportunityDistByPosition.get(player.position)!
    );

    const marginalValue = Math.max(0, rosProjection - replacementLevel.replacementPPG);

    const list = preDollarByPosition.get(player.position) ?? [];
    list.push({
      player,
      rosProjection,
      replacementValue: replacementLevel.replacementPPG,
      marginalValue,
      consensusScore,
      opportunityScore,
    });
    preDollarByPosition.set(player.position, list);
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
    const replacementLevel = replacementLevels.get(position);
    const cutoff = replacementLevel
      ? replacementLevel.replacementRank * ROSTERABLE_POOL_MULTIPLIER
      : list.length;
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
