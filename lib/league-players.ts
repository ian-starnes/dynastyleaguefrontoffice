import { getPlayers, getRosters, getOwners, type NFLPlayer } from "./sleeper";
import {
  getFantasyCalcValues,
  normalizePlayerName,
  type FantasyCalcPlayer,
} from "./services/fantasycalc";
import { getFantasyProsValues } from "./services/fantasypros";
import { convertFantasyCalcToMarketValue } from "./services/marketValueService";
import { getPlaceholderContract } from "./valuation/placeholder-contract";

/**
 * An NFL player in the context of one specific league — wraps the
 * immutable NFLPlayer (from Sleeper) with league-specific state. Every
 * asset DLFO tracks is Player + Contract + Economics; this type is all
 * three combined.
 *
 * Every economic field here is in auction dollars ($) — the currency
 * used at the real draft table — not FantasyCalc points. FantasyCalc is
 * an input to marketValue, not the value itself.
 */
export type LeaguePlayer = {
  nflPlayer: NFLPlayer;
  currentOwnerId: string | null;
  currentOwnerName: string | null;

  /**
   * Raw FantasyCalc dynasty value, in FantasyCalc points — not dollars.
   * No longer DLFO's primary valuation metric; kept in the data model as
   * the input to marketValue, but hidden from the default table view.
   * Null if unmatched — never faked.
   */
  fantasyCalc: number | null;
  /** Real 30-day point change from FantasyCalc; null if unmatched. */
  fantasyCalcTrend30Day: number | null;

  /**
   * Estimated auction market value, in dollars — DLFO's real currency,
   * the same one used at the actual draft table. Converted from
   * fantasyCalc via lib/services/marketValueService.ts. Null whenever
   * fantasyCalc is null (nothing to convert).
   */
  marketValue: number | null;

  /**
   * Real Expert Consensus Ranking from FantasyPros; always null today — no
   * licensed API key exists yet. See lib/services/fantasypros.ts for why,
   * and what's needed to turn this on. Not displayed until it's real.
   */
  fantasyProsECR: number | null;

  /**
   * Contract fields, all in dollars. originalAuctionPrice, keeperCost,
   * draftYear, and keeperYearsRemaining are all PLACEHOLDERS today — see
   * lib/valuation/placeholder-contract.ts for the generator and the
   * documented (not yet implemented) real contract rules. Once
   * lib/auction-history.ts is populated with real results, these come
   * from there instead, with zero dependency on marketValue/fantasyCalc.
   */
  originalAuctionPrice: number;
  keeperCost: number;
  draftYear: number;
  keeperYearsRemaining: number;

  /**
   * Keeper Surplus = Market Value − Keeper Cost, in dollars. Null
   * whenever marketValue is null — surplus is meaningless without a real
   * value to weigh the contract against.
   */
  keeperSurplus: number | null;

  /**
   * Asset Value = Market Value + Keeper Surplus, in dollars. DLFO's
   * primary ranking — "how good is the player" combined with "how good
   * is the contract."
   */
  assetValue: number | null;

  // Reserved for future features — never populated yet.
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

    const fantasyCalc = fantasyCalcMatch?.value ?? null;
    const marketValue =
      fantasyCalc !== null ? convertFantasyCalcToMarketValue(fantasyCalc) : null;

    const { originalAuctionPrice, keeperCost, draftYear, keeperYearsRemaining } =
      getPlaceholderContract(nflPlayer.id, marketValue);

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
      fantasyCalc,
      fantasyCalcTrend30Day: fantasyCalcMatch?.trend30Day ?? null,
      marketValue,
      fantasyProsECR: fantasyProsMatch?.ecr ?? null,
      originalAuctionPrice,
      keeperCost,
      draftYear,
      keeperYearsRemaining,
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
