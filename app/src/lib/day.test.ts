import { describe, expect, it } from 'vitest';
import { addDays, clampDay, dayName, daysBetween, fromISO, toISO, todayISO } from './day';

describe('toISO', () => {
  // The bug this file exists to prevent. `toISOString()` converts to UTC
  // first, so anywhere east of Greenwich the early hours report the day
  // before — in Vietnam, every morning until 07:00.
  it('reads the local calendar day, not the UTC one', () => {
    const earlyMorning = new Date(2026, 7, 16, 6, 30);
    expect(toISO(earlyMorning)).toBe('2026-08-16');
  });

  it('reads it at the other edge of the day too', () => {
    expect(toISO(new Date(2026, 7, 16, 23, 59))).toBe('2026-08-16');
    expect(toISO(new Date(2026, 7, 16, 0, 0))).toBe('2026-08-16');
  });

  it('pads month and day, so the string sorts', () => {
    expect(toISO(new Date(2026, 0, 5, 12))).toBe('2026-01-05');
  });

  it('agrees with todayISO for the same instant', () => {
    const now = new Date(2026, 7, 16, 6, 30);
    expect(todayISO(now)).toBe(toISO(now));
  });
});

describe('fromISO', () => {
  it('lands on the day it was given, locally', () => {
    const d = fromISO('2026-08-16')!;
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(7);
    expect(d.getDate()).toBe(16);
  });

  // Noon, not midnight: midnight is one hour from being the previous day
  // under daylight saving, and some platforms shift it.
  it('lands at noon, twelve hours from either edge', () => {
    expect(fromISO('2026-08-16')!.getHours()).toBe(12);
  });

  it('round-trips through toISO', () => {
    for (const iso of ['2026-01-01', '2026-02-28', '2026-08-16', '2026-12-31', '2028-02-29']) {
      expect(toISO(fromISO(iso)!)).toBe(iso);
    }
  });

  // `new Date(2026, 1, 30)` is happily the 2nd of March. A picker cannot
  // produce that, but a stored draft or a hand-edited value can, and
  // silently sliding the day is worse than refusing it.
  it('refuses a day that does not exist', () => {
    expect(fromISO('2026-02-30')).toBeNull();
    expect(fromISO('2026-13-01')).toBeNull();
    expect(fromISO('2026-04-31')).toBeNull();
    // 2026 is not a leap year.
    expect(fromISO('2026-02-29')).toBeNull();
  });

  it('refuses anything that is not a day at all', () => {
    for (const bad of ['', '   ', 'today', '2026-8-16', '16/08/2026', '2026-08-16T10:00:00Z']) {
      expect(fromISO(bad), bad).toBeNull();
    }
  });

  it('ignores padding around a real one', () => {
    expect(toISO(fromISO('  2026-08-16  ')!)).toBe('2026-08-16');
  });
});

describe('daysBetween', () => {
  it('counts whole days forward', () => {
    expect(daysBetween('2026-08-16', '2026-08-17')).toBe(1);
    expect(daysBetween('2026-08-16', '2026-08-23')).toBe(7);
  });

  it('counts backward as negative', () => {
    expect(daysBetween('2026-08-16', '2026-08-15')).toBe(-1);
  });

  it('is zero for the same day', () => {
    expect(daysBetween('2026-08-16', '2026-08-16')).toBe(0);
  });

  it('crosses months and years', () => {
    expect(daysBetween('2026-08-31', '2026-09-01')).toBe(1);
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1);
    // 2028 is a leap year, so February has 29 days.
    expect(daysBetween('2028-02-28', '2028-03-01')).toBe(2);
  });

  // Only bites under a timezone that has daylight saving, which is why
  // `npm run test:tz` exists — the suite's own TZ is Hanoi, which has
  // none. Subtracting two local noons across the US spring-forward gives
  // 1.958 days; a UTC ruler gives 2.
  it('counts whole days across a daylight-saving boundary', () => {
    // US DST 2026 begins Sunday 8 March; the EU's on 29 March.
    expect(daysBetween('2026-03-07', '2026-03-09')).toBe(2);
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2);
    // And back again in the autumn.
    expect(daysBetween('2026-10-31', '2026-11-02')).toBe(2);
  });

  it('has no answer when either end is not a day', () => {
    expect(daysBetween('2026-02-30', '2026-08-16')).toBeNull();
    expect(daysBetween('2026-08-16', 'nonsense')).toBeNull();
  });
});

describe('dayName', () => {
  const today = '2026-08-16';

  it('calls the near days what the reader calls them', () => {
    expect(dayName('2026-08-16', today)).toEqual({ kind: 'today' });
    expect(dayName('2026-08-17', today)).toEqual({ kind: 'tomorrow' });
  });

  // "In four days" is arithmetic the reader should not have to do.
  it('gives a date for anything further out', () => {
    const out = dayName('2026-08-20', today);
    expect(out?.kind).toBe('date');
    expect((out as { date: Date }).date.getDate()).toBe(20);
  });

  it('gives a date for the past rather than pretending', () => {
    expect(dayName('2026-08-15', today)?.kind).toBe('date');
  });

  it('has no name for a day that is not one', () => {
    expect(dayName('2026-02-30', today)).toBeNull();
  });
});

describe('clampDay', () => {
  const today = '2026-08-16';

  it('leaves a day inside the window alone', () => {
    expect(clampDay('2026-08-16', today)).toBe('2026-08-16');
    expect(clampDay('2026-09-01', today)).toBe('2026-09-01');
  });

  // There is no useful plan for last Tuesday.
  it('pulls the past up to today', () => {
    expect(clampDay('2026-08-15', today)).toBe(today);
    expect(clampDay('2020-01-01', today)).toBe(today);
  });

  it('holds the far future to a year out', () => {
    expect(clampDay('2087-01-01', today)).toBe(addDays(today, 365));
  });

  it('allows exactly a year', () => {
    const edge = addDays(today, 365);
    expect(clampDay(edge, today)).toBe(edge);
  });

  it('falls back to today for something that is not a day', () => {
    expect(clampDay('2026-02-30', today)).toBe(today);
    expect(clampDay('', today)).toBe(today);
  });
});

describe('addDays', () => {
  it('moves forward and back', () => {
    expect(addDays('2026-08-16', 1)).toBe('2026-08-17');
    expect(addDays('2026-08-16', -1)).toBe('2026-08-15');
    expect(addDays('2026-08-16', 0)).toBe('2026-08-16');
  });

  it('rolls over month and year ends', () => {
    expect(addDays('2026-08-31', 1)).toBe('2026-09-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
  });

  it('leaves something that is not a day alone', () => {
    expect(addDays('nope', 3)).toBe('nope');
  });
});
