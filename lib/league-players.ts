import { getPlayers, getRosters, getOwners, type NFLPlayer } from "./sleeper";
import {
  getFantasyCalcValues,
  normalizePlayerName,
  type FantasyCalcPlayer,
} from "./services/fantasycalc";
import { getFantasyProsValues } from "./services/fantasypros";
import {
  getPlaceholderKeeperCost,
  getPlaceholderYearsRemaining,
} from "./valuation/placeholder-contract";

/**
 * An NFL player in the context of one specific league — wraps the
 * immutable NFLPlayer (from Sleeper) with league-specific state. Every
 * asset DLFO tracks is Player + Contract + Economics; this type is all
 * three combined.
 */
export type LeaguePlayer = {
  nflPlayer: NFLPlayer;
  currentOwnerId: string | null;
  currentOwnerName: string | null;

  /**
   * The player's real-world talent/production value. Sourced entirely
   * from FantasyCalc today (lib/services/fantasycalc.ts); null if
   * unmatched — never faked.
   *
   * TODO(market-value-blend): eventually this becomes a blend —
   *   Market Value = FantasyCalc + FantasyPros + PFF + DLFO Projection Engine
   * Not implemented yet. FantasyCalc is the sole input for now.
   */
  marketValue: number | null;
  /** Real 30-day value change from FantasyCalc; null if unmatched. */
  marketValueTrend30Day: number | null;
  /**
   * Real Expert Consensus Ranking from FantasyPros; always null today — no
   * licensed API key exists yet. See lib/services/fantasypros.ts for why,
   * and what's needed to turn this on. Not displayed until it's real.
   */
  fantasyProsECR: number | null;

  /**
   * Contract economics. keeperCost and yearsRemaining are PLACEHOLDERS —
   * see lib/valuation/placeholder-contract.ts for the deterministic
   * stand-in generator and the documented (not yet implemented) real
   * contract rules governing how these actually change over time.
   */
  keeperCost: number;
  yearsRemaining: number;

  /**
   * Keeper Surplus = Market (Auction) Value − Keeper Cost.
   *
   * TODO(auction-value): once real auction values exist, swap
   * marketValue below for auctionValue in this formula. marketValue is a
   * stand-in until then.
   *
   * Null whenever marketValue is null — surplus is meaningless without a
   * real value to weigh the contract against.
   */
  keeperSurplus: number | null;

  /**
   * Asset Value = Market Value + Keeper Surplus. DLFO's primary ranking —
   * "how good is the player" combined with "how good is the contract."
   */
  assetValue: number | null;

  // Reserved for future features — never populated yet.
  auctionValue?: number;
  pffGrade?: number;
};

/**
 * Joins Sleeper's NFL player data with this league's roster ownership and
 * every valuation/economics source DLFO knows about — the first (and
 * today, only) place an NFLPlayer becomes a LeaguePlayer.
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

    const marketValue = fantasyCalcMatch?.value ?? null;
    const keeperCost = getPlaceholderKeeperCost(nflPlayer.id, marketValue);
    const yearsRemaining = getPlaceholderYearsRemaining(nflPlayer.id);

    // See the TODO(auction-value) note on LeaguePlayer above — marketValue
    // stands in for auctionValue until that's implemented.
    const keeperSurplus =
      marketValue !== null ? marketValue - keeperCost : null;
    const assetValue =
      marketValue !== null ? marketValue + (keeperSurplus as number) : null;

    return {
      nflPlayer,
      currentOwnerId: ownerId,
      currentOwnerName: ownerId
        ? ownerNameByUserId.get(ownerId) ?? null
        : null,
      marketValue,
      marketValueTrend30Day: fantasyCalcMatch?.trend30Day ?? null,
      fantasyProsECR: fantasyProsMatch?.ecr ?? null,
      keeperCost,
      yearsRemaining,
      keeperSurplus,
      assetValue,
    };
  });
}

/**
 * Single-player lookup for the profile page/drawer. Thin wrapper around
 * getLeaguePlayers() rather than a separate fetch path — Next's fetch
 * cache already dedupes the underlying Sleeper/FantasyCalc requests, so
 * this isn't a wasted refetch of ~1000 players just to show one.
 */
export async function getLeaguePlayer(
  playerId: string
): Promise<LeaguePlayer | null> {
  const players = await getLeaguePlayers();
  return players.find((player) => player.nflPlayer.id === playerId) ?? null;
}
