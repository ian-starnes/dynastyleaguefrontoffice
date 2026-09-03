import { getManagerProfiles } from "./managerProfileService";
import { MANAGER_CONTACTS, type ManagerContactInfo } from "@/lib/config/managerContacts";
import { DEPARTED_MANAGERS, type DepartedManager } from "@/lib/config/departedManagers";

export type ActiveManagerDirectoryEntry = {
  ownerId: string;
  displayName: string;
  teamName: string | null;
  avatarUrl: string | null;
  memberSinceSeason: number;
  contact: ManagerContactInfo;
};

export type ManagerDirectory = {
  active: ActiveManagerDirectoryEntry[];
  departed: DepartedManager[];
};

/**
 * Everything the Managers page needs: real active managers (from
 * getManagerProfiles(), already correctly scoped to primary roster
 * owners only — see that function's co-owner-exclusion doc comment, the
 * same real bug this page would otherwise reintroduce) with real contact
 * info layered in from the local config, plus the departed-manager
 * "graveyard" list. Sorted by team name, not by any ranking — this page
 * is a directory for finding a person, not a leaderboard.
 */
export async function getManagerDirectory(): Promise<ManagerDirectory> {
  const profiles = await getManagerProfiles();

  const active = [...profiles.values()]
    .map((profile) => ({
      ownerId: profile.ownerId,
      displayName: profile.displayName,
      teamName: profile.teamName,
      avatarUrl: profile.avatarUrl,
      memberSinceSeason: profile.memberSinceSeason,
      contact: MANAGER_CONTACTS[profile.ownerId] ?? {},
    }))
    .sort((a, b) => (a.teamName ?? a.displayName).localeCompare(b.teamName ?? b.displayName));

  return { active, departed: DEPARTED_MANAGERS };
}
