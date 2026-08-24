/**
 * PFF (Pro Football Focus) grades — a planned future input to Market
 * Value's Component C (see lib/services/rosValuationService.ts and
 * lib/services/rosConsensusService.ts, DLFO's actual Market Value source
 * today).
 *
 * Researched before writing this stub: PFF does not appear to publish a
 * public, documented API for fantasy grades. What exists (pff.dev,
 * PFF FC) looks aimed at licensed partners, not open self-serve access
 * the way FantasyCalc's API is. No confirmed endpoint, auth scheme, or
 * pricing to build against yet — this would need direct outreach to PFF
 * for a data license, which is a business decision, not an engineering one.
 *
 * Returns an empty map until that access exists. Never fabricate a grade.
 */
export type PffPlayer = {
  name: string;
  sleeperId: string | null;
  grade: number;
};

export async function getPffValues(): Promise<Map<string, PffPlayer>> {
  return new Map();
}
