import {
  getLeague,
  getRosters,
  getTradedPicksForLeague,
  getSleeperLeagueId,
} from "@/lib/sleeper";
import { getAuctionBudgetCredit } from "@/lib/config/auctionBudgetAppendixA";

/**
 * How many upcoming draft classes to project, starting with the current
 * season (included even if it hasn't happened yet — verified this
 * league's 2026 rookie draft is still "pre_draft"). Set to 4 so this
 * covers currentSeason (2026) through 2029 — the DLFO brief's section 14
 * explicitly asks for every team to show projected budgets for 2027,
 * 2028, and 2029. This league's own traded_picks data only ever
 * references up to 2 years out at the time this was checked, so further-
 * out years will mostly show each roster still holding its own original
 * picks — a correct default (Sleeper has no trade to override), not a
 * gap.
 */
const FUTURE_DRAFT_YEARS_TO_PROJECT = 4;

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

  const [league, rosters, tradedPicks] = await Promise.all([
    getLeague(),
    getRosters(),
    getTradedPicksForLeague(leagueId),
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

  const picks: FuturePick[] = [];
  for (let yearsOut = 0; yearsOut < FUTURE_DRAFT_YEARS_TO_PROJECT; yearsOut++) {
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
