// Which day the plan is for, as plain data.
//
// A calendar day, not an instant. "Sunday 16 August" is the same day
// whether you decided it at breakfast or at midnight, so the draft holds
// `YYYY-MM-DD` rather than a `Date`: a Date is a moment in time, carries a
// clock nobody set, and two Dates for the same day are never equal.
//
// Everything here is local-time on purpose, and that is the whole reason
// this file exists rather than a couple of one-liners at the call site.
// `toISOString()` converts to UTC first, so in Vietnam — UTC+7 — every
// morning before 07:00 it reports *yesterday*. A reader planning a day out
// at 6am would be handed the wrong date, once a day, silently, and only in
// some timezones. Same trap in reverse for parsing: `new Date('2026-08-16')`
// is midnight UTC, which is the 15th anywhere west of Greenwich.

/** Today's calendar day where the reader is standing. */
export function todayISO(now: Date = new Date()): string {
  return toISO(now);
}

/** A `Date` as the calendar day it falls on locally — never via UTC. */
export function toISO(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * `YYYY-MM-DD` back to local noon.
 *
 * Noon rather than midnight, and not for tidiness: a date built at
 * midnight is one hour from being the previous day under daylight saving,
 * and some platforms shift it. Noon is twelve hours from either edge, so
 * the calendar day survives every offset the world uses.
 *
 * Returns null for anything that is not a real day — including "2026-02-30",
 * which every naive parser happily turns into the 2nd of March.
 */
export function fromISO(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const out = new Date(y, mo - 1, d, 12, 0, 0, 0);
  // The constructor rolls overflow forward instead of refusing it, so the
  // only way to know the day was real is to ask what it became.
  if (out.getFullYear() !== y || out.getMonth() !== mo - 1 || out.getDate() !== d) return null;
  return out;
}

/**
 * Whole calendar days from `from` to `to`, negative for the past.
 *
 * Counted in UTC even though everything else here is local, and the two
 * are not in tension: UTC has no daylight saving, so a day there is always
 * exactly 86400000 ms and the division is exact. Subtracting two *local*
 * noons instead leaves an hour of slop across a DST boundary, which
 * rounding hides rather than fixes — and a rounding that only matters in
 * timezones the test suite does not run in is a rounding nobody can check.
 *
 * The calendar day itself is still read locally, by `fromISO`. This only
 * borrows UTC as a ruler.
 */
export function daysBetween(from: string, to: string): number | null {
  const a = fromISO(from);
  const b = fromISO(to);
  if (!a || !b) return null;
  const utc = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return (utc(b) - utc(a)) / 86400000;
}

/**
 * What to call a day the reader has chosen.
 *
 * "Today" and "Tomorrow" rather than the date, because that is what the
 * reader would call them and the date underneath tells them nothing extra.
 * Anything further out is a date, since "in four days" is arithmetic the
 * reader should not have to do.
 */
export type DayName = { kind: 'today' } | { kind: 'tomorrow' } | { kind: 'date'; date: Date };

export function dayName(iso: string, today: string = todayISO()): DayName | null {
  const d = fromISO(iso);
  if (!d) return null;
  const away = daysBetween(today, iso);
  if (away === 0) return { kind: 'today' };
  if (away === 1) return { kind: 'tomorrow' };
  return { kind: 'date', date: d };
}

/**
 * A day the picker is allowed to return.
 *
 * The past is refused: this wizard sketches a day out, and there is no
 * useful plan for last Tuesday. A year ahead is the other end — not a real
 * limit anybody will meet, just a bound so a mis-scrolled picker cannot
 * hand back 2087 and have every screen downstream believe it.
 */
export function clampDay(iso: string, today: string = todayISO()): string {
  const away = daysBetween(today, iso);
  if (away == null) return today;
  if (away < 0) return today;
  if (away > 365) return addDays(today, 365);
  return iso;
}

/** `n` days after an ISO day, as an ISO day. */
export function addDays(iso: string, n: number): string {
  const d = fromISO(iso);
  if (!d) return iso;
  d.setDate(d.getDate() + n);
  return toISO(d);
}
