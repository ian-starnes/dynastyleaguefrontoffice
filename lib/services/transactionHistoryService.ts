import {
  getLeagueSeasonChain,
  getAllTransactionsForLeague,
  getRostersForLeague,
  getOwnersForLeague,
  getDraftsForLeague,
  getDraftPicks,
  getSleeperLeagueId,
} from "@/lib/sleeper";

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
  const fullChain = await getLeagueSeasonChain(getSleeperLeagueId());

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

      const ownerIdByRosterId = new Map(
        rosters.map((roster) => [roster.roster_id, roster.owner_id])
      );
      const ownerNameByOwnerId = new Map(
        owners.map((owner) => [
          owner.user_id,
          owner.metadata?.team_name ?? owner.display_name,
        ])
      );

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
            ownerName: ownerId ? ownerNameByOwnerId.get(ownerId) ?? null : null,
            price: Number(pick.metadata.amount),
          });
        }
      }

      return { transactions, ownerIdByRosterId, ownerNameByOwnerId, auctionPurchases };
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

  for (const { transactions, ownerIdByRosterId, ownerNameByOwnerId, auctionPurchases: seasonPurchases } of perSeason) {
    auctionPurchases.push(...seasonPurchases);

    for (const transaction of transactions) {
      if (transaction.status !== "complete") continue;

      if (transaction.type === "trade") {
        for (const rosterId of transaction.roster_ids) {
          const ownerId = ownerIdByRosterId.get(rosterId);
          if (!ownerId) continue;
          getStats(ownerId, ownerNameByOwnerId.get(ownerId) ?? null).trades += 1;
        }
      } else if (transaction.type === "waiver") {
        const faabBid = transaction.settings?.waiver_bid ?? 0;
        for (const rosterId of transaction.roster_ids) {
          const ownerId = ownerIdByRosterId.get(rosterId);
          if (!ownerId) continue;
          const stats = getStats(ownerId, ownerNameByOwnerId.get(ownerId) ?? null);
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
