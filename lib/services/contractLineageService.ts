import {
  getLeagueSeasonChain,
  getRostersForLeague,
  getDraftsForLeague,
  getDraftPicks,
  getAllTransactionsForLeague,
  getSleeperLeagueId,
  type SleeperDraftPick,
} from "@/lib/sleeper";
import type { AcquisitionType } from "@/lib/models";

export type ContractLineage = {
  /**
   * The season this player's contract lineage actually began — found by
   * walking the auction-era draft picks backward while is_keeper stays
   * true, REGARDLESS of ownership changes in between. Confirmed live
   * (Phase 5 research): a player's recorded price keeps incrementing by
   * exactly $5/year through real trades in this league's history (10
   * separate 2024->2025 examples, all +$5, all with a different
   * roster_id) — so lineage tracing doesn't need to special-case trades,
   * only follow is_keeper continuity.
   *
   * LIMITATION: this league's real auction-dollar history only goes back
   * to 2023 (2020-2022 were snake drafts with no price data — confirmed
   * in the Phase 1 audit). A player kept continuously since before 2023
   * will be reported with contractStartSeason = 2023, which may
   * understate their true origin season — that's the earliest season
   * this can verify, not an assumption that 2023 is when they started.
   */
  contractStartSeason: number;
  originalDraftOwner: string | null;
  acquisitionType: AcquisitionType;
  /** Epoch ms — only set for trade/waiver/free_agent; auction/keeper/undrafted have no exact date, only a season. */
  acquisitionDate: number | null;
};

type AuctionSeason = {
  season: number;
  /** When this season's auction actually concluded (Sleeper's last_picked) — used to order it against real transactions. */
  concludedAt: number;
  picksByPlayerId: Map<string, SleeperDraftPick>;
  ownerIdByRosterId: Map<number, string | null>;
};

type TracedLineage = {
  contractStartSeason: number;
  originalDraftOwner: string | null;
  /** The newest season this player has ANY auction pick — not necessarily part of the contiguous keeper chain. */
  mostRecentAuctionSeason: number;
  mostRecentAuctionConcludedAt: number;
};

/**
 * Walks the auction-era chain (2023+ in this league) backward from the
 * most recent pick for a player, following is_keeper continuity through
 * CONTIGUOUS seasons only — a gap year (no pick recorded) or an
 * is_keeper=false/None pick both end the walk, since either means "this
 * season's presence isn't a continuation of the season before it."
 */
function traceLineage(
  playerId: string,
  auctionSeasonsAsc: AuctionSeason[]
): TracedLineage | null {
  const seasonsWithPick = auctionSeasonsAsc.filter((s) =>
    s.picksByPlayerId.has(playerId)
  );
  if (seasonsWithPick.length === 0) return null;

  const mostRecent = seasonsWithPick[seasonsWithPick.length - 1];

  let index = seasonsWithPick.length - 1;
  while (index > 0) {
    const current = seasonsWithPick[index];
    const pick = current.picksByPlayerId.get(playerId)!;
    if (!pick.is_keeper) break;

    const previous = seasonsWithPick[index - 1];
    if (previous.season !== current.season - 1) break; // gap year — chain doesn't actually connect

    index--;
  }

  const originSeason = seasonsWithPick[index];
  const originPick = originSeason.picksByPlayerId.get(playerId)!;

  return {
    contractStartSeason: originSeason.season,
    originalDraftOwner: originSeason.ownerIdByRosterId.get(originPick.roster_id) ?? null,
    mostRecentAuctionSeason: mostRecent.season,
    mostRecentAuctionConcludedAt: mostRecent.concludedAt,
  };
}

/**
 * For every currently-rostered player, the real contract lineage and how
 * the CURRENT owner came to hold them — the "auction/keeper/contract
 * ledger" the DLFO brief asks for, computed live (no database exists yet
 * to read this back from persisted auction_records/transactions).
 *
 * Two independent sources, combined by actual chronological order:
 * 1. Auction-era draft picks (2023+), walked backward via is_keeper to
 *    find contractStartSeason/originalDraftOwner — see traceLineage.
 * 2. The full multi-season transaction log, to find the most recent real
 *    add event (trade/waiver/free_agent) for each player.
 *
 * CAUGHT DURING VERIFICATION, not assumed correct: a draft-day keeper
 * pick is never a Sleeper "transaction," so an early version of this
 * function treated "the latest transaction ever" as always authoritative
 * — which was wrong. Real example: Puka Nacua was traded in Sept 2023,
 * but has been auctioned/kept fresh every season since (confirmed via
 * the is_keeper chain) — the 2023 trade is no longer how his CURRENT
 * owner holds him. Fixed by comparing the latest transaction's real
 * timestamp against the most recent auction pick's actual completion
 * time (Sleeper's draft.last_picked, not an approximate season anchor)
 * — whichever is chronologically later wins. Absence of any transaction
 * after the most recent auction pick means the player has been kept
 * continuously since that pick, with no trade/waiver in between.
 */
export async function getContractLineages(): Promise<Map<string, ContractLineage>> {
  const rootLeagueId = getSleeperLeagueId();
  const fullChain = await getLeagueSeasonChain(rootLeagueId); // oldest first
  const currentSeason = Number(fullChain[fullChain.length - 1].season);

  const [auctionSeasonsRaw, transactionsPerSeason] = await Promise.all([
    Promise.all(
      fullChain.map(async (league) => {
        const drafts = await getDraftsForLeague(league.league_id);
        const auctionDraft = drafts.find(
          (draft) => draft.type === "auction" && draft.status === "complete"
        );
        if (!auctionDraft) return null;

        const [picks, rosters] = await Promise.all([
          getDraftPicks(auctionDraft.draft_id),
          getRostersForLeague(league.league_id),
        ]);

        return {
          season: Number(league.season),
          concludedAt: auctionDraft.last_picked,
          picksByPlayerId: new Map(picks.map((pick) => [pick.player_id, pick])),
          ownerIdByRosterId: new Map(
            rosters.map((roster) => [roster.roster_id, roster.owner_id])
          ),
        } satisfies AuctionSeason;
      })
    ),
    Promise.all(
      fullChain.map((league) =>
        getAllTransactionsForLeague(league.league_id).catch((error: unknown) => {
          console.error(
            `Transactions fetch failed for season ${league.season} while tracing contract lineage:`,
            error
          );
          return [];
        })
      )
    ),
  ]);

  const auctionSeasonsAsc = auctionSeasonsRaw.filter(
    (season): season is AuctionSeason => season !== null
  );

  const latestAddTransactionByPlayerId = new Map<
    string,
    { type: string; createdAt: number }
  >();
  for (const seasonTransactions of transactionsPerSeason) {
    for (const transaction of seasonTransactions) {
      if (transaction.status !== "complete" || !transaction.adds) continue;
      for (const playerId of Object.keys(transaction.adds)) {
        const existing = latestAddTransactionByPlayerId.get(playerId);
        if (!existing || transaction.created > existing.createdAt) {
          latestAddTransactionByPlayerId.set(playerId, {
            type: transaction.type,
            createdAt: transaction.created,
          });
        }
      }
    }
  }

  // Every player with SOME real signal — drafted at any point, or added
  // via any transaction — not just currently-rostered ones. A free agent
  // who was genuinely drafted (e.g. kept for a season, then dropped)
  // still has a real contractStartSeason/originalDraftOwner worth
  // showing; scoping this to current rosters only would silently regress
  // that back to "undrafted" for anyone not presently held by a team.
  const allKnownPlayerIds = new Set<string>();
  for (const season of auctionSeasonsAsc) {
    for (const playerId of season.picksByPlayerId.keys()) allKnownPlayerIds.add(playerId);
  }
  for (const playerId of latestAddTransactionByPlayerId.keys()) {
    allKnownPlayerIds.add(playerId);
  }

  const lineages = new Map<string, ContractLineage>();

  for (const playerId of allKnownPlayerIds) {
    const lineage = traceLineage(playerId, auctionSeasonsAsc);
    const latestAdd = latestAddTransactionByPlayerId.get(playerId);

    // Whichever happened LATER — the most recent auction pick, or the
    // most recent transaction — is the true current acquisition event.
    const transactionIsMostRecent =
      latestAdd !== undefined &&
      (!lineage || latestAdd.createdAt > lineage.mostRecentAuctionConcludedAt);

    let acquisitionType: AcquisitionType;
    let acquisitionDate: number | null = null;

    if (transactionIsMostRecent) {
      acquisitionType =
        latestAdd!.type === "trade"
          ? "trade"
          : latestAdd!.type === "waiver"
            ? "waiver"
            : "free_agent";
      acquisitionDate = latestAdd!.createdAt;
    } else if (lineage) {
      acquisitionType = lineage.mostRecentAuctionSeason === currentSeason ? "auction" : "keeper";
    } else {
      acquisitionType = "undrafted";
    }

    lineages.set(playerId, {
      contractStartSeason: lineage?.contractStartSeason ?? currentSeason,
      originalDraftOwner: lineage?.originalDraftOwner ?? null,
      acquisitionType,
      acquisitionDate,
    });
  }

  return lineages;
}
