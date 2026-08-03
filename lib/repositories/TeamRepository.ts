import { sql } from "@/lib/db/client";
import type { Team } from "@/lib/models";

type TeamRow = {
  league_id: string;
  roster_id: number;
  owner_id: string | null;
};

function rowToTeam(row: TeamRow): Team {
  return {
    leagueId: row.league_id,
    rosterId: row.roster_id,
    ownerId: row.owner_id,
  };
}

export class TeamRepository {
  async upsertTeam(team: Team): Promise<void> {
    await sql`
      insert into teams (league_id, roster_id, owner_id)
      values (${team.leagueId}, ${team.rosterId}, ${team.ownerId})
      on conflict (league_id, roster_id) do update set
        owner_id = excluded.owner_id
    `;
  }

  async getTeamsForLeague(leagueId: string): Promise<Team[]> {
    const rows = (await sql`
      select league_id, roster_id, owner_id from teams where league_id = ${leagueId}
    `) as TeamRow[];
    return rows.map(rowToTeam);
  }
}
