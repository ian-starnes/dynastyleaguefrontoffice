/**
 * Component C of the ROS valuation engine: current-season consensus
 * rankings/projections — explicitly NOT dynasty ECR (lib/services/
 * fantasypros.ts's existing stub is dynasty-scoped and stays that way
 * for whatever future dynasty-ECR use case it was built for; this is a
 * separate, ROS-specific input).
 *
 * FantasyPros: real, documented API (api.fantasypros.com), wired up with
 * a real key (FANTASYPROS_API_KEY in .env.local). Tier confirmed live via
 * the response's own tier/count/limit fields, not assumed from the key
 * alone — it started on the free tier (tier: "free", capped to the top
 * 10 players regardless of query params) and was later confirmed upgraded
 * to Premium (tier: "premium", the real full player pool, ~900+ players).
 * No code here special-cases either tier; it just processes whatever
 * data.players comes back, so the upgrade needed no changes.
 *
 * Confirmed live which ranking "type" to request and when:
 *   - Their "ROS" type is only actively maintained DURING a season — as
 *     of the 2026 preseason, it still returned 2025 season data
 *     (last_updated "12/25", a full season stale), not a real current
 *     signal.
 *   - Their "DRAFT" type (redraft startup rankings) IS actively
 *     maintained pre-season (confirmed last_updated "8/25" for the 2026
 *     season, current as of testing).
 * So this uses DRAFT rankings before the real NFL regular season starts,
 * and switches to ROS rankings once it has (see resolveRankingsRequest) —
 * per explicit direction, not a guess.
 *
 * PFF: no public self-serve API for ROS rankings (same finding as
 * lib/services/pff.ts) — PFF's rankings/projections products are
 * licensed business-to-business, not something to reverse-engineer.
 * pffRosRank stays null until that access exists.
 */

import { getNflState, type SleeperNflState } from "@/lib/sleeper";
import { normalizePlayerName } from "./fantasycalc";

const FANTASYPROS_API_BASE_URL = "https://api.fantasypros.com/public/v2/json/nfl";

export type ROSConsensusPlayer = {
  sleeperId: string | null;
  name: string;
  /** e.g. "RB", "WR" — needed so rank/pool size stay position-relative, not cross-position. */
  position: string | null;
  /**
   * Consensus rank WITHIN this player's position (e.g. 3 for "the #3
   * consensus RB") — lower is better. Deliberately NOT FantasyPros'
   * overall rank_ecr: confirmed live (real 2026 draft rankings) that
   * normalizing an overall rank against the full ~940-player
   * cross-position pool compresses real separation among elite players
   * at one position to near-nothing (a real 6-spot overall gap between
   * two top backs became a ~0.006 score difference on a 0-1 scale) —
   * exactly the kind of top-of-market signal Component C exists to
   * provide. Position rank + a position-scoped pool size (see
   * rosValuationService.ts) fixes this. Null fields are never filled
   * with a guess.
   */
  fantasyProsRosRank: number | null;
  pffRosRank: number | null;
};

type FantasyProsRankingsResponse = {
  players: {
    player_name: string;
    player_position_id: string;
    /** e.g. "RB3" — position abbreviation followed by the position-specific rank. */
    pos_rank: string;
  }[];
};

/** Parses FantasyPros' "RB3"-style pos_rank into the numeric 3. Returns null if the format ever doesn't match (never guess a rank). */
function parsePositionRank(posRank: string): number | null {
  const match = /(\d+)$/.exec(posRank);
  return match ? Number(match[1]) : null;
}

/**
 * DRAFT before the real season starts (FantasyPros doesn't refresh ROS
 * rankings until it does — confirmed live, see doc comment above); ROS
 * once it has. "Started" means the same real signal rosStatsService.ts
 * already uses for its own current-vs-fallback decision: regular season
 * underway, or in the real NFL playoffs.
 */
function resolveRankingsRequest(
  state: SleeperNflState
): { type: "ROS" | "DRAFT"; season: string } {
  const seasonHasStarted = state.season_type === "regular" || state.season_type === "post";
  return { type: seasonHasStarted ? "ROS" : "DRAFT", season: state.season };
}

async function fetchFantasyProsRankings(
  type: "ROS" | "DRAFT",
  season: string
): Promise<FantasyProsRankingsResponse> {
  const apiKey = process.env.FANTASYPROS_API_KEY;
  if (!apiKey) {
    throw new Error("FANTASYPROS_API_KEY is not set");
  }

  const url = `${FANTASYPROS_API_BASE_URL}/${season}/consensus-rankings?type=${type}&position=ALL&scoring=HALF`;
  const response = await fetch(url, {
    headers: { "x-api-key": apiKey },
    next: { revalidate: 3600 },
  });

  if (!response.ok) {
    throw new Error(`FantasyPros API request failed with status ${response.status}`);
  }

  return response.json() as Promise<FantasyProsRankingsResponse>;
}

/**
 * Real FantasyPros consensus, indexed by normalized player name — their
 * API exposes no Sleeper ID (confirmed live), so sleeperId here is
 * always null; callers match by name (see rosValuationService.ts).
 *
 * Resilient by design: a missing key, an API outage, or a rate limit
 * only costs Component C (this returns empty, same as the pre-real-key
 * stub) — it must never take down the rest of the ROS valuation engine,
 * which is the same resilience standard every other optional source in
 * this codebase already follows. Never fabricate a rank on failure.
 */
export async function getROSConsensusValues(): Promise<
  Map<string, ROSConsensusPlayer>
> {
  const values = new Map<string, ROSConsensusPlayer>();

  if (!process.env.FANTASYPROS_API_KEY) return values;

  try {
    const state = await getNflState();
    const { type, season } = resolveRankingsRequest(state);
    const data = await fetchFantasyProsRankings(type, season);

    for (const player of data.players) {
      values.set(normalizePlayerName(player.player_name), {
        sleeperId: null,
        name: player.player_name,
        position: player.player_position_id ?? null,
        fantasyProsRosRank: parsePositionRank(player.pos_rank),
        pffRosRank: null,
      });
    }
  } catch (error: unknown) {
    console.error(
      "FantasyPros consensus rankings fetch failed, Component C excluded from this computation:",
      error
    );
  }

  return values;
}

/**
 * A 0-1 consensus score for one player, where 1.0 is "best possible
 * consensus rank" — normalized against the size of the ranked pool so
 * it can blend with the other 0-1-scaled components. Returns null
 * (not 0) when no real consensus data exists, so callers can correctly
 * exclude this component from the blend rather than silently scoring a
 * real player as "worst possible" for lack of data.
 *
 * rank and poolSize must be from the SAME position pool (see
 * ROSConsensusPlayer.fantasyProsRosRank's doc comment) — passing an
 * overall cross-position rank/pool here reproduces the exact top-of-
 * market compression bug this was fixed for. rosValuationService.ts
 * additionally converts this 0-1 score into a real z-score (not a naive
 * linear rescale) before blending, so separation among elite players
 * survives all the way through.
 */
export function normalizeConsensusRank(
  rank: number | null,
  poolSize: number
): number | null {
  if (rank === null || poolSize <= 1) return null;
  return Math.max(0, Math.min(1, 1 - (rank - 1) / (poolSize - 1)));
}
