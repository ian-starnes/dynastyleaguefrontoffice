import {
  getLeagueSeasonChain,
  getRostersForLeague,
  getOwnersForLeague,
  getWinnersBracketForLeague,
  getLosersBracketForLeague,
  getSleeperLeagueId,
} from "@/lib/sleeper";
import { normalizePlayoffResults } from "@/lib/import/normalizer";
import type { PlayoffResult } from "@/lib/models";

export type OwnerPlayoffResult = PlayoffResult & {
  ownerId: string | null;
  ownerName: string | null;
};

/**
 * Live equivalent of what lib/import/leagueImportService.ts writes to the
 * playoff_results table — no database exists yet to read that back from.
 * Reuses Phase 3's normalizePlayoffResults (including the losers-bracket
 * offset fix) for every COMPLETED season in the chain. Confirmed live
 * across all 6 completed seasons: winners_bracket always covers places
 * 1-6 (playoff_teams), losers_bracket always covers 7-10 — same
 * structure every year in this league, not assumed from one season.
 */
export async function getAllPlayoffResults(): Promise<OwnerPlayoffResult[]> {
  const fullChain = await getLeagueSeasonChain(getSleeperLeagueId());

  const perSeason = await Promise.all(
    fullChain
      .filter((league) => league.status === "complete")
      .map(async (league) => {
        const season = Number(league.season);
        const playoffTeams = Number(league.settings.playoff_teams ?? 6);

        const [winners, losers, rosters, owners] = await Promise.all([
          getWinnersBracketForLeague(league.league_id),
          getLosersBracketForLeague(league.league_id),
          getRostersForLeague(league.league_id),
          getOwnersForLeague(league.league_id),
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

        return normalizePlayoffResults(
          league.league_id,
          season,
          winners,
          losers,
          playoffTeams
        ).map((result): OwnerPlayoffResult => {
          const ownerId = ownerIdByRosterId.get(result.rosterId) ?? null;
          return {
            ...result,
            ownerId,
            ownerName: ownerId ? ownerNameByOwnerId.get(ownerId) ?? null : null,
          };
        });
      })
  );

  return perSeason.flat();
}
