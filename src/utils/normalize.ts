/**
 * Normalisation helpers used for duplicate detection and case-insensitive
 * substring search.
 */

/** Lowercase, trim, collapse internal whitespace. */
export function normalizeText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Strip every non-alphanumeric character — used on ID document numbers. */
export function normalizeIdNumber(value: string): string {
  return value.replace(/[^A-Za-z0-9]/g, '').toLowerCase();
}

/** Case-insensitive substring match across any number of fields. */
export function matchesQuery(query: string, ...fields: (string | null | undefined)[]): boolean {
  const q = normalizeText(query);
  if (!q) return true;
  return fields.some((f) => normalizeText(f ?? '').includes(q));
}

/** First integer found in a duration string, e.g. "2 Hours" → 2. */
export function parseDurationHours(duration: string, fallback = 8): number {
  const match = /(\d+)\s*(?:hour|hr|h)\b/i.exec(duration);
  if (match?.[1]) {
    const hours = Number(match[1]);
    if (Number.isFinite(hours) && hours > 0) return hours;
  }
  return fallback;
}
