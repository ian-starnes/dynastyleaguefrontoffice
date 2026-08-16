import { sql } from "@/lib/db/client";
import type { PlayoffResult } from "@/lib/models";

type PlayoffResultRow = {
  league_id: string;
  season: number;
  roster_id: number;
  place: number;
};

function rowToPlayoffResult(row: PlayoffResultRow): PlayoffResult {
  return {
    leagueId: row.league_id,
    season: row.season,
    rosterId: row.roster_id,
    place: row.place,
  };
}

/** Final per-season standings, reconstructed from Sleeper's playoff brackets — powers Wall of Champions. */
export class PlayoffResultRepository {
  async upsertPlayoffResult(result: PlayoffResult): Promise<void> {
    await sql`
      insert into playoff_results (league_id, season, roster_id, place)
      values (${result.leagueId}, ${result.season}, ${result.rosterId}, ${result.place})
      on conflict (league_id, season, roster_id) do update set
        place = excluded.place
    `;
  }

  async getPlayoffResultsForLeague(leagueId: string): Promise<PlayoffResult[]> {
    const rows = (await sql`
      select league_id, season, roster_id, place
      from playoff_results
      where league_id = ${leagueId}
      order by season asc, place asc
    `) as PlayoffResultRow[];
    return rows.map(rowToPlayoffResult);
  }
}
