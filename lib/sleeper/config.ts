export const SLEEPER_API_BASE_URL = "https://api.sleeper.app/v1";

/**
 * DLFO currently points at a single hardcoded league via the environment
 * rather than asking the user for it on every visit. Once DLFO supports
 * multiple leagues, this will be replaced by a league selector + auth.
 */
export function getSleeperLeagueId(): string {
  const leagueId = process.env.NEXT_PUBLIC_SLEEPER_LEAGUE_ID;

  if (!leagueId) {
    throw new Error(
      "NEXT_PUBLIC_SLEEPER_LEAGUE_ID is not set. Add it to .env.local (see .env.example)."
    );
  }

  return leagueId;
}

/**
 * The Sleeper user_id that is "you" — used only for the "My Team" filter.
 * Optional: returns null (filter simply matches nothing) if unset, rather
 * than throwing, since nothing else depends on it.
 */
export function getMyOwnerId(): string | null {
  return process.env.NEXT_PUBLIC_SLEEPER_MY_OWNER_ID ?? null;
}
