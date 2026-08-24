import { getPlayers, type NFLPlayer } from "@/lib/sleeper";
import { getROSStats, type ROSStats } from "./rosStatsService";
import { ROSTER_REQUIREMENTS } from "@/lib/config/rosValuationConfig";

export type ReplacementLevel = {
  position: "QB" | "RB" | "WR" | "TE";
  /** Overall rank at this position considered "replacement level" — the last player worth rostering given real league starting requirements. */
  replacementRank: number;
  replacementPPG: number;
};

const FANTASY_POSITIONS = ["QB", "RB", "WR", "TE"] as const;

/**
 * How many players at a position have real starting-lineup demand,
 * given ROSTER_REQUIREMENTS — not just "top N by some arbitrary cutoff."
 * FLEX slots are split across RB/WR/TE per the configured allocation
 * (not a measured fact, a documented estimate — see
 * lib/config/rosValuationConfig.ts).
 */
function replacementRankForPosition(position: (typeof FANTASY_POSITIONS)[number]): number {
  const { numTeams, starters, flexAllocation } = ROSTER_REQUIREMENTS;
  const flexShare = position === "QB" ? 0 : flexAllocation[position];
  const dedicatedStarters = starters[position];
  return Math.round(numTeams * (dedicatedStarters + flexShare * starters.FLEX));
}

/**
 * Position-specific replacement-level ROS production — brief section 4.
 * Deliberately NOT a simple "convert ranking into dollars": this finds
 * the real rest-of-season PPG of whichever player sits exactly at the
 * replacement-level rank for their position, using real Sleeper stats
 * (via rosStatsService), so marginal value (production above this
 * threshold) reflects actual league structure and real performance
 * data, not an arbitrary cutoff.
 */
export async function getReplacementLevels(
  precomputed?: { rosStats: Map<string, ROSStats>; players: NFLPlayer[] }
): Promise<Map<string, ReplacementLevel>> {
  const [rosStats, players] = precomputed
    ? [precomputed.rosStats, precomputed.players]
    : await Promise.all([getROSStats(), getPlayers()]);

  const byPosition = new Map<string, { playerId: string; weightedPPG: number }[]>();
  for (const player of players) {
    if (!FANTASY_POSITIONS.includes(player.position as (typeof FANTASY_POSITIONS)[number])) {
      continue;
    }
    const stats = rosStats.get(player.id);
    if (!stats || stats.gamesPlayed === 0) continue;

    const list = byPosition.get(player.position) ?? [];
    list.push({ playerId: player.id, weightedPPG: stats.weightedPPG });
    byPosition.set(player.position, list);
  }

  const levels = new Map<string, ReplacementLevel>();
  for (const position of FANTASY_POSITIONS) {
    const pool = (byPosition.get(position) ?? []).sort(
      (a, b) => b.weightedPPG - a.weightedPPG
    );
    const rank = replacementRankForPosition(position);
    // Clamp to the actual pool size — a shallow position pool (e.g. very
    // early season) shouldn't index past what real data exists for.
    const index = Math.min(rank, pool.length) - 1;
    const replacementPPG = pool[Math.max(0, index)]?.weightedPPG ?? 0;

    levels.set(position, { position, replacementRank: rank, replacementPPG });
  }

  return levels;
}
