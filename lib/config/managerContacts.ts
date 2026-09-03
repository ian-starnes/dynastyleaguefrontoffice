export type ManagerContactInfo = {
  email?: string;
  phone?: string;
  discord?: string;
};

/**
 * Real contact info for current managers. Never sourced from Sleeper —
 * its API exposes no email, phone, or Discord handle for any user
 * (confirmed during the Phase 1 API audit; see managerProfileService.ts's
 * getManagerProfiles doc comment), so this is the one place that data
 * has to live. Keyed by real Sleeper owner_id (not team name) so an
 * entry survives a manager succession automatically — see
 * franchiseIdentityService.ts for why owner_id can change under a team
 * without it being a new person.
 *
 * Every value here must be real, manager-provided information. Leave a
 * field out entirely rather than filling it with a guess or placeholder
 * — the Managers page already handles a missing field by simply not
 * showing that line, never fabricating one.
 */
export const MANAGER_CONTACTS: Record<string, ManagerContactInfo> = {
  "601559414054379520": {}, // dreichert23 — Project Pete
  "604054897641459712": {}, // KingRambo23 — God Squad
  "605921765595635712": {}, // stewstewcachoo — Stew Crew
  "606540719221465088": {}, // AWittmers — The Assault "Bombs Away"
  "606606739135074304": {}, // Hediger — QB Whisperer
  "678666053185773568": {}, // Dick21 — The Great Googly Moogly
  "73278036199751680": {}, // IAmDixonWood — The Buffalo Kills
  "465583007055474688": {}, // Starnz — Young Guns ★
  "598973295123021824": {}, // danielgibson — Harambe's Make-A-Wish
  "1397244357983092736": {}, // projectpattycakes
};
