import {
  getLeague,
  getRosters,
  getTradedPicksForLeague,
  getSleeperLeagueId,
  getDraftsForLeague,
} from "@/lib/sleeper";
import { getAuctionBudgetCredit } from "@/lib/config/auctionBudgetAppendixA";

/**
 * How many draft classes to consider as candidates for "future," starting
 * with the current season — the loop below drops the current season from
 * this window once its own real draft has completed (see
 * hasCurrentSeasonDrafted), so this stays 4 rather than 3: it needs to
 * cover BOTH the case where the current season hasn't drafted yet (a
 * real future asset, include it) and the common case where it has
 * (exclude it, leaving exactly 3 real future years — currentSeason+1
 * through currentSeason+3 — matching the DLFO brief's section 14
 * requirement to show every team's next 3 years). This league's own
 * traded_picks data only ever references up to 2 years out at the time
 * this was checked, so further-out years will mostly show each roster
 * still holding its own original picks — a correct default (Sleeper has
 * no trade to override), not a gap.
 */
const FUTURE_DRAFT_YEARS_TO_PROJECT = 4;

/**
 * Whether the CURRENT season's own real draft has already happened.
 * Confirmed live (direct API check across 2023-2026) that this league
 * runs exactly ONE draft object per season, type "auction" — there's no
 * separate rookie/snake draft. The numbered-round "future pick" credits
 * this file tracks (Appendix A) are a trade-value convention layered on
 * top of that single real event, not a second draft to check. Once that
 * season's auction is complete, its picks already turned into real
 * roster spots this year — they're no longer a FUTURE asset to project,
 * they're history. Only ever relevant for the CURRENT season: every
 * later season (currentSeason+1 and beyond) has no league object yet in
 * Sleeper at all, so it can't possibly have already drafted.
 */
async function hasCurrentSeasonDrafted(leagueId: string): Promise<boolean> {
  const drafts = await getDraftsForLeague(leagueId);
  return drafts.some((draft) => draft.type === "auction" && draft.status === "complete");
}

export type FuturePick = {
  season: number;
  round: number;
  originalRosterId: number;
  currentOwnerRosterId: number;
  /** The real Auction Budget Credit dollar value for this pick's round, per Appendix A — fixed, not discounted by years out. */
  value: number;
};

/**
 * Every future rookie draft pick in the league. Ownership defaults to each
 * roster's own original pick, then Sleeper's traded_picks overrides
 * whichever picks have actually changed hands. Value comes from the
 * real, commissioner-provided Appendix A table
 * (lib/config/auctionBudgetAppendixA.ts) — never computed here directly,
 * so there's one place that conversion lives, editable without touching
 * this file.
 */
export async function getFuturePicks(): Promise<FuturePick[]> {
  const leagueId = getSleeperLeagueId();

  const [league, rosters, tradedPicks, currentSeasonDrafted] = await Promise.all([
    getLeague(),
    getRosters(),
    getTradedPicksForLeague(leagueId),
    hasCurrentSeasonDrafted(leagueId),
  ]);

  const currentSeason = Number(league.season);
  const draftRounds = Number(league.settings.draft_rounds ?? 3);

  const currentOwnerRosterIdByPickKey = new Map<string, number>();
  for (const pick of tradedPicks) {
    currentOwnerRosterIdByPickKey.set(
      `${pick.season}:${pick.round}:${pick.roster_id}`,
      pick.owner_id
    );
  }

  // Start the FUTURE window at next season, not this one, once this
  // season's own draft has already happened — see hasCurrentSeasonDrafted.
  const firstFutureYearsOut = currentSeasonDrafted ? 1 : 0;

  const picks: FuturePick[] = [];
  for (let yearsOut = firstFutureYearsOut; yearsOut < FUTURE_DRAFT_YEARS_TO_PROJECT; yearsOut++) {
    const season = currentSeason + yearsOut;

    for (let round = 1; round <= draftRounds; round++) {
      for (const roster of rosters) {
        const currentOwnerRosterId =
          currentOwnerRosterIdByPickKey.get(
            `${season}:${round}:${roster.roster_id}`
          ) ?? roster.roster_id;

        picks.push({
          season,
          round,
          originalRosterId: roster.roster_id,
          currentOwnerRosterId,
          value: getAuctionBudgetCredit(round),
        });
      }
    }
  }

  return picks;
}

export type ProjectedAuctionBudget = {
  season: number;
  ownerId: string;
  /** $200 standard auction budget, adjusted only by real traded-round credits gained or given up for this season. */
  budget: number;
};

/**
 * A team's full draft-day auction budget for a projected season defaults
 * to the league's standard $200 — that's what "all rounds rostered"
 * (i.e., nothing traded away) is worth, since Appendix A's 15 rows sum
 * to exactly $200 by construction. This league's real draft only has
 * draft_rounds (3) actual tradeable rounds, so the $200 baseline already
 * bakes in the untradeable remainder (rounds 4-15) as a fixed
 * entitlement — trades can only move the REAL rounds (1-3), and each
 * one adjusts both sides' budget by that round's Appendix A credit:
 * the team that traded a pick away loses its credit, whoever acquired
 * it gains the same credit. Net effect across the whole league is
 * always zero, so total budget league-wide is always
 * numTeams * $200 for any given season, regardless of how much trading
 * happened.
 */
const STANDARD_AUCTION_BUDGET = 200;

export async function getProjectedAuctionBudgets(): Promise<ProjectedAuctionBudget[]> {
  const [picks, rosters] = await Promise.all([getFuturePicks(), getRosters()]);

  const ownerIdByRosterId = new Map(
    rosters.filter((r) => r.owner_id).map((r) => [r.roster_id, r.owner_id as string])
  );

  const netAdjustmentByKey = new Map<string, number>();
  function adjust(season: number, ownerId: string, delta: number) {
    const key = `${season}:${ownerId}`;
    netAdjustmentByKey.set(key, (netAdjustmentByKey.get(key) ?? 0) + delta);
  }

  for (const pick of picks) {
    if (pick.originalRosterId === pick.currentOwnerRosterId) continue; // untraded — no adjustment

    const originalOwnerId = ownerIdByRosterId.get(pick.originalRosterId);
    const currentOwnerId = ownerIdByRosterId.get(pick.currentOwnerRosterId);
    if (originalOwnerId) adjust(pick.season, originalOwnerId, -pick.value);
    if (currentOwnerId) adjust(pick.season, currentOwnerId, pick.value);
  }

  const seasons = [...new Set(picks.map((p) => p.season))];
  const ownerIds = [...ownerIdByRosterId.values()];

  const budgets: ProjectedAuctionBudget[] = [];
  for (const season of seasons) {
    for (const ownerId of ownerIds) {
      const adjustment = netAdjustmentByKey.get(`${season}:${ownerId}`) ?? 0;
      budgets.push({ season, ownerId, budget: STANDARD_AUCTION_BUDGET + adjustment });
    }
  }
  return budgets;
}
