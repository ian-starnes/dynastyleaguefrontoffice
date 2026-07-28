// FantasyCalc's dynasty market values are scoped to a league format (team
// count, QB slots, PPR). Hardcoded to match this league for now — once
// DLFO supports multiple leagues these need to come from each league's
// actual Sleeper settings instead.
const FANTASYCALC_API_URL = "https://api.fantasycalc.com/values/current";
const LEAGUE_NUM_TEAMS = 10;
const LEAGUE_NUM_QBS = 1;
const LEAGUE_PPR = 0.5;

type FantasyCalcApiEntry = {
  player: {
    id: number;
    name: string;
    sleeperId?: string | null;
    position: string;
    maybeTeam?: string | null;
  };
  value: number;
};

export type FantasyCalcPlayer = {
  fantasyCalcId: number;
  name: string;
  sleeperId: string | null;
  position: string;
  team: string | null;
  value: number;
};

/**
 * Lowercases and strips accents, punctuation, and common suffixes (Jr, Sr,
 * II–V) so the same player's name compares equal across sources that
 * format it slightly differently (e.g. "A.J. Brown" vs "AJ Brown").
 */
export function normalizePlayerName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[.'']/g, "")
    .replace(/\b(jr|sr|ii|iii|iv|v)\b/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchFantasyCalcEntries(): Promise<FantasyCalcApiEntry[]> {
  const url = `${FANTASYCALC_API_URL}?isDynasty=true&numQbs=${LEAGUE_NUM_QBS}&numTeams=${LEAGUE_NUM_TEAMS}&ppr=${LEAGUE_PPR}`;

  const response = await fetch(url, { next: { revalidate: 3600 } });

  if (!response.ok) {
    throw new Error(
      `FantasyCalc API request failed with status ${response.status}`
    );
  }

  return response.json() as Promise<FantasyCalcApiEntry[]>;
}

/**
 * Fetches current FantasyCalc dynasty market values and indexes them for
 * lookup by either Sleeper player ID or normalized player name — whichever
 * a caller has on hand. Both key types share one map safely: Sleeper IDs
 * are numeric strings, normalized names never are, so they can't collide.
 *
 * (Two real players sharing a normalized name would collide on that key —
 * an accepted, rare edge case for the name-only fallback path; the Sleeper
 * ID match is exact and takes priority wherever it's available.)
 */
export async function getFantasyCalcValues(): Promise<
  Map<string, FantasyCalcPlayer>
> {
  const entries = await fetchFantasyCalcEntries();
  const values = new Map<string, FantasyCalcPlayer>();

  for (const entry of entries) {
    const player: FantasyCalcPlayer = {
      fantasyCalcId: entry.player.id,
      name: entry.player.name,
      sleeperId: entry.player.sleeperId ?? null,
      position: entry.player.position,
      team: entry.player.maybeTeam ?? null,
      value: entry.value,
    };

    if (player.sleeperId) {
      values.set(player.sleeperId, player);
    }
    values.set(normalizePlayerName(player.name), player);
  }

  return values;
}
