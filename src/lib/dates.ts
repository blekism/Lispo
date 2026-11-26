/**
 * Date helpers.
 *
 * Every "day" in Lispo is identified by a local-time date key: "YYYY-MM-DD".
 * We never store UTC dates for days, because "today" must follow the phone's
 * clock and timezone (a task done at 11pm Manila time belongs to that day).
 *
 * Weekdays are Monday-first: 0 = Monday ... 6 = Sunday.
 */

export type DateKey = string; // "YYYY-MM-DD"

export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;
export const WEEKDAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
export const WEEKDAYS_INITIAL = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;
export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

const pad = (n: number) => String(n).padStart(2, '0');

export function toKey(d: Date): DateKey {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Parses a key as a local date at midnight. */
export function fromKey(key: DateKey): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function todayKey(now: Date = new Date()): DateKey {
  return toKey(now);
}

export function addDays(key: DateKey, days: number): DateKey {
  const d = fromKey(key);
  d.setDate(d.getDate() + days);
  return toKey(d);
}

/** Monday = 0 ... Sunday = 6 */
export function weekdayOf(key: DateKey): number {
  return (fromKey(key).getDay() + 6) % 7;
}

/** Monday of the week containing `key`. */
export function startOfWeek(key: DateKey): DateKey {
  return addDays(key, -weekdayOf(key));
}

export function weekKeys(key: DateKey): DateKey[] {
  const start = startOfWeek(key);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

export function monthKeys(year: number, month: number): DateKey[] {
  return Array.from({ length: daysInMonth(year, month) }, (_, i) => toKey(new Date(year, month, i + 1)));
}

/** Iterates every key from `from` to `to` inclusive. */
export function rangeKeys(from: DateKey, to: DateKey): DateKey[] {
  const out: DateKey[] = [];
  for (let k = from; k <= to; k = addDays(k, 1)) out.push(k);
  return out;
}

/** Minutes since midnight -> "8:30 AM" */
export function formatMinutes(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${pad(m)} ${suffix}`;
}

export function minutesOf(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

/** Local Date for a day key + minutes since midnight. */
export function atMinutes(key: DateKey, mins: number): Date {
  const d = fromKey(key);
  d.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
  return d;
}

export function prettyDate(key: DateKey): string {
  const d = fromKey(key);
  return `${WEEKDAYS[weekdayOf(key)]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}
