/**
 * "64" -> "$64"; "-6" -> "-$6". No implicit "+" for positives — callers
 * add that themselves where a signed delta (like Keeper Surplus) calls
 * for it. Auction dollars are always whole numbers.
 */
export function formatDollarValue(value: number): string {
  const sign = value < 0 ? "-" : "";
  return `${sign}$${Math.round(Math.abs(value))}`;
}
