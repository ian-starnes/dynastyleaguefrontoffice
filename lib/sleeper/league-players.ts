import { getPlayers } from "./players";
import { getRosters } from "./rosters";
import { getOwners } from "./owners";
import type { LeaguePlayer } from "./types";

/**
 * Joins Sleeper's NFL player data with this league's roster ownership —
 * the first (and today, only) place an NFLPlayer becomes a LeaguePlayer.
 * Acquisition cost, keeper cost, contract years, franchise value, keeper
 * surplus, and trade value will all attach here as those features land.
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

  const ownerNameByPlayerId = new Map<string, string>();
  for (const roster of rosters) {
    const ownerName = roster.owner_id
      ? ownerNameByUserId.get(roster.owner_id)
      : undefined;
    if (!ownerName || !roster.players) continue;

    for (const playerId of roster.players) {
      ownerNameByPlayerId.set(playerId, ownerName);
    }
  }

  return players.map((nflPlayer) => ({
    nflPlayer,
    currentOwnerName: ownerNameByPlayerId.get(nflPlayer.id) ?? null,
  }));
}
