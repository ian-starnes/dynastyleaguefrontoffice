/** One season of the league, as Sleeper created it. Chains via previousLeagueId. */
export type League = {
  leagueId: string;
  season: number;
  name: string;
  previousLeagueId: string | null;
  settings: Record<string, unknown>;
};
