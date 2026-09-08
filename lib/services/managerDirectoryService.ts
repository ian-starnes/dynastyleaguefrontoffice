import { getManagerProfiles } from "./managerProfileService";
import { MANAGER_CONTACTS, type ManagerContactInfo } from "@/lib/config/managerContacts";
import { DEPARTED_MANAGERS, type DepartedManager } from "@/lib/config/departedManagers";

export type ActiveManagerDirectoryEntry = {
  ownerId: string;
  displayName: string;
  teamName: string | null;
  avatarUrl: string | null;
  /**
   * When THIS PERSON personally joined the league — NOT when the
   * franchise they now run was founded. Deliberately
   * profile.personalJoinedSeason, not profile.memberSinceSeason: a
   * manager who took over an existing franchise (e.g. via the real 2026
   * succession — see franchiseIdentityService.ts) joined whenever THEY
   * showed up, which is what a people-directory page should show, not
   * the team's own multi-manager history.
   */
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
    .map((profile) => {
      const contact = MANAGER_CONTACTS[profile.ownerId] ?? {};
      return {
        ownerId: profile.ownerId,
        displayName: profile.displayName,
        teamName: profile.teamName,
        // A real provided photo of the manager takes priority over their
        // Sleeper avatar (just a profile picture they picked in the
        // Sleeper app, not necessarily a real photo of them) — falls
        // back to it until a real photo exists, rather than showing
        // nothing.
        avatarUrl: contact.photoUrl ?? profile.avatarUrl,
        memberSinceSeason: profile.personalJoinedSeason,
        contact,
      };
    })
    .sort((a, b) => (a.teamName ?? a.displayName).localeCompare(b.teamName ?? b.displayName));

  return { active, departed: DEPARTED_MANAGERS };
}
