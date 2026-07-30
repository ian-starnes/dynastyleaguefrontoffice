/**
 * Stand-ins for DLFO's future keeper contract system. Deterministic per
 * player (same input always produces the same output) so numbers look
 * stable across reloads — neither of these has real contract meaning yet.
 * They exist purely so Keeper Surplus and Asset Value can be demonstrated
 * before real contracts exist.
 *
 * Contract Philosophy (documented here, NOT implemented yet):
 *   - Keeper Cost never changes unless the player becomes undrafted.
 *   - Years Remaining starts at 5, decreases by 1 each offseason, and
 *     resets to 5 whenever the player is traded.
 * None of that lifecycle logic exists today — both values are recomputed
 * fresh from the player's ID (and, for keeper cost, their market value)
 * on every request, not stored or tracked over time.
 */

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/**
 * Placeholder keeper cost, scaled off the player's market value (when
 * known) so it lands in a comparable range — roughly 50%–150% of market
 * value, so some players look like keeper bargains and others overpriced.
 * Falls back to a flat base for players with no real market value to
 * scale from.
 */
export function getPlaceholderKeeperCost(
  playerId: string,
  marketValue: number | null
): number {
  const hash = hashString(`keeper-cost:${playerId}`);
  const factor = 0.5 + (hash % 1000) / 1000; // 0.5–1.499
  const base = marketValue ?? 500;
  return Math.round(base * factor);
}

/** Placeholder years remaining, 1–5 inclusive. */
export function getPlaceholderYearsRemaining(playerId: string): number {
  const hash = hashString(`years-remaining:${playerId}`);
  return (hash % 5) + 1;
}
