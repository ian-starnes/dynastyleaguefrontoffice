import {
  getLeagueSeasonChain,
  getRostersForLeague,
  getOwnersForLeague,
  getDraftsForLeague,
  getDraftPicks,
  getAllTransactionsForLeague,
} from "@/lib/sleeper";
import {
  LeagueRepository,
  OwnerRepository,
  TeamRepository,
  TransactionRepository,
  AuctionRecordRepository,
  TradeRepository,
} from "@/lib/repositories";
import {
  normalizeOwner,
  normalizeTeam,
  normalizeTransaction,
  normalizeAuctionRecord,
  normalizeTrade,
} from "./normalizer";

export type ImportSummary = {
  seasonsProcessed: number;
  ownersWritten: number;
  teamsWritten: number;
  transactionsWritten: number;
  auctionRecordsWritten: number;
  tradesWritten: number;
};

/**
 * The whole pipeline: Sleeper API -> raw JSON -> normalizer -> repositories
 * -> database. Walks the previous_league_id chain live from Sleeper (see
 * lib/sleeper/league.ts's getLeagueSeasonChain) so it discovers every
 * season back to Day 1 from a single root league_id — no manual list of
 * historical league_ids to maintain.
 *
 * Every write goes through a repository's upsert, keyed on a natural
 * Sleeper ID, so running this again over unchanged data is always a safe
 * no-op — safe to schedule/re-run, never produces duplicates.
 */
export async function importLeague(
  rootLeagueId: string,
  onProgress: (message: string) => void = () => {}
): Promise<ImportSummary> {
  const leagueRepository = new LeagueRepository();
  const ownerRepository = new OwnerRepository();
  const teamRepository = new TeamRepository();
  const transactionRepository = new TransactionRepository();
  const auctionRecordRepository = new AuctionRecordRepository();
  const tradeRepository = new TradeRepository();

  onProgress("Walking Sleeper's season chain from the root league...");
  const seasonChain = await getLeagueSeasonChain(rootLeagueId);
  onProgress(
    `Found ${seasonChain.length} season(s): ${seasonChain.map((l) => l.season).join(", ")}`
  );

  let ownersWritten = 0;
  let teamsWritten = 0;
  let transactionsWritten = 0;
  let auctionRecordsWritten = 0;
  let tradesWritten = 0;

  for (const sleeperLeague of seasonChain) {
    const leagueId = sleeperLeague.league_id;
    const season = Number(sleeperLeague.season);
    onProgress(`Season ${season} (${leagueId})...`);

    await leagueRepository.upsertLeague({
      leagueId,
      season,
      name: sleeperLeague.name,
      previousLeagueId: sleeperLeague.previous_league_id,
      settings: sleeperLeague.settings,
    });

    const [rosters, users, drafts, transactions] = await Promise.all([
      getRostersForLeague(leagueId),
      getOwnersForLeague(leagueId),
      getDraftsForLeague(leagueId),
      getAllTransactionsForLeague(leagueId).catch((error: unknown) => {
        console.error(`Transactions fetch failed for season ${season}:`, error);
        return [];
      }),
    ]);

    const rosterIdToOwnerId = new Map<number, string>();
    for (const roster of rosters) {
      await teamRepository.upsertTeam(normalizeTeam(leagueId, roster));
      teamsWritten++;
      if (roster.owner_id) {
        rosterIdToOwnerId.set(roster.roster_id, roster.owner_id);
      }
    }

    for (const user of users) {
      await ownerRepository.upsertOwner(normalizeOwner(user));
      ownersWritten++;
    }

    // Auction/keeper history — only meaningful for a completed auction-type
    // draft. A snake draft's picks have no metadata.amount to read.
    for (const draft of drafts) {
      if (draft.type !== "auction" || draft.status !== "complete") continue;

      const picks = await getDraftPicks(draft.draft_id);
      for (const pick of picks) {
        if (!pick.metadata?.amount) continue;
        await auctionRecordRepository.upsertAuctionRecord(
          normalizeAuctionRecord(leagueId, season, pick, rosterIdToOwnerId)
        );
        auctionRecordsWritten++;
      }
    }

    // Every transaction gets a raw ledger row; trades additionally get the
    // richer TradeRecord.
    for (const transaction of transactions) {
      await transactionRepository.upsertTransaction(
        normalizeTransaction(leagueId, transaction)
      );
      transactionsWritten++;

      if (transaction.type === "trade") {
        await tradeRepository.upsertTrade(normalizeTrade(leagueId, transaction));
        tradesWritten++;
      }
    }

    onProgress(
      `  -> ${rosters.length} teams, ${users.length} owners, ${transactions.length} transactions`
    );
  }

  return {
    seasonsProcessed: seasonChain.length,
    ownersWritten,
    teamsWritten,
    transactionsWritten,
    auctionRecordsWritten,
    tradesWritten,
  };
}
