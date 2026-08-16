/**
 * Appendix B — the graduated auction budget for the UPCOMING season,
 * based on each team's final standing in the previous season (DLFO
 * architecture brief, section 15). A competitive-balance mechanism —
 * typically a worse finish earns a bigger budget than the champion's.
 *
 * NOT YET CONFIGURED. Deliberately left null rather than a guessed
 * table — inventing plausible-looking numbers here would be exactly the
 * kind of fabricated data the brief explicitly prohibits. Every caller
 * goes through getCompetitiveBalanceBudget(), which returns null until
 * this is filled in, so nothing downstream can mistake an invented
 * number for real league policy; the UI should show "—" for this stat
 * until then, per the brief's own rule for unavailable data.
 *
 * To activate: replace the null below with a Record<number, number>
 * mapping final rank (1 = champion, 10 = last place in a 10-team league)
 * to that team's real upcoming-season auction budget in dollars.
 */
export const AUCTION_BUDGET_BY_FINAL_RANK: Record<number, number> | null = null;

export function getCompetitiveBalanceBudget(finalRank: number): number | null {
  if (!AUCTION_BUDGET_BY_FINAL_RANK) return null;
  return AUCTION_BUDGET_BY_FINAL_RANK[finalRank] ?? null;
}
