// The place's own clock, read in two zones and one that does not exist.
//
// The instants are UTC and the expectations are wall clocks, because
// that is the whole question: what does the café's clock say at this
// moment. Melbourne is the city that found the bug — ten hours ahead of
// Greenwich, eleven from the first Sunday in October — and Hanoi is the
// one every reading used to assume. The suite also runs under New York
// (`test:tz`), which is what proves none of this reads the device.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cityTz, DEFAULT_TZ, instantOn, offsetMin, wallClock } from './clock';

const HANOI = 'Asia/Ho_Chi_Minh';
const MELB = 'Australia/Melbourne';

afterEach(() => { vi.restoreAllMocks(); });

describe('wallClock', () => {
  // The screenshot: five to five on a Tuesday afternoon in Melbourne, a
  // café whose hours read 3 PM to 10 PM, and an app that said "opens
  // 15:00" because it had read the clock at five to two.
  it('reads Melbourne at Melbourne’s hour, not Vietnam’s', () => {
    const at = new Date('2026-09-22T06:56:00Z');
    expect(wallClock(at, MELB)).toEqual({ mins: 16 * 60 + 56, weekday: 1, y: 2026, m: 9, d: 22 });
    expect(wallClock(at, HANOI)).toEqual({ mins: 13 * 60 + 56, weekday: 1, y: 2026, m: 9, d: 22 });
  });

  it('crosses midnight where the zone does, and takes the weekday with it', () => {
    // 15:30 UTC on a Monday is Tuesday half past one in Melbourne, and
    // still Monday evening in Hanoi.
    const at = new Date('2026-09-21T15:30:00Z');
    expect(wallClock(at, MELB)).toMatchObject({ mins: 90, weekday: 1, d: 22 });
    expect(wallClock(at, HANOI)).toMatchObject({ mins: 22 * 60 + 30, weekday: 0, d: 21 });
  });

  it('counts the week from Monday, the way the hours strings do', () => {
    // A Sunday: JavaScript's 0, Google's 6.
    expect(wallClock(new Date('2026-09-20T02:00:00Z'), HANOI).weekday).toBe(6);
    expect(wallClock(new Date('2026-09-21T02:00:00Z'), HANOI).weekday).toBe(0);
  });

  // Victoria springs forward at 02:00 on the first Sunday in October;
  // Vietnam has not changed its clocks since 1975. The runtime knows
  // both, and this file does not have to.
  it('follows daylight saving in a zone that has it', () => {
    const beforeChange = new Date('2026-10-03T09:00:00Z'); // 19:00 AEST
    const afterChange = new Date('2026-10-04T09:00:00Z');  // 20:00 AEDT
    expect(wallClock(beforeChange, MELB).mins).toBe(19 * 60);
    expect(wallClock(afterChange, MELB).mins).toBe(20 * 60);
    expect(wallClock(beforeChange, HANOI).mins).toBe(16 * 60);
    expect(wallClock(afterChange, HANOI).mins).toBe(16 * 60);
  });

  it('falls back to Indochina Time for a zone the runtime refuses', () => {
    // A misspelt row in `cities.tz` must not take the feed down with it;
    // it reads as Vietnam, which is what it read as before the column.
    const at = new Date('2026-09-22T06:56:00Z');
    expect(wallClock(at, 'Mars/Olympus_Mons')).toEqual(wallClock(at, HANOI));
  });

  // An `Intl` that formats a real zone but answers in a shape the reader
  // must refuse. The zone name asked for is one nobody else uses, so the
  // cached formatter for a real zone is not the one being replaced — and
  // the formatter underneath is built on Hanoi, so the name itself is not
  // what trips the fallback (a bogus name would, on its own, and the
  // guard under test would never run).
  function answerWith(edit: (parts: Intl.DateTimeFormatPart[]) => Intl.DateTimeFormatPart[]) {
    const real = Intl.DateTimeFormat;
    vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(((locale: string, o: Intl.DateTimeFormatOptions) => {
      const f = new real(locale, { ...o, timeZone: HANOI });
      return { formatToParts: (d: Date) => edit(f.formatToParts(d)) } as unknown as Intl.DateTimeFormat;
    }) as never);
  }
  const HANOI_AT_SCREENSHOT = { mins: 13 * 60 + 56, weekday: 1, y: 2026, m: 9, d: 22 };

  it('falls back when the runtime mislabels the weekday', () => {
    answerWith((parts) => parts.map((p) => (p.type === 'weekday' ? { ...p, value: 'Xyz' } : p)));
    expect(wallClock(new Date('2026-09-22T06:56:00Z'), 'Test/Mislabelled')).toEqual(HANOI_AT_SCREENSHOT);
  });

  it('falls back when the runtime leaves a part off the clock', () => {
    // Without the hour. `Number('')` would be 0, so an empty default
    // would have read every such moment as midnight; the missing part is
    // refused instead and Vietnam read.
    answerWith((parts) => parts.filter((p) => p.type !== 'hour'));
    expect(wallClock(new Date('2026-09-22T06:56:00Z'), 'Test/Hourless')).toEqual(HANOI_AT_SCREENSHOT);
  });

  it('falls back when the runtime spells a number in words', () => {
    answerWith((parts) => parts.map((p) => (p.type === 'hour' ? { ...p, value: 'noon' } : p)));
    expect(wallClock(new Date('2026-09-22T06:56:00Z'), 'Test/Worded')).toEqual(HANOI_AT_SCREENSHOT);
  });
});

describe('offsetMin', () => {
  it('is 420 for Vietnam whatever the date', () => {
    expect(offsetMin(HANOI, new Date('2026-01-15T00:00:00Z'))).toBe(420);
    expect(offsetMin(HANOI, new Date('2026-07-15T00:00:00Z'))).toBe(420);
  });

  it('is 600 or 660 for Melbourne, by the date', () => {
    expect(offsetMin(MELB, new Date('2026-09-22T06:56:00Z'))).toBe(600);
    expect(offsetMin(MELB, new Date('2026-10-04T09:00:00Z'))).toBe(660);
  });

  it('is not shaved by the seconds on the instant', () => {
    // Read to the minute: fifty-nine seconds past must not read as a
    // minute less.
    expect(offsetMin(MELB, new Date('2026-09-22T06:56:59.900Z'))).toBe(600);
  });
});

describe('instantOn', () => {
  it('places seven in the evening on the zone’s clock', () => {
    expect(instantOn('2026-08-15', 19 * 60, HANOI)!.toISOString()).toBe('2026-08-15T12:00:00.000Z');
    expect(instantOn('2026-08-15', 19 * 60, MELB)!.toISOString()).toBe('2026-08-15T09:00:00.000Z');
  });

  it('runs past midnight and past the end of a month', () => {
    // 25:00 on the 31st is one in the morning on the 1st, a real hour
    // that used to be refused as an overflow.
    expect(instantOn('2026-08-31', 25 * 60, HANOI)!.toISOString()).toBe('2026-08-31T18:00:00.000Z');
    expect(instantOn('2026-08-31', 25 * 60, MELB)!.toISOString()).toBe('2026-08-31T15:00:00.000Z');
  });

  it('uses the offset of the day asked about, not today’s', () => {
    // Seven in the evening on the first day of Melbourne's summer time
    // is 08:00 UTC; the evening before it was 09:00.
    expect(instantOn('2026-10-04', 19 * 60, MELB)!.toISOString()).toBe('2026-10-04T08:00:00.000Z');
    expect(instantOn('2026-10-03', 19 * 60, MELB)!.toISOString()).toBe('2026-10-03T09:00:00.000Z');
  });

  it('lands a wall time the clocks skipped an hour on', () => {
    // 02:30 on 4 October 2026 never happens in Victoria; the instant
    // it gives is the one the clock shows as 03:30 AEDT.
    expect(instantOn('2026-10-04', 2 * 60 + 30, MELB)!.toISOString()).toBe('2026-10-03T16:30:00.000Z');
  });

  it('refuses what is not a day', () => {
    expect(instantOn('2026-02-30', 600, HANOI)).toBeNull();
    expect(instantOn('someday', 600, HANOI)).toBeNull();
    expect(instantOn('2026-13-01', 600, MELB)).toBeNull();
  });
});

describe('cityTz', () => {
  const cities = [{ id: 'hanoi', tz: HANOI }, { id: 'melbourne', tz: MELB }, { id: 'cached' }];

  it('gives a city its own zone', () => {
    expect(cityTz(cities, 'melbourne')).toBe(MELB);
    expect(cityTz(cities, 'hanoi')).toBe(HANOI);
  });

  it('reads Vietnam for a row with no city, an unknown city, or a city cached before the column', () => {
    expect(cityTz(cities, null)).toBe(DEFAULT_TZ);
    expect(cityTz(cities, undefined)).toBe(DEFAULT_TZ);
    expect(cityTz(cities, 'atlantis')).toBe(DEFAULT_TZ);
    expect(cityTz(cities, 'cached')).toBe(DEFAULT_TZ);
  });
});
