import {
  getLeagueSeasonChain,
  getAllTransactionsForLeague,
  getRostersForLeague,
  getOwnersForLeague,
  getDraftsForLeague,
  getDraftPicks,
  getSleeperLeagueId,
} from "@/lib/sleeper";
import { getFranchiseIdentityMap, canonicalizeOwnerId } from "./franchiseIdentityService";

export type OwnerTransactionStats = {
  ownerId: string;
  ownerName: string | null;
  trades: number;
  waiverClaims: number;
  faabSpent: number;
};

export type AuctionPurchase = {
  season: number;
  playerId: string;
  ownerId: string | null;
  ownerName: string | null;
  price: number;
};

/**
 * All-time trade/waiver-claim/FAAB totals per owner, and every real
 * auction-era purchase ever made — powers League Records' "Most trades",
 * "Most waiver claims", "Most FAAB spent", and "Highest auction
 * purchase". Live equivalent of reading this back from a database (none
 * exists yet) — walks the full season chain once.
 */
export async function getTransactionHistory(): Promise<{
  statsByOwnerId: Map<string, OwnerTransactionStats>;
  auctionPurchases: AuctionPurchase[];
}> {
  const [fullChain, franchiseIdentity] = await Promise.all([
    getLeagueSeasonChain(getSleeperLeagueId()),
    getFranchiseIdentityMap(),
  ]);

  const perSeason = await Promise.all(
    fullChain.map(async (league) => {
      const [transactions, rosters, owners, drafts] = await Promise.all([
        getAllTransactionsForLeague(league.league_id).catch((error: unknown) => {
          console.error(
            `Transactions fetch failed for season ${league.season} in transaction history:`,
            error
          );
          return [];
        }),
        getRostersForLeague(league.league_id),
        getOwnersForLeague(league.league_id),
        getDraftsForLeague(league.league_id),
      ]);

      const rawOwnerNameByOwnerId = new Map(
        owners.map((owner) => [
          owner.user_id,
          owner.metadata?.team_name ?? owner.display_name,
        ])
      );

      // Canonicalized once per roster_id here, up front, so every
      // downstream use (auction purchases, trades, waivers) below
      // automatically attributes to whoever currently manages this
      // franchise instead of whichever account held it that season.
      const ownerIdByRosterId = new Map<number, string | null>();
      const ownerNameByRosterId = new Map<number, string | null>();
      for (const roster of rosters) {
        if (!roster.owner_id) {
          ownerIdByRosterId.set(roster.roster_id, null);
          continue;
        }
        const ownerId = canonicalizeOwnerId(roster.owner_id, franchiseIdentity);
        ownerIdByRosterId.set(roster.roster_id, ownerId);
        ownerNameByRosterId.set(
          roster.roster_id,
          franchiseIdentity.currentOwnerName.get(ownerId) ??
            rawOwnerNameByOwnerId.get(roster.owner_id) ??
            null
        );
      }

      const auctionDraft = drafts.find(
        (draft) => draft.type === "auction" && draft.status === "complete"
      );
      const auctionPurchases: AuctionPurchase[] = [];
      if (auctionDraft) {
        const picks = await getDraftPicks(auctionDraft.draft_id);
        for (const pick of picks) {
          if (!pick.metadata?.amount) continue;
          const ownerId = ownerIdByRosterId.get(pick.roster_id) ?? null;
          auctionPurchases.push({
            season: Number(league.season),
            playerId: pick.player_id,
            ownerId,
            ownerName: ownerId ? ownerNameByRosterId.get(pick.roster_id) ?? null : null,
            price: Number(pick.metadata.amount),
          });
        }
      }

      return { transactions, ownerIdByRosterId, ownerNameByRosterId, auctionPurchases };
    })
  );

  const statsByOwnerId = new Map<string, OwnerTransactionStats>();
  function getStats(ownerId: string, ownerName: string | null) {
    const existing = statsByOwnerId.get(ownerId);
    if (existing) return existing;
    const created: OwnerTransactionStats = {
      ownerId,
      ownerName,
      trades: 0,
      waiverClaims: 0,
      faabSpent: 0,
    };
    statsByOwnerId.set(ownerId, created);
    return created;
  }

  const auctionPurchases: AuctionPurchase[] = [];

  for (const { transactions, ownerIdByRosterId, ownerNameByRosterId, auctionPurchases: seasonPurchases } of perSeason) {
    auctionPurchases.push(...seasonPurchases);

    for (const transaction of transactions) {
      if (transaction.status !== "complete") continue;

      if (transaction.type === "trade") {
        for (const rosterId of transaction.roster_ids) {
          const ownerId = ownerIdByRosterId.get(rosterId);
          if (!ownerId) continue;
          getStats(ownerId, ownerNameByRosterId.get(rosterId) ?? null).trades += 1;
        }
      } else if (transaction.type === "waiver") {
        const faabBid = transaction.settings?.waiver_bid ?? 0;
        for (const rosterId of transaction.roster_ids) {
          const ownerId = ownerIdByRosterId.get(rosterId);
          if (!ownerId) continue;
          const stats = getStats(ownerId, ownerNameByRosterId.get(rosterId) ?? null);
          stats.waiverClaims += 1;
          stats.faabSpent += faabBid;
        }
      }
    }
  }

  // A trade transaction lists every involved roster_id once — no
  // double-counting risk since each roster_id only appears once per
  // transaction in Sleeper's own data.
  return { statsByOwnerId, auctionPurchases };
}
