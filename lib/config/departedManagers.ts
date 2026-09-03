import type { ManagerContactInfo } from "./managerContacts";

export type DepartedManager = {
  name: string;
  teamName?: string;
  avatarUrl?: string;
  /** e.g. "2020-2024" — freeform, since exact join/departure seasons aren't tracked for someone no longer in the league. */
  yearsActive?: string;
  note?: string;
  contact?: ManagerContactInfo;
};

/**
 * Former league members who no longer hold a roster — real people, real
 * history, but gone from Sleeper's CURRENT-season user list, so nothing
 * here can be sourced live from the API the way getManagerProfiles()
 * sources active managers. Deliberately a plain manually-maintained
 * list, not a live lookup — per explicit direction, since matching a
 * departed real person to a specific old Sleeper account is a real-world
 * identity claim this codebase won't guess at.
 *
 * Every field beyond `name` is optional and starts empty rather than
 * guessed — fill in whatever real information should be shown.
 */
export const DEPARTED_MANAGERS: DepartedManager[] = [
  { name: "Brennan Templeton" },
  { name: "Damon Hibbs" },
];
