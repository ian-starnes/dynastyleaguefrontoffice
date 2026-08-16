import { sql } from "@/lib/db/client";
import type { WeeklyPerformance } from "@/lib/models";

type WeeklyPerformanceRow = {
  league_id: string;
  season: number;
  week: number;
  roster_id: number;
  matchup_id: number | null;
  opponent_roster_id: number | null;
  team_score: string;
  opponent_score: string | null;
  result: string | null;
  starters: string[];
  bench: string[];
  points_by_player: Record<string, number>;
};

function rowToWeeklyPerformance(row: WeeklyPerformanceRow): WeeklyPerformance {
  return {
    leagueId: row.league_id,
    season: row.season,
    week: row.week,
    rosterId: row.roster_id,
    matchupId: row.matchup_id,
    opponentRosterId: row.opponent_roster_id,
    teamScore: Number(row.team_score),
    opponentScore: row.opponent_score !== null ? Number(row.opponent_score) : null,
    result: row.result as WeeklyPerformance["result"],
    starterPlayerIds: row.starters,
    benchPlayerIds: row.bench,
    pointsByPlayerId: row.points_by_player,
  };
}

/**
 * The raw weekly-scoring source — Ring of Honor, head-to-head, PPG, and
 * league records all read from here rather than recomputing from Sleeper
 * matchups on every request. Idempotent on (league_id, season, week,
 * roster_id), same pattern as every other repository in this codebase.
 */
export class WeeklyPerformanceRepository {
  async upsertWeeklyPerformance(performance: WeeklyPerformance): Promise<void> {
    await sql`
      insert into weekly_performances (
        league_id, season, week, roster_id, matchup_id, opponent_roster_id,
        team_score, opponent_score, result, starters, bench, points_by_player
      )
      values (
        ${performance.leagueId}, ${performance.season}, ${performance.week},
        ${performance.rosterId}, ${performance.matchupId}, ${performance.opponentRosterId},
        ${performance.teamScore}, ${performance.opponentScore}, ${performance.result},
        ${JSON.stringify(performance.starterPlayerIds)},
        ${JSON.stringify(performance.benchPlayerIds)},
        ${JSON.stringify(performance.pointsByPlayerId)}
      )
      on conflict (league_id, season, week, roster_id) do update set
        matchup_id = excluded.matchup_id,
        opponent_roster_id = excluded.opponent_roster_id,
        team_score = excluded.team_score,
        opponent_score = excluded.opponent_score,
        result = excluded.result,
        starters = excluded.starters,
        bench = excluded.bench,
        points_by_player = excluded.points_by_player
    `;
  }

  async getWeeklyPerformancesForLeague(
    leagueId: string
  ): Promise<WeeklyPerformance[]> {
    const rows = (await sql`
      select league_id, season, week, roster_id, matchup_id, opponent_roster_id,
             team_score, opponent_score, result, starters, bench, points_by_player
      from weekly_performances
      where league_id = ${leagueId}
      order by season asc, week asc
    `) as WeeklyPerformanceRow[];
    return rows.map(rowToWeeklyPerformance);
  }

  async getWeeklyPerformancesForRoster(
    leagueId: string,
    season: number,
    rosterId: number
  ): Promise<WeeklyPerformance[]> {
    const rows = (await sql`
      select league_id, season, week, roster_id, matchup_id, opponent_roster_id,
             team_score, opponent_score, result, starters, bench, points_by_player
      from weekly_performances
      where league_id = ${leagueId} and season = ${season} and roster_id = ${rosterId}
      order by week asc
    `) as WeeklyPerformanceRow[];
    return rows.map(rowToWeeklyPerformance);
  }
}
