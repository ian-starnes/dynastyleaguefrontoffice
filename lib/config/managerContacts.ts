export type ManagerContactInfo = {
  /** Real full name(s) — a plain combined string ("Pat Dolan & Tabor Dugger") for a co-owned team rather than a list, since that's the only real case of it. */
  realName?: string;
  /** Rough real location (city/region), not a full address — as specific as the manager chose to share. */
  location?: string;
  /**
   * A real photo of this manager, e.g. "/managers/dreichert23.jpg" (a
   * file under public/managers/). Takes priority over their Sleeper
   * avatar (a profile picture they set in the Sleeper app, not
   * necessarily a real photo of them) wherever this is set — see
   * managerDirectoryService.ts. Leave unset to keep showing their
   * Sleeper avatar until a real photo is provided.
   */
  photoUrl?: string;
  email?: string;
  phone?: string;
  discord?: string;
};

/**
 * Real personal info for current managers. Never sourced from Sleeper —
 * its API exposes no real name, location, email, phone, or Discord
 * handle for any user (confirmed during the Phase 1 API audit; see
 * managerProfileService.ts's getManagerProfiles doc comment), so this is
 * the one place that data has to live. Keyed by real Sleeper owner_id
 * (not team name) so an entry survives a manager succession
 * automatically — see franchiseIdentityService.ts for why owner_id can
 * change under a team without it being a new person.
 *
 * Every value here must be real, manager-provided information. Leave a
 * field out entirely rather than filling it with a guess or placeholder
 * — the Managers page already handles a missing field by simply not
 * showing that line, never fabricating one.
 */
export const MANAGER_CONTACTS: Record<string, ManagerContactInfo> = {
  "601559414054379520": { realName: "Dan Reichert", location: "Phoenix, AZ" }, // dreichert23 — Project Pete
  "604054897641459712": { realName: "Chris Ramirez", location: "Southern CA" }, // KingRambo23 — God Squad
  "605921765595635712": { realName: "Stew Allen", location: "NW Arkansas" }, // stewstewcachoo — Stew Crew
  "606540719221465088": { realName: "Andrew Wittmers", location: "Kansas City, MO" }, // AWittmers — The Assault "Bombs Away"
  "606606739135074304": { realName: "Jon Hediger", location: "NW Arkansas" }, // Hediger — QB Whisperer
  "678666053185773568": { realName: "Ryan \"Dick\" Hardwick", location: "Kansas City, MO" }, // Dick21 — The Great Googly Moogly
  "73278036199751680": { realName: "Mike \"Dixon\" Wood", location: "NYC Metro" }, // IAmDixonWood — The Buffalo Kills
  "465583007055474688": { realName: "Ian Starnes", location: "NW Arkansas" }, // Starnz — Young Guns ★
  "598973295123021824": { realName: "Daniel Gibson", location: "Scottsdale, AZ" }, // danielgibson — Harambe's Make-A-Wish
  "1397244357983092736": { realName: "Pat Dolan & Tabor Dugger", location: "NW Arkansas" }, // projectpattycakes (2 co-owners)
};
