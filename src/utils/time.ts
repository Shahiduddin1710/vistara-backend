/** Date helpers shared by the dashboard, visits and stats computations. */

export function startOfDay(date: Date = new Date()): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfDay(date: Date = new Date()): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function isSameDay(a: Date, b: Date = new Date()): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** `true` when the instant falls on today (local time). */
export function isToday(iso: string | Date | null | undefined): boolean {
  if (!iso) return false;
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return false;
  return isSameDay(d);
}

/** Whole minutes between two instants, never negative. */
export function minutesBetween(start: string | Date, end: string | Date = new Date()): number {
  const a = typeof start === 'string' ? new Date(start) : start;
  const b = typeof end === 'string' ? new Date(end) : end;
  const ms = b.getTime() - a.getTime();
  if (Number.isNaN(ms)) return 0;
  return Math.max(0, Math.floor(ms / 60_000));
}

/** `2024-10-12` for grouping and seed determinism. */
export function isoDate(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** `12 Oct 2024` — human readable date for error messages. */
export function formatDateISO(value: string | Date): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
