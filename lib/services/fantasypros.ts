/**
 * FantasyPros' dynasty consensus-rankings endpoint (api.fantasypros.com),
 * wired up with a real key (FANTASYPROS_API_KEY in .env.local) — see
 * rosConsensusService.ts's doc comment for the confirmed tier history
 * (started free/10-player-capped, later confirmed upgraded to Premium's
 * real full pool; nothing here special-cases either one). Confirmed
 * live: `type=DYNASTY` returns real, current dynasty ECR (e.g. Ja'Marr
 * Chase #1 overall as of testing) — no preseason-staleness caveat like
 * the ROS type has, since dynasty rankings aren't tied to a single
 * season's games.
 */

import { normalizePlayerName } from "./fantasycalc";

const FANTASYPROS_API_BASE_URL = "https://api.fantasypros.com/public/v2/json/nfl";
/** Dynasty rankings aren't season-scoped in practice, but the endpoint requires a year — the current one always returns FantasyPros' latest dynasty consensus. */
const DYNASTY_RANKINGS_SEASON = new Date().getFullYear().toString();

export type FantasyProsPlayer = {
  name: string;
  sleeperId: string | null;
  ecr: number;
};

type FantasyProsRankingsResponse = {
  players: { player_name: string; rank_ecr: number }[];
};

async function fetchFantasyProsDynastyRankings(): Promise<FantasyProsRankingsResponse> {
  const apiKey = process.env.FANTASYPROS_API_KEY;
  if (!apiKey) {
    throw new Error("FANTASYPROS_API_KEY is not set");
  }

  const url = `${FANTASYPROS_API_BASE_URL}/${DYNASTY_RANKINGS_SEASON}/consensus-rankings?type=DYNASTY&position=ALL&scoring=HALF`;
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
 * Real FantasyPros dynasty ECR, indexed by normalized player name — same
 * resilience standard as every other optional source: a missing key,
 * outage, or rate limit just leaves this null for every player (rendered
 * as "—"), never fabricated, and never allowed to take down anything else.
 */
export async function getFantasyProsValues(): Promise<
  Map<string, FantasyProsPlayer>
> {
  const values = new Map<string, FantasyProsPlayer>();

  if (!process.env.FANTASYPROS_API_KEY) return values;

  try {
    const data = await fetchFantasyProsDynastyRankings();
    for (const player of data.players) {
      values.set(normalizePlayerName(player.player_name), {
        name: player.player_name,
        sleeperId: null,
        ecr: player.rank_ecr,
      });
    }
  } catch (error: unknown) {
    console.error("FantasyPros dynasty ECR fetch failed, showing — for all players:", error);
  }

  return values;
}
