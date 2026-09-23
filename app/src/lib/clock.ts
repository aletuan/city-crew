// The place's own clock.
//
// Every question about opening hours — is it open now, when does it
// next open, is seven on Saturday inside its window — is a question
// about the clock on the wall *of the place*, not the one on the
// reader's phone. Somebody in Melbourne looking at a Melbourne café is
// on the same clock as the café; somebody in Hanoi looking at the same
// café is three hours behind it, and the answer has to be the café's.
//
// ── what this replaced ──
//
// For as long as every city in the catalog was in Vietnam, the place's
// clock was arithmetic: UTC plus seven hours, no daylight saving since
// 1975, one constant with one right home. Then Melbourne arrived (#628),
// and the constant went on adding seven hours to a city ten hours ahead
// of Greenwich — eleven from the first Sunday in October. A reader
// standing outside Kumo Desserts at five to five on a Tuesday, with the
// door open and the hours saying 3 PM to 10 PM, was told "Closed · opens
// 15:00": the app had read the clock at five to two. Every surface that
// asks about hours said the same thing, because every one of them asked
// the same constant.
//
// ── how the clock is read now ──
//
// Each city carries an IANA zone name (`cities.tz`), and the wall clock
// is read through `Intl.DateTimeFormat` with that zone: the runtime's own
// timezone database answers, daylight saving included, and nothing here
// has to know when Victoria changes its clocks. Hermes ships Intl on both
// platforms, so this needs no library.
//
// The fallback is the old arithmetic, kept for one reason: a zone the
// runtime does not know, or a runtime with no timezone data at all, must
// not turn every card into a crash. Under it, Vietnam — seven of the
// eight cities — is still read exactly right, and Melbourne is three hours
// off the way it was before this file existed. Wrong hours beat no app.
//
// No React and no imports, so the plain Node runner reaches all of it —
// and so does the timezone the suite is *also* run under (`test:tz`,
// New York), which is what proves none of this leans on the device's own
// offset.

/** The zone every city had before any city had one. Also what a city row
 *  hydrated from a launch cache written before `cities.tz` existed reads
 *  as, until the next fetch. */
export const DEFAULT_TZ = 'Asia/Ho_Chi_Minh';

/** Indochina Time, for the fallback alone. */
const ICT_OFFSET_MIN = 7 * 60;

/**
 * A moment, read on a wall clock: minutes past midnight, the weekday with
 * Monday as 0 (Google's week, which the hours strings are written in),
 * and the calendar date.
 */
export type WallClock = { mins: number; weekday: number; y: number; m: number; d: number };

// Google's week starts on Monday; `Intl`'s short names are what the
// formatter below is asked for, in English, whatever the reader's locale.
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// One formatter per zone, built on first use. Constructing one is the
// expensive part of `Intl`; formatting with it is not, and a feed of
// forty cards asks forty times per render.
const formatters = new Map<string, Intl.DateTimeFormat>();
function formatter(tz: string): Intl.DateTimeFormat {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      weekday: 'short', year: 'numeric', month: 'numeric', day: 'numeric',
      hour: 'numeric', minute: 'numeric',
    });
    formatters.set(tz, f);
  }
  return f;
}

/** The old reading: UTC plus seven, whatever the zone asked for. */
function ictClock(now: Date): WallClock {
  // Shift onto the clock, then read the shifted instant in UTC — the
  // local accessors would apply the device's offset a second time.
  const local = new Date(now.getTime() + ICT_OFFSET_MIN * 60_000);
  return {
    mins: local.getUTCHours() * 60 + local.getUTCMinutes(),
    weekday: (local.getUTCDay() + 6) % 7,
    y: local.getUTCFullYear(), m: local.getUTCMonth() + 1, d: local.getUTCDate(),
  };
}

/**
 * `now`, on the wall clock of `tz`.
 *
 * Falls back to Indochina Time — see the note at the top — for a zone the
 * runtime refuses (`RangeError` from `Intl`) or an answer it cannot read.
 */
export function wallClock(now: Date, tz: string): WallClock {
  try {
    const parts = formatter(tz).formatToParts(now);
    // A part the engine left out is a throw, not an empty string:
    // `Number('')` is 0, and a missing hour must not read as midnight.
    const part = (type: Intl.DateTimeFormatPartTypes) => {
      const value = parts.find((p) => p.type === type)?.value;
      if (value === undefined) throw new Error(`no ${type} on the clock`);
      return value;
    };
    const weekday = WEEKDAYS.indexOf(part('weekday'));
    // `hourCycle: 'h23'` asks for 00–23; an engine that answers "24" at
    // midnight anyway is folded back rather than trusted.
    const hour = Number(part('hour')) % 24;
    const minute = Number(part('minute'));
    const y = Number(part('year'));
    const m = Number(part('month'));
    const d = Number(part('day'));
    if (weekday < 0 || [hour, minute, y, m, d].some(Number.isNaN)) throw new Error('unreadable clock');
    return { mins: hour * 60 + minute, weekday, y, m, d };
  } catch {
    return ictClock(now);
  }
}

/**
 * How far ahead of UTC `tz` runs at the instant `at`, in minutes — 420
 * for Vietnam always, 600 or 660 for Melbourne depending on the date.
 *
 * Derived from the wall clock rather than looked up, so it comes from
 * the same reading everything else uses and needs no second source. The
 * seconds are stripped first: the wall clock is read to the minute, and
 * comparing it against an instant with seconds on would shave them off
 * the answer.
 */
export function offsetMin(tz: string, at: Date): number {
  const minute = at.getTime() - (at.getUTCSeconds() * 1000 + at.getUTCMilliseconds());
  const w = wallClock(new Date(minute), tz);
  const asUtc = Date.UTC(w.y, w.m - 1, w.d, 0, w.mins);
  return Math.round((asUtc - minute) / 60_000);
}

/**
 * The instant at `minutes` past midnight on `day`, read on the clock of
 * `tz`.
 *
 * Exists so a planner can ask `openState` about seven in the evening next
 * Saturday. Building that Date at the call site would mean going through
 * the device's offset, and the device is in New York for one of the two
 * clocks the test suite runs on.
 *
 * `minutes` may run past 1440 — 25:00 is one in the morning after — and
 * the day is validated on its own, before the minutes are added: 25:00
 * on the 31st reads back as the 1st, which is a real hour and used to
 * look like an overflow (see the git history of `format.ts`).
 *
 * Null for anything that is not a real day, including "2026-02-30", which
 * `Date.UTC` would roll forward to the 2nd of March rather than refuse.
 *
 * A wall time that does not exist — half past two on the night Victoria
 * springs forward — lands on the instant the clock shows an hour later,
 * which is where a phone alarm set for it goes too.
 */
export function instantOn(day: string, minutes: number, tz: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day.trim());
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const probe = new Date(Date.UTC(y, mo - 1, d));
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== mo - 1 || probe.getUTCDate() !== d) {
    return null;
  }
  // The wall time as if it were UTC, then the zone's offset taken off.
  // Two passes: the offset is read at the guessed instant, and the guess
  // moves the instant, which can move the offset — on the day the clocks
  // change, exactly. The second read settles it.
  const wall = Date.UTC(y, mo - 1, d, 0, minutes);
  const first = wall - offsetMin(tz, new Date(wall)) * 60_000;
  return new Date(wall - offsetMin(tz, new Date(first)) * 60_000);
}

/**
 * The zone of a city, by id, out of the list the app holds.
 *
 * The default covers three cases that should all read as Vietnam: no city
 * id on the row, a city the list does not know, and a city row hydrated
 * from a cache written before the column existed.
 */
export function cityTz(
  cities: readonly { id: string; tz?: string | null }[],
  cityId: string | null | undefined,
): string {
  return cities.find((c) => c.id === cityId)?.tz ?? DEFAULT_TZ;
}
