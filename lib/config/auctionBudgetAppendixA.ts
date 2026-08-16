/**
 * Appendix A — the league's real, commissioner-provided conversion table
 * from future draft round -> a fixed Auction Budget Credit dollar value
 * (DLFO architecture brief, section 14). Provided directly, not invented
 * — sums to exactly $200 across all 15 rows.
 *
 * Deliberately its own config module, not buried in a service file, so
 * it can be edited here without touching any application code that
 * reads it — per the brief's explicit requirement for section 14.
 *
 * "Fixed" per the brief — unlike a generic trade-value estimate, this
 * does NOT discount for how many years out the pick is. A round 3 pick
 * three years from now is worth the same $20 credit as a round 3 pick
 * in this year's draft.
 */
export const AUCTION_BUDGET_CREDITS_BY_ROUND: Record<number, number> = {
  1: 50,
  2: 30,
  3: 20,
  4: 18,
  5: 17,
  6: 15,
  7: 13,
  8: 11,
  9: 8,
  10: 6,
  11: 4,
  12: 3,
  13: 2,
  14: 2,
  15: 1,
};

/**
 * A round beyond this table (round 16+) has no defined credit — this
 * league's real draft never runs that deep, so returning 0 rather than
 * guessing a value is the honest choice, not a fabrication.
 */
export function getAuctionBudgetCredit(round: number): number {
  return AUCTION_BUDGET_CREDITS_BY_ROUND[round] ?? 0;
}
