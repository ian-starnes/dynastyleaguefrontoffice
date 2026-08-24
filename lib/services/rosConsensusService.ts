/**
 * Component C of the ROS valuation engine: current-season consensus
 * rankings/projections — explicitly NOT dynasty ECR (lib/services/
 * fantasypros.ts's existing stub is dynasty-scoped and stays that way
 * for whatever future dynasty-ECR use case it was built for; this is a
 * separate, ROS-specific input).
 *
 * Real access status for both sources, researched rather than assumed:
 *
 * FantasyPros: same real, documented API as lib/services/fantasypros.ts
 * already found (api.fantasypros.com) — it also serves ROS rankings,
 * not just dynasty ECR, under the same auth/licensing tiers already
 * researched there (free key = sample data only, real access needs a
 * paid Premium or Commercial license). Nothing new to re-research; the
 * blocker is identical — a human has to create an account and pay/
 * negotiate a license.
 *
 * PFF: no public self-serve API for ROS rankings either (same finding
 * as lib/services/pff.ts) — PFF's rankings/projections products are
 * licensed business-to-business, not something to reverse-engineer.
 *
 * Both return empty until real access exists. Never fabricate a rank.
 */

export type ROSConsensusPlayer = {
  sleeperId: string | null;
  name: string;
  /** Consensus ROS rank — lower is better. Null fields are never filled with a guess. */
  fantasyProsRosRank: number | null;
  pffRosRank: number | null;
};

export async function getROSConsensusValues(): Promise<
  Map<string, ROSConsensusPlayer>
> {
  return new Map();
}

/**
 * A 0-1 consensus score for one player, where 1.0 is "best possible
 * consensus rank" — normalized against the size of the ranked pool so
 * it can blend with the other 0-1-scaled components. Returns null
 * (not 0) when no real consensus data exists, so callers can correctly
 * exclude this component from the blend rather than silently scoring a
 * real player as "worst possible" for lack of data.
 */
export function normalizeConsensusRank(
  rank: number | null,
  poolSize: number
): number | null {
  if (rank === null || poolSize <= 1) return null;
  return Math.max(0, Math.min(1, 1 - (rank - 1) / (poolSize - 1)));
}
