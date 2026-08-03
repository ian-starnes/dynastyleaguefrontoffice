/**
 * The shape every market-value input source conforms to — FantasyCalc
 * today, FantasyPros/PFF/Dynasty Daddy/KeepTradeCut/a future proprietary
 * DLFO model eventually (see lib/services/marketValueService.ts's
 * TODO(market-value-model) for how these will blend). Each provider gets
 * its own isolated service file; no provider-specific logic belongs in a
 * UI component or in the blending logic itself.
 *
 * lib/services/fantasycalc.ts's getFantasyCalcValues already matches this
 * shape structurally — TypeScript's structural typing means it doesn't
 * need to change to "implement" this.
 */
export type MarketValueProviderPlayer = {
  value: number;
  sleeperId: string | null;
};

export type MarketValueProvider = () => Promise<
  Map<string, MarketValueProviderPlayer>
>;
