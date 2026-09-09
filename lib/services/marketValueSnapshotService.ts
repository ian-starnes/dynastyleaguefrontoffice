import { getSleeperLeagueId } from "@/lib/sleeper";
import { MarketValueSnapshotRepository } from "@/lib/repositories";
import type { LeaguePlayer } from "@/lib/league-players";

export type MarketValueChange = {
  /** Real Market Value from the most recent recorded snapshot at least a week old — the "last week" benchmark. */
  benchmarkValue: number;
  /** The real calendar date (YYYY-MM-DD) that benchmark was recorded on — always >= 7 days before today. */
  benchmarkDate: string;
  /** Today's real value minus benchmarkValue — positive means it went up since last week. */
  change: number;
};

/**
 * Writes today's real Market Value for every currently-valued player, if
 * a snapshot doesn't already exist for today — resilient by design, like
 * every other optional/enhancement data source in this codebase: a
 * database hiccup here degrades to "no ticker today," never a broken
 * page. Deliberately triggered on-demand from the Assets page (the one
 * page that shows the ticker) rather than a fixed cron schedule or a
 * more central call site — see schema.sql's market_value_snapshots doc
 * comment for why a day nobody visits the site simply has no snapshot,
 * rather than a fabricated one.
 */
export async function ensureTodaysMarketValueSnapshot(
  season: number,
  players: LeaguePlayer[]
): Promise<void> {
  const leagueId = getSleeperLeagueId();
  const repository = new MarketValueSnapshotRepository();

  try {
    const alreadySnapshotted = await repository.hasSnapshotForToday(leagueId);
    if (alreadySnapshotted) return;

    const values = players
      .filter(
        (p): p is LeaguePlayer & { marketValue: number } => p.marketValue !== null
      )
      .map((p) => ({ playerId: p.nflPlayer.id, marketValue: p.marketValue }));

    await repository.insertSnapshots(leagueId, season, values);
  } catch (error: unknown) {
    console.error(
      "Market Value snapshot write failed, ticker will be stale today:",
      error
    );
  }
}

/**
 * Real Market Value change per player versus a real week-ago benchmark
 * — a player with no entry here has no snapshot at least 7 days old yet
 * (e.g. this feature hasn't been running for a full week yet), which the
 * Assets page shows as "no benchmark yet," never a fabricated zero
 * change or a same-day comparison masquerading as a weekly one.
 */
export async function getMarketValueChanges(
  players: LeaguePlayer[]
): Promise<Map<string, MarketValueChange>> {
  const leagueId = getSleeperLeagueId();
  const repository = new MarketValueSnapshotRepository();

  const changes = new Map<string, MarketValueChange>();
  try {
    const benchmarkSnapshots = await repository.getWeekAgoBenchmarkSnapshots(leagueId);
    for (const player of players) {
      if (player.marketValue === null) continue;
      const benchmark = benchmarkSnapshots.get(player.nflPlayer.id);
      if (!benchmark) continue;
      changes.set(player.nflPlayer.id, {
        benchmarkValue: benchmark.marketValue,
        benchmarkDate: benchmark.snapshotDate,
        change: player.marketValue - benchmark.marketValue,
      });
    }
  } catch (error: unknown) {
    console.error(
      "Market Value change lookup failed, ticker will be hidden today:",
      error
    );
  }

  return changes;
}
