/**
 * FantasyPros DOES have an official API (api.fantasypros.com) with a
 * documented dynasty consensus-rankings endpoint, authenticated via an
 * `x-api-key` header. It is deliberately NOT wired up yet, because every
 * access tier requires something this integration can't do on its own:
 *
 *  - Free key: explicitly "sample data" for non-production use only — not
 *    real rankings, not suitable for showing to real users.
 *  - Premium (~$8.99/mo, bundled with a FantasyPros HOF subscription):
 *    a personal-use production key.
 *  - Commercial: custom pricing, required for a commercially redistributed
 *    product like DLFO eventually aims to be.
 *
 * All three require a human to create a FantasyPros account and, for real
 * data, pay for a subscription or negotiate a commercial license — not
 * something to automate or fake around.
 *
 * To finish this integration once you have a key:
 *   1. Add FANTASYPROS_API_KEY to .env.local — server-only, NO
 *      NEXT_PUBLIC_ prefix. Unlike the Sleeper league ID, this is a real
 *      credential and must never reach the client bundle.
 *   2. Implement fetchFantasyProsEcr() below: GET
 *      https://api.fantasypros.com/public/v2/json/nfl/{season}/consensus-rankings
 *      with the `x-api-key` header and dynasty-scoped query params —
 *      confirm the exact param names against your key's docs access,
 *      since the public docs page doesn't enumerate them without one.
 *   3. Build getFantasyProsValues() the same way
 *      lib/services/fantasycalc.ts's getFantasyCalcValues() works: map
 *      the response into FantasyProsPlayer, index by Sleeper ID and by
 *      normalizePlayerName(name) (reuse the helper from fantasycalc.ts).
 *
 * Until then, this returns an empty map — every player's fantasyProsECR
 * is null and renders as "—". Never fabricate a ranking here.
 */

export type FantasyProsPlayer = {
  name: string;
  sleeperId: string | null;
  ecr: number;
};

export async function getFantasyProsValues(): Promise<
  Map<string, FantasyProsPlayer>
> {
  return new Map();
}
