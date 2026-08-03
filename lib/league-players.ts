import { getPlayers, getRosters, getOwners, type NFLPlayer } from "./sleeper";
import {
  getFantasyCalcValues,
  normalizePlayerName,
  type FantasyCalcPlayer,
} from "./services/fantasycalc";
import { getFantasyProsValues } from "./services/fantasypros";
import { calculateAssetEconomics } from "./services/assetCalculator";
import { convertFantasyCalcToMarketValue } from "./services/marketValueService";
import { getPlaceholderContractFacts } from "./valuation/placeholder-contract";

/**
 * An NFL player in the context of one specific league — wraps the
 * immutable NFLPlayer (from Sleeper) with league-specific state. Every
 * asset DLFO tracks is Player + Contract + Economics; this type is all
 * three combined.
 *
 * Every economic field here is in auction dollars ($) — the currency
 * used at the real draft table — not FantasyCalc points. FantasyCalc is
 * an input to marketValue, not the value itself. marketValue, keeperCost,
 * keeperSurplus, and assetValue are all computed exclusively by
 * lib/services/assetCalculator.ts — nothing else in the codebase does
 * that arithmetic.
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

  /** Estimated auction market value, in dollars. See assetCalculator.ts. */
  marketValue: number | null;

  /**
   * Real Expert Consensus Ranking from FantasyPros; always null today — no
   * licensed API key exists yet. See lib/services/fantasypros.ts for why,
   * and what's needed to turn this on. Not displayed until it's real.
   */
  fantasyProsECR: number | null;

  /**
   * Contract facts, all in dollars/years. originalAuctionPrice, draftYear,
   * and keeperYearsRemaining are all PLACEHOLDERS today — see
   * lib/valuation/placeholder-contract.ts for the generator and the
   * documented (not yet implemented) real contract rules. Once
   * lib/repositories/AssetRepository.ts is wired to real Postgres facts
   * (backed by the historical import — see lib/import/leagueImportService.ts
   * and lib/repositories/AuctionRecordRepository.ts), these come from
   * there instead, with zero dependency on marketValue/fantasyCalc.
   */
  originalAuctionPrice: number;
  draftYear: number;
  keeperYearsRemaining: number;

  /** keeperCost, keeperSurplus, assetValue: see assetCalculator.ts. */
  keeperCost: number;
  keeperSurplus: number | null;
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

    // Placeholder facts until AssetRepository has real rows to read
    // instead — anchored off marketValue purely so the placeholder looks
    // plausible relative to it (see placeholder-contract.ts's doc comment).
    const marketValueEstimate =
      fantasyCalc !== null ? convertFantasyCalcToMarketValue(fantasyCalc) : null;

    const { originalAuctionPrice, draftYear, keeperYearsRemaining } =
      getPlaceholderContractFacts(nflPlayer.id, marketValueEstimate);

    const { marketValue, keeperCost, keeperSurplus, assetValue } =
      calculateAssetEconomics({
        fantasyCalc,
        originalAuctionPrice,
        keeperYearsRemaining,
      });

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
      draftYear,
      keeperYearsRemaining,
      keeperCost,
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
