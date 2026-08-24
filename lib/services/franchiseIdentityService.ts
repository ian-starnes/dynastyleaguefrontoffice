import {
  getLeagueSeasonChain,
  getRostersForLeague,
  getOwnersForLeague,
  getSleeperLeagueId,
} from "@/lib/sleeper";

/**
 * A Sleeper roster_id is the real, stable identity of a franchise within
 * this league across seasons — Sleeper's owner_id (a specific person's
 * account) can change on the exact same roster_id when a manager leaves
 * and someone new takes over running that same team. Confirmed live: this
 * league's full 2020-2026 season chain shows every roster_id held by the
 * same owner_id every single year, EXCEPT two real, deliberate manager
 * successions ahead of the 2026 season — roster_id 6 (dchdch10 through
 * 2025, Dick21 from 2026) and roster_id 4 (brennantemp through 2025,
 * projectpattycakes from 2026). Both keep the same players, draft picks,
 * and cap situation; only the Sleeper account managing the roster changed.
 *
 * "Team history and performance travels with the team, and transfers to
 * new managers" means every cross-season aggregation (career record,
 * championships, keeper clocks, Ring of Honor, etc.) should attribute
 * history to whoever CURRENTLY holds a roster_id, not whichever specific
 * account happened to hold it at the time the history was made. This
 * service is the one place that resolves that continuity — every service
 * that aggregates across the season chain should canonicalize owner_id
 * through it rather than trusting raw owner_id equality.
 */
export type FranchiseIdentity = {
  /** Any owner_id that has ever held a roster_id in this league, mapped to whoever holds that SAME roster_id in the current season. Owners who never changed map to themselves. */
  canonicalOwnerId: Map<string, string>;
  /** Current-season display name for each current (canonical) owner_id — every historical record should show this name, not a departed manager's. */
  currentOwnerName: Map<string, string | null>;
  /** Earliest season the franchise now held by this current owner_id has existed in the league, regardless of who managed it that season. */
  franchiseFoundedSeason: Map<string, number>;
};

/**
 * Walks the full season chain once. Cheap relative to the rest of what
 * every history service already fetches — roster/owner payloads are tiny
 * JSON, not the large endpoints that need de-duplication care elsewhere
 * in this codebase — so each caller building its own copy is fine.
 */
export async function getFranchiseIdentityMap(): Promise<FranchiseIdentity> {
  const fullChain = await getLeagueSeasonChain(getSleeperLeagueId()); // oldest first
  const currentLeague = fullChain[fullChain.length - 1];

  const [currentRosters, currentOwners, rostersPerSeason] = await Promise.all([
    getRostersForLeague(currentLeague.league_id),
    getOwnersForLeague(currentLeague.league_id),
    Promise.all(fullChain.map((league) => getRostersForLeague(league.league_id))),
  ]);

  const currentOwnerIdByRosterId = new Map(
    currentRosters.map((roster) => [roster.roster_id, roster.owner_id])
  );
  const currentOwnerName = new Map(
    currentOwners.map((owner) => [
      owner.user_id,
      owner.metadata?.team_name ?? owner.display_name,
    ])
  );

  const canonicalOwnerId = new Map<string, string>();
  const franchiseFoundedSeason = new Map<string, number>();

  fullChain.forEach((league, index) => {
    const season = Number(league.season);
    for (const roster of rostersPerSeason[index]) {
      const currentOwnerOfThisRoster = currentOwnerIdByRosterId.get(roster.roster_id);
      if (!currentOwnerOfThisRoster) continue; // roster_id no longer exists in the current season

      if (roster.owner_id) {
        canonicalOwnerId.set(roster.owner_id, currentOwnerOfThisRoster);
      }

      const existing = franchiseFoundedSeason.get(currentOwnerOfThisRoster);
      if (existing === undefined || season < existing) {
        franchiseFoundedSeason.set(currentOwnerOfThisRoster, season);
      }
    }
  });

  return { canonicalOwnerId, currentOwnerName, franchiseFoundedSeason };
}

/**
 * Resolves a historical owner_id to whoever currently manages that same
 * franchise. Falls back to the id itself if the roster it once held no
 * longer exists in the current season (a real departure with no
 * successor, not a manager change) — no history should still exist to
 * attribute in that case anyway.
 */
export function canonicalizeOwnerId(ownerId: string, identity: FranchiseIdentity): string {
  return identity.canonicalOwnerId.get(ownerId) ?? ownerId;
}
