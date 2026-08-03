import {
  getLeague,
  getRosters,
  getTradedPicksForLeague,
  getSleeperLeagueId,
} from "@/lib/sleeper";
import { getDraftPickValue } from "./draftPickValueService";

/**
 * How many upcoming draft classes to project, starting with the current
 * season (included even if it hasn't happened yet — verified this
 * league's 2026 rookie draft is still "pre_draft"). This league's own
 * traded_picks data only ever references up to 2 draft years out (2026,
 * 2027 at the time this was checked), matching typical dynasty trading
 * convention — adjust here if that changes.
 */
const FUTURE_DRAFT_YEARS_TO_PROJECT = 2;

export type FuturePick = {
  season: number;
  round: number;
  originalRosterId: number;
  currentOwnerRosterId: number;
  value: number;
};

/**
 * Every future rookie draft pick in the league. Ownership defaults to each
 * roster's own original pick, then Sleeper's traded_picks overrides
 * whichever picks have actually changed hands. Value comes from
 * lib/services/draftPickValueService.ts — never computed here directly,
 * so there's one place that formula lives.
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
          value: getDraftPickValue(round, yearsOut),
        });
      }
    }
  }

  return picks;
}
