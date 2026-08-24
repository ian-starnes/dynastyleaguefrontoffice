/**
 * KeepTradeCut's crowdsourced dynasty values — marked optional in the
 * DLFO architecture brief. A possible future input to Market Value's
 * Component C (see lib/services/rosValuationService.ts, DLFO's actual
 * Market Value source today).
 *
 * Researched before writing this stub: KeepTradeCut is a free, crowdsourced
 * web tool (keeptradecut.com) — no documented public API found. Same
 * caveat as PFF/Dynasty Daddy: integrating this would need their direct
 * permission, not scraping.
 *
 * Returns an empty map until real access exists. Never fabricate a value.
 */
export type KeepTradeCutPlayer = {
  name: string;
  sleeperId: string | null;
  value: number;
};

export async function getKeepTradeCutValues(): Promise<
  Map<string, KeepTradeCutPlayer>
> {
  return new Map();
}
