import { sql } from "@/lib/db/client";
import type { League } from "@/lib/models";

type LeagueRow = {
  league_id: string;
  season: number;
  name: string;
  previous_league_id: string | null;
  settings: Record<string, unknown>;
};

function rowToLeague(row: LeagueRow): League {
  return {
    leagueId: row.league_id,
    season: row.season,
    name: row.name,
    previousLeagueId: row.previous_league_id,
    settings: row.settings,
  };
}

export class LeagueRepository {
  async upsertLeague(league: League): Promise<void> {
    await sql`
      insert into leagues (league_id, season, name, previous_league_id, settings)
      values (
        ${league.leagueId},
        ${league.season},
        ${league.name},
        ${league.previousLeagueId},
        ${JSON.stringify(league.settings)}
      )
      on conflict (league_id) do update set
        season = excluded.season,
        name = excluded.name,
        previous_league_id = excluded.previous_league_id,
        settings = excluded.settings
    `;
  }

  async getLeague(leagueId: string): Promise<League | null> {
    const rows = (await sql`
      select league_id, season, name, previous_league_id, settings
      from leagues
      where league_id = ${leagueId}
    `) as LeagueRow[];
    return rows[0] ? rowToLeague(rows[0]) : null;
  }

  /**
   * Reads back an already-imported chain from OUR OWN database, oldest
   * season first. For walking Sleeper's live chain before anything is
   * imported yet, see lib/sleeper/league.ts's getLeagueSeasonChain instead
   * — that one hits the Sleeper API directly; this one never does.
   */
  async getSeasonChain(leagueId: string): Promise<League[]> {
    const chain: League[] = [];
    let currentId: string | null = leagueId;

    while (currentId) {
      const league: League | null = await this.getLeague(currentId);
      if (!league) break;
      chain.unshift(league);
      currentId = league.previousLeagueId;
    }

    return chain;
  }
}
