import { sql } from "@/lib/db/client";

export type MarketValueSnapshot = {
  playerId: string;
  snapshotDate: string;
  marketValue: number;
};

/**
 * The one place any of this codebase writes or reads a HISTORICAL Market
 * Value — everywhere else, Market Value is computed live at read time
 * from the ROS valuation engine and never persisted (see
 * lib/services/rosValuationService.ts). This table exists purely to
 * power the Assets page's change ticker, which needs a real prior value
 * to compare against that a live-only computation can never provide.
 */
export class MarketValueSnapshotRepository {
  /** Whether a snapshot already exists for this league for today (server's real current date) — the gate that keeps this to at most once per real day. */
  async hasSnapshotForToday(leagueId: string): Promise<boolean> {
    const rows = await sql`
      select 1 from market_value_snapshots
      where league_id = ${leagueId} and snapshot_date = current_date
      limit 1
    `;
    return rows.length > 0;
  }

  /**
   * Bulk-inserts today's real Market Value for every player passed in.
   * `on conflict do nothing` makes this safe to call more than once for
   * the same real day (e.g. a race between two concurrent requests both
   * finding no snapshot yet) without ever overwriting an already-recorded
   * value with a later, possibly-different one from the same day.
   */
  async insertSnapshots(
    leagueId: string,
    season: number,
    values: { playerId: string; marketValue: number }[]
  ): Promise<void> {
    if (values.length === 0) return;

    const params: unknown[] = [];
    const rowPlaceholders = values.map((v, i) => {
      const base = i * 4;
      params.push(leagueId, v.playerId, season, v.marketValue);
      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`;
    });

    await sql.query(
      `insert into market_value_snapshots (league_id, player_id, season, market_value)
       values ${rowPlaceholders.join(", ")}
       on conflict (league_id, player_id, snapshot_date) do nothing`,
      params
    );
  }

  /**
   * The most recent real snapshot strictly BEFORE today for every player
   * in this league, in one round trip — the basis for "change since
   * last recorded value" on the Assets page. Deliberately not "exactly
   * yesterday": if a day was skipped (nobody visited the site), this
   * still finds the last real value on record rather than showing no
   * change at all.
   */
  async getMostRecentPriorSnapshots(
    leagueId: string
  ): Promise<Map<string, MarketValueSnapshot>> {
    const rows = (await sql`
      select distinct on (player_id) player_id, snapshot_date::text, market_value
      from market_value_snapshots
      where league_id = ${leagueId} and snapshot_date < current_date
      order by player_id, snapshot_date desc
    `) as { player_id: string; snapshot_date: string; market_value: number }[];

    return new Map(
      rows.map((row) => [
        row.player_id,
        {
          playerId: row.player_id,
          snapshotDate: row.snapshot_date,
          marketValue: row.market_value,
        },
      ])
    );
  }
}
