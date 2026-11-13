import { describe, expect, it } from 'vitest';
import { listAgeOf } from './listAge';

// Every instant here is built on the phone's own calendar (`new Date(y, m,
// d, h, min, s)`), so each boundary holds in Hồ Chí Minh City and under
// `npm run test:tz`'s New York alike.
const at = (y: number, m: number, d: number, h = 12, min = 0, s = 0) => new Date(y, m, d, h, min, s);
const ageAt = (made: Date, now: Date) => listAgeOf(made.toISOString(), now);

describe('listAgeOf', () => {
  const now = at(2026, 10, 13, 12);
  const before = (ms: number) => new Date(now.getTime() - ms);
  const S = 1000;
  const M = 60 * S;
  const H = 60 * M;

  it('is new for its first minute, and minutes from the sixtieth second', () => {
    expect(ageAt(before(59 * S), now)).toEqual({ unit: 'new' });
    expect(ageAt(before(60 * S), now)).toEqual({ unit: 'minutes', n: 1 });
  });

  it('counts minutes to 59, and hours from the sixtieth', () => {
    expect(ageAt(before(59 * M), now)).toEqual({ unit: 'minutes', n: 59 });
    expect(ageAt(before(60 * M), now)).toEqual({ unit: 'hours', n: 1 });
  });

  it('counts hours to 23h59m, and gives the date from the 24th', () => {
    expect(ageAt(before(23 * H + 59 * M), now)).toEqual({ unit: 'hours', n: 23 });
    const day = before(24 * H);
    expect(ageAt(day, now)).toEqual({ unit: 'date', at: day, withYear: false });
  });

  it('is new when it is stamped in the future', () => {
    expect(ageAt(new Date(now.getTime() + 5 * M), now)).toEqual({ unit: 'new' });
    expect(ageAt(new Date(now.getTime() + 400 * 24 * H), now)).toEqual({ unit: 'new' });
  });

  it('keeps the year off a date this year and puts it on one from an earlier year', () => {
    expect(ageAt(at(2026, 0, 1, 9), now)).toMatchObject({ unit: 'date', withYear: false });
    expect(ageAt(at(2025, 11, 31, 9), now)).toMatchObject({ unit: 'date', withYear: true });
  });

  // The two that tell the phone's calendar from UTC's: early on 1 January
  // in Hồ Chí Minh City is still 31 December in UTC, and late on 31
  // December in New York is already 1 January there. Each zone the suite
  // runs in catches a UTC year with one of them.
  it('reads the year on the phone’s calendar, not UTC’s', () => {
    const jan2 = at(2026, 0, 2, 12);
    expect(ageAt(at(2026, 0, 1, 3), jan2)).toMatchObject({ unit: 'date', withYear: false });
    expect(ageAt(at(2025, 11, 31, 22), jan2)).toMatchObject({ unit: 'date', withYear: true });
  });
});
