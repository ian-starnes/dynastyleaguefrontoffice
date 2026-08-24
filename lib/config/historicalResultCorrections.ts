/**
 * Explicit, narrow overrides of specific historical results where the
 * league has directly confirmed Sleeper's own platform data disagrees
 * with what actually happened. This is NOT a general "in case of
 * disputes" mechanism — every entry here is one specific, confirmed
 * correction, with a reason documenting exactly what was checked before
 * accepting the override. Never add an entry to make a record "look
 * nicer"; only on direct, explicit confirmation that a specific real
 * result differs from what Sleeper's API reports.
 */

const CONFIRMED_2020_CHAMPIONSHIP_REASON =
  "Confirmed directly by the league: Young Guns (roster 1, managed by Starnz) beat Ol' 9 of Hearts (roster 6, managed that season by dchdch10) in the real Week 16 2020 championship. Before accepting this override, three independent Sleeper-sourced signals were checked — the winners_bracket endpoint's own recorded winner, the actual week-16 matchup scores (153.72-127.66), and the league object's own metadata.latest_league_winner_roster_id field — and all three agreed WITH EACH OTHER that roster 6 won, all three disagreeing with the real outcome per the league's direct account. Overridden anyway on that direct confirmation: what's in dispute is Sleeper's platform record of this one specific game, not DLFO's computation of it.";

export type WeeklyResultCorrection = {
  season: number;
  week: number;
  winningRosterId: number;
  losingRosterId: number;
  reason: string;
};

/** Applied in weeklyPerformanceService.ts — flips WeeklyPerformance.result for the two named rosters in this exact season/week, leaving the recorded point totals untouched (only the winner is disputed, not the scores). */
export const WEEKLY_RESULT_CORRECTIONS: WeeklyResultCorrection[] = [
  {
    season: 2020,
    week: 16,
    winningRosterId: 1,
    losingRosterId: 6,
    reason: CONFIRMED_2020_CHAMPIONSHIP_REASON,
  },
];

export type PlayoffPlacementCorrection = {
  season: number;
  /** roster_id -> corrected place, for only the placements that actually changed. */
  placeByRosterId: Record<number, number>;
  reason: string;
};

/** Applied in playoffResultsService.ts — overrides the final placements normalizePlayoffResults derived from Sleeper's bracket data, for the same confirmed game as WEEKLY_RESULT_CORRECTIONS above. */
export const PLAYOFF_PLACEMENT_CORRECTIONS: PlayoffPlacementCorrection[] = [
  {
    season: 2020,
    placeByRosterId: { 1: 1, 6: 2 },
    reason: CONFIRMED_2020_CHAMPIONSHIP_REASON,
  },
];
