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
 * `YYYY-MM-DD` as its three numbers, or null when it is not a real day.
 *
 * The one place the shape is read. It used to be read three times — here,
 * in `clock.instantOn` and in `remind` — and only two of the three asked
 * whether the day existed, so "2026-02-30" was refused by the clock, kept
 * by the reminder and rolled into the 2nd of March there. A reminder for a
 * day the plan could never have is not a harmless disagreement.
 *
 * The month comes back 1 to 12, as written, not as `Date` counts it:
 * callers that build a `Date` subtract one themselves, and the one place
 * the subtraction lives is the place it is easiest to forget.
 *
 * The check runs through UTC, which has no daylight saving to move a day
 * by an hour, and reads the result back: the constructor rolls overflow
 * forward instead of refusing it, so asking what the day became is the
 * only way to know it was real.
 */
export function parseISODay(s: string): { y: number; mo: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const probe = new Date(Date.UTC(y, mo - 1, d));
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== mo - 1 || probe.getUTCDate() !== d) {
    return null;
  }
  return { y, mo, d };
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
  const p = parseISODay(s);
  return p ? new Date(p.y, p.mo - 1, p.d, 12, 0, 0, 0) : null;
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

/**
 * What time it is, as minutes past local midnight.
 *
 * The clock half of what this file otherwise refuses to think about. A
 * calendar day is enough to say *which* day a trip is, and not enough to
 * say whether it has already happened — an evening planned for today is
 * ahead of you at five and behind you at eleven, and both are the same
 * `YYYY-MM-DD`. Callers that need that distinction pass this alongside
 * `todayISO()`, and both must come from the same `Date` so they cannot
 * disagree across midnight.
 *
 * Local, like everything else here: `getUTCHours` would report 02:00 in
 * Vietnam while the reader's own clock says 09:00.
 */
export function minutesOf(d: Date = new Date()): number {
  return d.getHours() * 60 + d.getMinutes();
}

/** `n` days after an ISO day, as an ISO day. */
export function addDays(iso: string, n: number): string {
  const d = fromISO(iso);
  if (!d) return iso;
  d.setDate(d.getDate() + n);
  return toISO(d);
}
