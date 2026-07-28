import { getPlayers, getRosters, getOwners, type NFLPlayer } from "./sleeper";
import {
  getFantasyCalcValues,
  normalizePlayerName,
  type FantasyCalcPlayer,
} from "./services/fantasycalc";
import { getFantasyProsValues } from "./services/fantasypros";

/**
 * An NFL player in the context of one specific league — wraps the
 * immutable NFLPlayer (from Sleeper) with league-specific state.
 */
export type LeaguePlayer = {
  nflPlayer: NFLPlayer;
  currentOwnerId: string | null;
  currentOwnerName: string | null;
  /** Real dynasty market value from FantasyCalc; null if unmatched — never faked. */
  fantasyCalcValue: number | null;
  /**
   * Real Expert Consensus Ranking from FantasyPros; always null today — no
   * licensed API key exists yet. See lib/services/fantasypros.ts for why,
   * and what's needed to turn this on. Not displayed until it's real.
   */
  fantasyProsECR: number | null;

  // Reserved for future DLFO-native features (keeper contracts, Franchise
  // Value, trade analysis). Intentionally never populated yet — only
  // present so the type is ready when those get built.
  dlfoValue?: number;
  keeperCost?: number;
  keeperYearsRemaining?: number;
  surplusValue?: number;
  auctionValue?: number;
  pffGrade?: number;
};

/**
 * Joins Sleeper's NFL player data with this league's roster ownership and
 * every player-valuation source DLFO knows about — the first (and today,
 * only) place an NFLPlayer becomes a LeaguePlayer.
 */
export async function getLeaguePlayers(): Promise<LeaguePlayer[]> {
  const [[players, rosters, owners], fantasyCalcValues, fantasyProsValues] =
    await Promise.all([
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
      // Stubbed until a licensed FantasyPros key exists — resolves to an
      // empty map today, so every match below is a no-op (null).
      getFantasyProsValues(),
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

    const fantasyProsMatch =
      fantasyProsValues.get(nflPlayer.id) ??
      fantasyProsValues.get(normalizePlayerName(nflPlayer.fullName));

    return {
      nflPlayer,
      currentOwnerId: ownerId,
      currentOwnerName: ownerId
        ? ownerNameByUserId.get(ownerId) ?? null
        : null,
      fantasyCalcValue: fantasyCalcMatch?.value ?? null,
      fantasyProsECR: fantasyProsMatch?.ecr ?? null,
    };
  });
}
