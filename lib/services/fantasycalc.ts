/**
 * Lowercases and strips accents, punctuation, and common suffixes (Jr, Sr,
 * II-V) so the same player's name compares equal across sources that
 * format it slightly differently (e.g. "A.J. Brown" vs "AJ Brown").
 */
export function normalizePlayerName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[.'']/g, "")
    .replace(/\b(jr|sr|ii|iii|iv|v)\b/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
