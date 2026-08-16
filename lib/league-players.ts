import { getPlayers, getRosters, getOwners, type NFLPlayer } from "./sleeper";
import {
  getFantasyCalcValues,
  normalizePlayerName,
  type FantasyCalcPlayer,
} from "./services/fantasycalc";
import { getFantasyProsValues } from "./services/fantasypros";
import { calculateAssetEconomics, MAX_KEEPER_YEARS } from "./services/assetCalculator";
import {
  getPriorSeasonAuctionData,
  type PriorSeasonAuctionData,
} from "./services/auctionHistoryService";
import { getKeeperClocks, type KeeperClock } from "./services/keeperClockService";
import {
  getContractLineages,
  type ContractLineage,
} from "./services/contractLineageService";
import type { AcquisitionType, AssetRecord } from "./models";

// Any currently-rostered player not found in the prior season's auction
// (picked up via waiver/free agency since) is a $5 contract by convention.
const UNDRAFTED_CONTRACT_PRICE = 5;

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
   * Contract facts, all real now — no more placeholders anywhere in this
   * pipeline. originalAuctionPrice and draftYear come from the prior
   * season's actual auction (lib/services/auctionHistoryService.ts), or
   * the $5 undrafted convention for a rostered player who wasn't part of
   * it. keeperYearsRemaining comes from reconstructing ownership across
   * seasons (lib/services/keeperClockService.ts) — a fresh
   * MAX_KEEPER_YEARS clock for anyone not currently rostered, since there's
   * no ownership continuity to trace for them.
   */
  originalAuctionPrice: number;
  draftYear: number;
  keeperYearsRemaining: number;

  /** keeperCost, keeperSurplus, assetValue: see assetCalculator.ts. */
  keeperCost: number;
  keeperSurplus: number | null;
  assetValue: number | null;

  /**
   * The real contract lineage — see lib/services/contractLineageService.ts.
   * A free agent / unrostered player has no lineage to trace (no roster to
   * walk), so these default to a fresh, as-of-now contract: contractStartSeason
   * = current season, no draft owner, acquisitionType "undrafted".
   */
  contractStartSeason: number;
  originalDraftOwnerId: string | null;
  originalDraftOwnerName: string | null;
  acquisitionType: AcquisitionType;
  /** Epoch ms — only set for trade/waiver/free_agent acquisitions. */
  acquisitionDate: number | null;

  // Reserved for future features — never populated yet.
  pffGrade?: number;
};

/**
 * Joins Sleeper's NFL player data with this league's roster ownership and
 * every valuation/economics source DLFO knows about — the first (and
 * today, only) place an NFLPlayer becomes a LeaguePlayer.
 */
export async function getLeaguePlayers(): Promise<LeaguePlayer[]> {
  const [
    [players, rosters, owners],
    fantasyCalcValues,
    fantasyProsValues,
    priorSeasonAuctionData,
    keeperClocks,
    contractLineages,
  ] = await Promise.all([
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
    // Same resilience pattern — if Sleeper's historical endpoints hiccup,
    // everyone just falls back to the $5 undrafted convention.
    getPriorSeasonAuctionData().catch((error: unknown) => {
      console.error(
        "Prior season auction fetch failed, treating everyone as undrafted:",
        error
      );
      return null as PriorSeasonAuctionData | null;
    }),
    getKeeperClocks().catch((error: unknown) => {
      console.error(
        "Keeper clock reconstruction failed, treating everyone as a fresh contract:",
        error
      );
      return new Map<string, KeeperClock>();
    }),
    getContractLineages().catch((error: unknown) => {
      console.error(
        "Contract lineage tracing failed, treating everyone as undrafted:",
        error
      );
      return new Map<string, ContractLineage>();
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

    const fantasyProsMatch =
      fantasyProsValues.get(nflPlayer.id) ??
      fantasyProsValues.get(normalizePlayerName(nflPlayer.fullName));

    const fantasyCalc = fantasyCalcMatch?.value ?? null;

    const priorSeason = priorSeasonAuctionData?.season ?? 2025;
    const currentSeason = priorSeason + 1;

    const realAuctionPrice = priorSeasonAuctionData?.pricesByPlayerId.get(
      nflPlayer.id
    );
    const originalAuctionPrice = realAuctionPrice ?? UNDRAFTED_CONTRACT_PRICE;
    // Real prices come from exactly one season back (priorSeason); the $5
    // undrafted convention is a fresh, as-of-now price (currentSeason) —
    // so yearsSincePriceSet is 1 for the former, 0 for the latter.
    const draftYear = realAuctionPrice !== undefined ? priorSeason : currentSeason;
    const yearsSincePriceSet = currentSeason - draftYear;

    const keeperYearsRemaining =
      keeperClocks.get(nflPlayer.id)?.keeperYearsRemaining ?? MAX_KEEPER_YEARS;

    const { marketValue, keeperCost, keeperSurplus, assetValue } =
      calculateAssetEconomics({
        fantasyCalc,
        originalAuctionPrice,
        yearsSincePriceSet,
      });

    const lineage = contractLineages.get(nflPlayer.id);

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
      contractStartSeason: lineage?.contractStartSeason ?? currentSeason,
      originalDraftOwnerId: lineage?.originalDraftOwner ?? null,
      originalDraftOwnerName: lineage?.originalDraftOwner
        ? ownerNameByUserId.get(lineage.originalDraftOwner) ?? null
        : null,
      acquisitionType: lineage?.acquisitionType ?? "undrafted",
      acquisitionDate: lineage?.acquisitionDate ?? null,
    };
  });
}

/**
 * Maps a fully-computed LeaguePlayer down to AssetRecord — the stored
 * FACTS shape lib/repositories/AssetRepository.ts persists. Completes the
 * Asset valuation engine end-to-end: every field AssetRecord needs is now
 * genuinely computed (contract lineage via
 * lib/services/contractLineageService.ts, everything else already real),
 * so this is a pure reshape, not a placeholder. No database exists yet to
 * call AssetRepository.upsertAsset with the result — this only removes
 * "there's nothing to feed it" as a blocker once one does.
 */
export function toAssetRecord(leagueId: string, player: LeaguePlayer): AssetRecord {
  return {
    leagueId,
    playerId: player.nflPlayer.id,
    currentOwnerId: player.currentOwnerId,
    originalAuctionPrice: player.originalAuctionPrice,
    keeperYearsRemaining: player.keeperYearsRemaining,
    draftYear: player.draftYear,
    contractStartSeason: player.contractStartSeason,
    acquisitionType: player.acquisitionType,
    acquisitionDate: player.acquisitionDate,
    originalDraftOwner: player.originalDraftOwnerId,
  };
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
