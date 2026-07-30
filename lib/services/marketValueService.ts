/**
 * Converts FantasyCalc's points-based value into an estimated auction
 * dollar amount — DLFO's actual currency. General managers think in
 * dollars, not FantasyCalc points, so every economic figure in the app
 * (Market Value, Keeper Cost, Keeper Surplus, Asset Value) is denominated
 * in auction dollars from here on.
 *
 * This is a deterministic formula, NOT player-specific hardcoding — the
 * same conversion applies uniformly to every FantasyCalc value, with no
 * per-player lookup table anywhere. It's isolated in its own service
 * specifically so it can be swapped for a trained regression/ML model
 * later without any caller changing.
 *
 * TODO(market-value-model): eventually Market Value should come from a
 * trained valuation model, not a formula. Planned inputs:
 *   - FantasyCalc (the only input today)
 *   - FantasyPros ECR
 *   - PFF grades
 *   - Historical auction results (lib/auction-history.ts)
 *   - DLFO's own projection engine
 *   - League settings (budget, roster size, scoring format)
 *   - Position scarcity
 *   - Replacement level
 *   - Age curve
 * Output: an estimated auction price. None of the above is implemented —
 * this file has exactly one input and one formula today.
 */

// Calibration constant for the current formula only — meaningless once
// this becomes a trained model. Tuned so a top-of-market FantasyCalc value
// (~11,000, roughly this league's real ceiling) lands in the $60-70 range,
// matching real auction results for elite dynasty assets in a $200 budget.
const CONVERSION_FACTOR = 0.62;

/**
 * Square-root compression: dollar value grows with FantasyCalc value but
 * not linearly — a handful of elite players are worth disproportionately
 * more, while the long tail of bench players cluster near the $1 minimum.
 * That mirrors how real auction bidding actually behaves far better than
 * a straight linear scale would.
 */
export function convertFantasyCalcToMarketValue(fc: number): number {
  return Math.max(1, Math.round(CONVERSION_FACTOR * Math.sqrt(Math.max(0, fc))));
}
