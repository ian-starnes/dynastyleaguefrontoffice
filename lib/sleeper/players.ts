import { sleeperFetch } from "./client";
import type { NFLPlayer, SleeperPlayersMap, SleeperRawPlayer } from "./types";

const FANTASY_POSITIONS = new Set(["QB", "RB", "WR", "TE", "K", "DEF"]);

function isRosterEligible(
  player: SleeperRawPlayer
): player is SleeperRawPlayer & { position: string; team: string } {
  return (
    player.position !== null &&
    FANTASY_POSITIONS.has(player.position) &&
    player.team !== null
  );
}

/**
 * Sleeper's full player database includes every player it has ever tracked
 * — tens of thousands of entries, most retired or irrelevant to fantasy —
 * so this narrows it down to rostered-relevant fantasy positions with a
 * current NFL team.
 *
 * Sleeper also asks integrators to call this endpoint sparingly (at most
 * once a day), hence the long revalidate window.
 */
export async function getPlayers(): Promise<NFLPlayer[]> {
  const playersById = await sleeperFetch<SleeperPlayersMap>("/players/nfl", {
    next: { revalidate: 86400 },
  });

  return Object.values(playersById)
    .filter(isRosterEligible)
    .map(
      (player): NFLPlayer => ({
        id: player.player_id,
        fullName:
          player.full_name ??
          `${player.first_name ?? ""} ${player.last_name ?? ""}`.trim(),
        position: player.position,
        nflTeam: player.team,
      })
    )
    .sort((a, b) => a.fullName.localeCompare(b.fullName));
}
