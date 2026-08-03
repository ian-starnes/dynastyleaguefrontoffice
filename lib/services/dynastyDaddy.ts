/**
 * Dynasty Daddy's trade values — a planned future input to Market Value
 * (see lib/services/marketValueService.ts's TODO(market-value-model)).
 *
 * Researched before writing this stub: Dynasty Daddy's trade values are a
 * web tool (dynasty-daddy.com), not a documented public API. No confirmed
 * endpoint or auth scheme to build against — integrating this later would
 * mean reaching out to them directly, not something to reverse-engineer
 * or scrape without authorization.
 *
 * Returns an empty map until real access exists. Never fabricate a value.
 */
export type DynastyDaddyPlayer = {
  name: string;
  sleeperId: string | null;
  value: number;
};

export async function getDynastyDaddyValues(): Promise<
  Map<string, DynastyDaddyPlayer>
> {
  return new Map();
}
