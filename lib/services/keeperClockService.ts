import {
  getLeagueSeasonChain,
  getRostersForLeague,
  getSleeperLeagueId,
} from "@/lib/sleeper";
import { MAX_KEEPER_YEARS } from "./assetCalculator";
import { getFranchiseIdentityMap, canonicalizeOwnerId } from "./franchiseIdentityService";

export type KeeperClock = {
  keeperYearsRemaining: number;
  /** How many consecutive prior seasons the same owner has already held this player. */
  yearsAlreadyKept: number;
};

/**
 * Walks backward through up to MAX_KEEPER_YEARS prior seasons' roster
 * snapshots (one cheap call per season, via getRostersForLeague — NOT
 * per-transaction) to find, for every currently-rostered player, how many
 * CONSECUTIVE seasons the same owner has held them.
 *
 * A change of FRANCHISE between two consecutive seasons' snapshots means a
 * trade happened; the player not appearing on any roster in a season
 * means a fresh add/waiver/draft pickup — both reset the clock, per the
 * Contract Philosophy (Years Remaining starts at MAX_KEEPER_YEARS,
 * decreases by 1 each offseason, resets on trade or a fresh pickup).
 * Owner_id is canonicalized through franchiseIdentityService before this
 * comparison — a manager succession (same roster_id, new Sleeper account,
 * no trade) must NOT reset the clock, only an actual move to a different
 * roster should. Confirmed real case this fixes: dchdch10 → Dick21 and
 * brennantemp → projectpattycakes both kept every player on their roster
 * across the manager change; without canonicalizing first, this would
 * have incorrectly reset every one of those keepers' clocks to 0.
 *
 * Only checks the most recent MAX_KEEPER_YEARS+1 seasons (current plus
 * up to 5 prior) — checking further back can never change the result,
 * since keeperYearsRemaining floors at 0 once yearsAlreadyKept reaches
 * MAX_KEEPER_YEARS.
 *
 * Known simplification: this compares season-BOUNDARY ownership, so it
 * can't see a trade-and-return within the same season (traded away and
 * back to the original owner before that season ended) — that needs real
 * transaction-level tracking, i.e. lib/import/leagueImportService.ts's
 * full pipeline, once that's wired to a real database instead of this
 * live computation.
 */
export async function getKeeperClocks(): Promise<Map<string, KeeperClock>> {
  const rootLeagueId = getSleeperLeagueId();
  const [fullChain, franchiseIdentity] = await Promise.all([
    getLeagueSeasonChain(rootLeagueId), // oldest season first
    getFranchiseIdentityMap(),
  ]);

  const relevantSeasonsOldestFirst = fullChain.slice(-(MAX_KEEPER_YEARS + 1));
  const seasonsNewestFirst = [...relevantSeasonsOldestFirst].reverse();

  const ownerIdByPlayerIdPerSeason = await Promise.all(
    seasonsNewestFirst.map(async (league) => {
      const rosters = await getRostersForLeague(league.league_id);
      const ownerIdByPlayerId = new Map<string, string>();
      for (const roster of rosters) {
        if (!roster.owner_id || !roster.players) continue;
        const ownerId = canonicalizeOwnerId(roster.owner_id, franchiseIdentity);
        for (const playerId of roster.players) {
          ownerIdByPlayerId.set(playerId, ownerId);
        }
      }
      return ownerIdByPlayerId;
    })
  );

  const [currentSeasonOwners, ...priorSeasonsOwnersNewestFirst] =
    ownerIdByPlayerIdPerSeason;

  const clocks = new Map<string, KeeperClock>();
  if (!currentSeasonOwners) return clocks;

  for (const [playerId, currentOwnerId] of currentSeasonOwners) {
    let yearsAlreadyKept = 0;

    for (const priorSeasonOwners of priorSeasonsOwnersNewestFirst) {
      if (priorSeasonOwners.get(playerId) !== currentOwnerId) break;
      yearsAlreadyKept++;
    }

    clocks.set(playerId, {
      yearsAlreadyKept,
      keeperYearsRemaining: Math.max(0, MAX_KEEPER_YEARS - yearsAlreadyKept),
    });
  }

  return clocks;
}
