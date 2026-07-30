/**
 * "11046" -> "11.0k"; "-5000" -> "-5.0k"; values under 1000 in magnitude
 * are shown as plain integers. Sign-aware since values like Keeper
 * Surplus can be negative. For the raw (hidden-by-default) FantasyCalc
 * points column only — every dollar figure uses formatDollarValue below.
 */
export function formatCompactValue(value: number): string {
  const sign = value < 0 ? "-" : "";
  const magnitude = Math.abs(value);

  if (magnitude < 1000) return value.toLocaleString();
  return `${sign}${(magnitude / 1000).toFixed(1)}k`;
}

/**
 * "64" -> "$64"; "-6" -> "-$6". No implicit "+" for positives — callers
 * add that themselves where a signed delta (like Keeper Surplus) calls
 * for it. Auction dollars are always whole numbers.
 */
export function formatDollarValue(value: number): string {
  const sign = value < 0 ? "-" : "";
  return `${sign}$${Math.round(Math.abs(value))}`;
}
