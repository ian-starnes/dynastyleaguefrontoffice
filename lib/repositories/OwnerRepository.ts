import { sql } from "@/lib/db/client";
import type { Owner } from "@/lib/models";

type OwnerRow = {
  owner_id: string;
  display_name: string;
  team_name: string | null;
};

function rowToOwner(row: OwnerRow): Owner {
  return {
    ownerId: row.owner_id,
    displayName: row.display_name,
    teamName: row.team_name,
  };
}

export class OwnerRepository {
  /** Last-write-wins on display_name/team_name — an owner isn't scoped to one season. */
  async upsertOwner(owner: Owner): Promise<void> {
    await sql`
      insert into owners (owner_id, display_name, team_name)
      values (${owner.ownerId}, ${owner.displayName}, ${owner.teamName})
      on conflict (owner_id) do update set
        display_name = excluded.display_name,
        team_name = excluded.team_name
    `;
  }

  async getOwner(ownerId: string): Promise<Owner | null> {
    const rows = (await sql`
      select owner_id, display_name, team_name from owners where owner_id = ${ownerId}
    `) as OwnerRow[];
    return rows[0] ? rowToOwner(rows[0]) : null;
  }
}
