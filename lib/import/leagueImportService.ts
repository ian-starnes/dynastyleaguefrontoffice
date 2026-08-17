import {
  getLeagueSeasonChain,
  getRostersForLeague,
  getOwnersForLeague,
  getDraftsForLeague,
  getDraftPicks,
  getAllTransactionsForLeague,
  getAllMatchupsForLeague,
  getWinnersBracketForLeague,
  getLosersBracketForLeague,
} from "@/lib/sleeper";
import {
  LeagueRepository,
  OwnerRepository,
  TeamRepository,
  TransactionRepository,
  AuctionRecordRepository,
  TradeRepository,
  WeeklyPerformanceRepository,
  KeeperDeclarationRepository,
  PlayoffResultRepository,
} from "@/lib/repositories";
import {
  normalizeOwner,
  normalizeTeam,
  normalizeTransaction,
  normalizeAuctionRecord,
  normalizeTrade,
  normalizeWeekMatchups,
  normalizeKeeperDeclarations,
  normalizePlayoffResults,
} from "./normalizer";

export type ImportSummary = {
  seasonsProcessed: number;
  ownersWritten: number;
  teamsWritten: number;
  transactionsWritten: number;
  auctionRecordsWritten: number;
  tradesWritten: number;
  weeklyPerformancesWritten: number;
  keeperDeclarationsWritten: number;
  playoffResultsWritten: number;
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
  const weeklyPerformanceRepository = new WeeklyPerformanceRepository();
  const keeperDeclarationRepository = new KeeperDeclarationRepository();
  const playoffResultRepository = new PlayoffResultRepository();

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
  let weeklyPerformancesWritten = 0;
  let keeperDeclarationsWritten = 0;
  let playoffResultsWritten = 0;

  for (const sleeperLeague of seasonChain) {
    const leagueId = sleeperLeague.league_id;
    const season = Number(sleeperLeague.season);
    const isCompleteSeason = sleeperLeague.status === "complete";
    onProgress(`Season ${season} (${leagueId})...`);

    await leagueRepository.upsertLeague({
      leagueId,
      season,
      name: sleeperLeague.name,
      previousLeagueId: sleeperLeague.previous_league_id,
      settings: sleeperLeague.settings,
    });

    // Playoff brackets only exist once a season has actually run its
    // playoffs — an in-progress or pre_draft season's bracket endpoints
    // return empty arrays anyway, so skip the calls entirely for a season
    // that hasn't reached them rather than write meaningless placement rows.
    const [rosters, users, drafts, transactions, weeks, winnersBracket, losersBracket] =
      await Promise.all([
        getRostersForLeague(leagueId),
        getOwnersForLeague(leagueId),
        getDraftsForLeague(leagueId),
        getAllTransactionsForLeague(leagueId).catch((error: unknown) => {
          console.error(`Transactions fetch failed for season ${season}:`, error);
          return [];
        }),
        getAllMatchupsForLeague(leagueId).catch((error: unknown) => {
          console.error(`Matchups fetch failed for season ${season}:`, error);
          return [];
        }),
        isCompleteSeason
          ? getWinnersBracketForLeague(leagueId).catch((error: unknown) => {
              console.error(`Winners bracket fetch failed for season ${season}:`, error);
              return [];
            })
          : Promise.resolve([]),
        isCompleteSeason
          ? getLosersBracketForLeague(leagueId).catch((error: unknown) => {
              console.error(`Losers bracket fetch failed for season ${season}:`, error);
              return [];
            })
          : Promise.resolve([]),
      ]);

    // Owners must be written before teams — teams.owner_id has a foreign
    // key into owners(owner_id), so a team referencing an owner that
    // doesn't exist yet fails the constraint.
    for (const user of users) {
      await ownerRepository.upsertOwner(normalizeOwner(user));
      ownersWritten++;
    }

    const rosterIdToOwnerId = new Map<number, string>();
    for (const roster of rosters) {
      await teamRepository.upsertTeam(normalizeTeam(leagueId, roster));
      teamsWritten++;
      if (roster.owner_id) {
        rosterIdToOwnerId.set(roster.roster_id, roster.owner_id);
      }
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

    for (const { week, matchups } of weeks) {
      if (matchups.length === 0) continue;
      for (const performance of normalizeWeekMatchups(leagueId, season, week, matchups)) {
        await weeklyPerformanceRepository.upsertWeeklyPerformance(performance);
        weeklyPerformancesWritten++;
      }
    }

    for (const declaration of normalizeKeeperDeclarations(leagueId, season, rosters)) {
      await keeperDeclarationRepository.upsertKeeperDeclaration(declaration);
      keeperDeclarationsWritten++;
    }

    if (isCompleteSeason) {
      const playoffTeams = Number(sleeperLeague.settings.playoff_teams ?? 6);
      for (const result of normalizePlayoffResults(
        leagueId,
        season,
        winnersBracket,
        losersBracket,
        playoffTeams
      )) {
        await playoffResultRepository.upsertPlayoffResult(result);
        playoffResultsWritten++;
      }
    }

    onProgress(
      `  -> ${rosters.length} teams, ${users.length} owners, ${transactions.length} transactions, ` +
        `${weeks.reduce((sum, w) => sum + w.matchups.length, 0)} matchup-rosters`
    );
  }

  return {
    seasonsProcessed: seasonChain.length,
    ownersWritten,
    teamsWritten,
    transactionsWritten,
    auctionRecordsWritten,
    tradesWritten,
    weeklyPerformancesWritten,
    keeperDeclarationsWritten,
    playoffResultsWritten,
  };
}
