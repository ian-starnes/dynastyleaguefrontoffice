import { getPlayers, getRosters, getOwners, type NFLPlayer } from "./sleeper";
import { getPlaceholderFantasyValue } from "./valuation/placeholder-fantasy-value";
import {
  getFantasyCalcValues,
  normalizePlayerName,
  type FantasyCalcPlayer,
} from "./services/fantasycalc";

/**
 * An NFL player in the context of one specific league — wraps the
 * immutable NFLPlayer (from Sleeper) with league-specific state.
 * Acquisition cost, keeper cost, contract years remaining, real Franchise
 * Value, and keeper surplus will all attach here as those features land.
 */
export type LeaguePlayer = {
  nflPlayer: NFLPlayer;
  currentOwnerId: string | null;
  currentOwnerName: string | null;
  /** Placeholder until DLFO's own Fantasy Value engine exists. */
  fantasyValue: number;
  /** Real dynasty market value from FantasyCalc; null if unmatched — never faked. */
  fantasyCalcValue: number | null;
};

/**
 * Joins Sleeper's NFL player data with this league's roster ownership and
 * FantasyCalc's market values — the first (and today, only) place an
 * NFLPlayer becomes a LeaguePlayer.
 */
export async function getLeaguePlayers(): Promise<LeaguePlayer[]> {
  const [[players, rosters, owners], fantasyCalcValues] = await Promise.all([
    Promise.all([getPlayers(), getRosters(), getOwners()]),
    // FantasyCalc is supplementary, not essential — if it's unreachable,
    // every player just shows "—" instead of taking down the whole page.
    getFantasyCalcValues().catch((error: unknown) => {
      console.error(
        "FantasyCalc fetch failed, showing — for all players:",
        error
      );
      return new Map<string, FantasyCalcPlayer>();
    }),
  ]);

  const ownerNameByUserId = new Map(
    owners.map((owner) => [
      owner.user_id,
      owner.metadata?.team_name ?? owner.display_name,
    ])
  );

  const ownerIdByPlayerId = new Map<string, string>();
  for (const roster of rosters) {
    if (!roster.owner_id || !roster.players) continue;
    for (const playerId of roster.players) {
      ownerIdByPlayerId.set(playerId, roster.owner_id);
    }
  }

  return players.map((nflPlayer) => {
    const ownerId = ownerIdByPlayerId.get(nflPlayer.id) ?? null;

    const fantasyCalcMatch =
      fantasyCalcValues.get(nflPlayer.id) ??
      fantasyCalcValues.get(normalizePlayerName(nflPlayer.fullName));

    return {
      nflPlayer,
      currentOwnerId: ownerId,
      currentOwnerName: ownerId
        ? ownerNameByUserId.get(ownerId) ?? null
        : null,
      fantasyValue: getPlaceholderFantasyValue(nflPlayer.id),
      fantasyCalcValue: fantasyCalcMatch?.value ?? null,
    };
  });
}
