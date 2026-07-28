/** "11046" -> "11.0k"; values under 1000 are shown as plain integers. */
export function formatCompactValue(value: number): string {
  if (value < 1000) return value.toLocaleString();
  return `${(value / 1000).toFixed(1)}k`;
}
