/**
 * Configurable inputs for the ROS (rest-of-season) player valuation
 * engine (lib/services/rosValuationService.ts). Nothing here is a
 * hardcoded pricing table — these are the knobs the model turns, kept
 * in one place so they can be recalibrated without touching the
 * calculation logic itself, per the brief's explicit requirement.
 */

export type RosterRequirements = {
  numTeams: number;
  starters: {
    QB: number;
    RB: number;
    WR: number;
    TE: number;
    FLEX: number;
  };
  /**
   * How FLEX starter slots get allocated across RB/WR/TE for
   * replacement-level purposes — must sum to 1. Not a measured fact,
   * a reasonable estimate of typical flex-start behavior; adjust here,
   * not in the calculation code, if real league behavior differs.
   */
  flexAllocation: {
    RB: number;
    WR: number;
    TE: number;
  };
};

/**
 * Confirmed live against the real league (GET /league/{id}), not
 * assumed: roster_positions is exactly
 * ["QB","RB","RB","WR","WR","FLEX","FLEX","FLEX","BN"x7] — there is NO
 * dedicated TE starter slot. TE only plays through the 3 FLEX spots
 * alongside RB/WR, which is why TE's dedicated starters value below is
 * 0, not 1 — an earlier version of this config assumed a dedicated TE
 * slot that this league's real settings don't have.
 */
export const ROSTER_REQUIREMENTS: RosterRequirements = {
  numTeams: 10,
  starters: { QB: 1, RB: 2, WR: 2, TE: 0, FLEX: 3 },
  flexAllocation: { RB: 0.45, WR: 0.45, TE: 0.1 },
};

/**
 * Weights for blending the three PRODUCTION-scale inputs (rest-of-season
 * projection, opportunity, consensus) into one adjusted projection.
 * League economics (replacement level, scarcity, the real $2,000 total
 * economy) is NOT a fourth blend-in at this stage — it's the mechanism
 * that converts the blended projection into dollars, since PPG and
 * dollars are different units that can't be linearly averaged
 * together. Its influence is structural (the whole conversion step),
 * documented in rosValuationService.ts.
 *
 * Renormalized at read time across whichever inputs actually have real
 * data — today, consensus is a stub (no FantasyPros/PFF ROS license),
 * so its weight currently redistributes to projection/opportunity
 * rather than silently shrinking every player's score.
 */
export type ROSValuationWeights = {
  rosProjection: number;
  rosOpportunity: number;
  consensus: number;
};

export const ROS_VALUATION_WEIGHTS: ROSValuationWeights = {
  rosProjection: 0.5,
  rosOpportunity: 0.25,
  consensus: 0.15,
};

/**
 * Recency weighting for the rest-of-season PPG projection — a
 * CONTINUOUS linear ramp, not a binary step function, per the brief's
 * literal "progressively greater weight" instruction (never just
 * season-long PPG). The oldest week in scope gets weight 1.0; the most
 * recent week gets maxWeekMultiplier; every week between is linearly
 * interpolated. Fixed from an earlier version that gave a flat 2x to a
 * fixed last-4-week window and 1x to everything else — a step function
 * isn't "progressive," and it also silently did nothing at all when
 * running against the completed-season fallback (see
 * rosStatsService.ts's doc comment for that separate, now-fixed bug).
 */
export const RECENCY_WEIGHTING = {
  /** Weight applied to the most recent week in scope; earlier weeks ramp down linearly to 1.0 at the oldest week. */
  maxWeekMultiplier: 3,
};

/** The league's real auction economy — used to scale marginal production into dollars. */
export const AUCTION_ECONOMY = {
  numTeams: 10,
  budgetPerTeam: 200,
  /** Minimum auction dollar for any rosterable player — matches a real auction's $1 floor, never $0. */
  minimumValue: 1,
};

/**
 * How many players PER POSITION actually compete for the discretionary
 * economy, expressed as a multiple of that position's replacement rank
 * — e.g. 3x a replacement rank of 34 (RB) means the top ~102 RBs by
 * production compete for real dollars, and every RB ranked deeper than
 * that (of ~579 total players with any real 2025 stat line) still gets
 * a valid, real projection in the output, just floored at $1 rather
 * than diluting the $2,000 pool across hundreds of players a 10-team,
 * ~15-man-roster league would never actually roster. Verified live
 * (first two passes of this engine) that including the FULL ~579-player
 * pool in the dollar-conversion denominator collapses the whole curve —
 * either 91% of players cluster at the floor (no compression) or the
 * "elite" tier disappears entirely (with compression, since a fixed
 * $2,000 spread across too many contributors leaves nothing for the
 * top). Scoping the discretionary pool to a realistic rosterable
 * universe is what actually lets both ends of the target curve — a
 * real elite tier AND a real, non-trivial "flex/depth" tier — coexist.
 */
export const ROSTERABLE_POOL_MULTIPLIER = 3;
