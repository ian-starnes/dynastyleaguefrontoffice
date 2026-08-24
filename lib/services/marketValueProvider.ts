/**
 * The shape every supplementary market-value input source conforms to —
 * FantasyPros/PFF/Dynasty Daddy/KeepTradeCut, if any of their real APIs
 * ever become licensed and get blended into the ROS valuation engine's
 * Component C (see lib/services/rosConsensusService.ts and
 * lib/services/rosValuationService.ts, which is DLFO's actual Market
 * Value source today). Each provider gets its own isolated service file;
 * no provider-specific logic belongs in a UI component or in the
 * blending logic itself.
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
