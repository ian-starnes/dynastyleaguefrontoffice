import { sql } from "@/lib/db/client";
import type { KeeperDeclaration } from "@/lib/models";

type KeeperDeclarationRow = {
  league_id: string;
  season: number;
  roster_id: number;
  player_id: string;
};

function rowToKeeperDeclaration(row: KeeperDeclarationRow): KeeperDeclaration {
  return {
    leagueId: row.league_id,
    season: row.season,
    rosterId: row.roster_id,
    playerId: row.player_id,
  };
}

/**
 * Sleeper's own pre-draft keeper declarations, where present — see
 * lib/models/KeeperDeclaration.ts for why this is a secondary signal,
 * not the primary source of "was this player kept."
 */
export class KeeperDeclarationRepository {
  async upsertKeeperDeclaration(declaration: KeeperDeclaration): Promise<void> {
    await sql`
      insert into keeper_declarations (league_id, season, roster_id, player_id)
      values (${declaration.leagueId}, ${declaration.season}, ${declaration.rosterId}, ${declaration.playerId})
      on conflict (league_id, season, roster_id, player_id) do nothing
    `;
  }

  async getKeeperDeclarationsForLeague(
    leagueId: string
  ): Promise<KeeperDeclaration[]> {
    const rows = (await sql`
      select league_id, season, roster_id, player_id
      from keeper_declarations
      where league_id = ${leagueId}
      order by season asc
    `) as KeeperDeclarationRow[];
    return rows.map(rowToKeeperDeclaration);
  }
}
