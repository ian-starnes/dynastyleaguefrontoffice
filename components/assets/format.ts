/**
 * "11046" -> "11.0k"; "-5000" -> "-5.0k"; values under 1000 in magnitude
 * are shown as plain integers. Sign-aware since values like Keeper
 * Surplus can be negative.
 */
export function formatCompactValue(value: number): string {
  const sign = value < 0 ? "-" : "";
  const magnitude = Math.abs(value);

  if (magnitude < 1000) return value.toLocaleString();
  return `${sign}${(magnitude / 1000).toFixed(1)}k`;
}
