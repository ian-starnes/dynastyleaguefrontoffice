import { getPlayers, getRosters, getOwners, type NFLPlayer } from "./sleeper";
import { getPlaceholderFantasyValue } from "./valuation/placeholder-fantasy-value";

/**
 * An NFL player in the context of one specific league — wraps the
 * immutable NFLPlayer (from Sleeper) with league-specific state. Only
 * ownership and a placeholder Fantasy Value exist today; acquisition cost,
 * keeper cost, contract years remaining, real Franchise Value, keeper
 * surplus, and trade value will all attach here as those features land.
 */
export type LeaguePlayer = {
  nflPlayer: NFLPlayer;
  currentOwnerId: string | null;
  currentOwnerName: string | null;
  fantasyValue: number;
};

/**
 * Joins Sleeper's NFL player data with this league's roster ownership —
 * the first (and today, only) place an NFLPlayer becomes a LeaguePlayer.
 */
export async function getLeaguePlayers(): Promise<LeaguePlayer[]> {
  const [players, rosters, owners] = await Promise.all([
    getPlayers(),
    getRosters(),
    getOwners(),
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

    return {
      nflPlayer,
      currentOwnerId: ownerId,
      currentOwnerName: ownerId
        ? ownerNameByUserId.get(ownerId) ?? null
        : null,
      fantasyValue: getPlaceholderFantasyValue(nflPlayer.id),
    };
  });
}
