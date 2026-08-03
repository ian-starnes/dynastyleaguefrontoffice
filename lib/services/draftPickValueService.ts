/**
 * Configurable Draft Pick Value table — the dollar value of a future
 * rookie draft pick, by round and how many years out it is. Deliberately
 * a simple, hand-set table for now; designed so it's swappable for real
 * FantasyCalc rookie-pick values later (FantasyCalc tracks future picks
 * as their own tradeable assets) — every caller goes through
 * getDraftPickValue(), never a hardcoded number of its own.
 *
 * TODO(draft-pick-value-model): replace with real FantasyCalc rookie pick
 * values once that's wired up — see lib/services/marketValueService.ts's
 * TODO(market-value-model) for the equivalent player-side plan.
 */
export type DraftPickValueTable = {
  /** Base $ value per round, for this year's draft (yearsOut = 0). */
  roundValues: Record<number, number>;
  /** Fractional discount applied per additional year out, for uncertainty. */
  discountPerYearOut: number;
};

export const DEFAULT_DRAFT_PICK_VALUE_TABLE: DraftPickValueTable = {
  roundValues: { 1: 45, 2: 18, 3: 6 },
  discountPerYearOut: 0.15,
};

export function getDraftPickValue(
  round: number,
  yearsOut: number,
  table: DraftPickValueTable = DEFAULT_DRAFT_PICK_VALUE_TABLE
): number {
  const baseValue = table.roundValues[round] ?? 1;
  const discounted = baseValue * Math.pow(1 - table.discountPerYearOut, yearsOut);
  return Math.max(1, Math.round(discounted));
}
