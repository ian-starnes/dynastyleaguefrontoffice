/**
 * Stand-in for the future Fantasy Value engine. Deterministic per player
 * (same input always produces the same output) so sorting/filtering looks
 * stable across reloads — these numbers carry no analytical meaning yet.
 */
export function getPlaceholderFantasyValue(playerId: string): number {
  let hash = 0;
  for (let i = 0; i < playerId.length; i++) {
    hash = (hash * 31 + playerId.charCodeAt(i)) | 0;
  }

  // Map the hash into a 40.0–99.9 range so values read like plausible scores.
  const normalized = (Math.abs(hash) % 1000) / 1000;
  return Math.round((40 + normalized * 60) * 10) / 10;
}
