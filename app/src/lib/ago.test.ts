import { describe, expect, it } from 'vitest';
import { agoLabel, dayLabel, RELATIVE_DAYS, type Say } from './ago';
import { numericDate } from './format';

const NOW = Date.parse('2026-11-17T09:00:00Z');
const back = (ms: number) => new Date(NOW - ms).toISOString();
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

const en: Say = (e) => e;
const vi: Say = (_e, v) => v;

describe('agoLabel', () => {
  it('says "just now" under a minute, and for a stamp from the future', () => {
    expect(agoLabel(back(20_000), NOW, 'en', en)).toBe('just now');
    expect(agoLabel(back(-5 * MIN), NOW, 'en', en)).toBe('just now');
  });

  it('counts minutes, then hours', () => {
    expect(agoLabel(back(5 * MIN), NOW, 'en', en)).toBe('5m ago');
    expect(agoLabel(back(59 * MIN), NOW, 'vi', vi)).toBe('59 phút trước');
    expect(agoLabel(back(3 * HOUR), NOW, 'en', en)).toBe('3h ago');
    expect(agoLabel(back(23 * HOUR), NOW, 'vi', vi)).toBe('23 giờ trước');
  });

  it('says "yesterday" for one day, and counts days for a week', () => {
    expect(agoLabel(back(DAY), NOW, 'en', en)).toBe('yesterday');
    expect(agoLabel(back(DAY), NOW, 'vi', vi)).toBe('hôm qua');
    expect(agoLabel(back(2 * DAY), NOW, 'en', en)).toBe('2 days ago');
    expect(agoLabel(back(RELATIVE_DAYS * DAY), NOW, 'vi', vi)).toBe(`${RELATIVE_DAYS} ngày trước`);
  });

  it('turns to the date past a week, written as the check-in rows write it', () => {
    const iso = back((RELATIVE_DAYS + 1) * DAY);
    expect(agoLabel(iso, NOW, 'en', en)).toBe(numericDate('en', new Date(iso)));
    expect(agoLabel(iso, NOW, 'vi', vi)).toBe(numericDate('vi', new Date(iso)));
    expect(agoLabel(iso, NOW, 'en', en)).not.toMatch(/ago/);
  });
});

describe('dayLabel', () => {
  // The reader's calendar says 17 Nov.
  const today = new Date(2026, 10, 17, 9);

  it('says today, and yesterday, by the calendar and not by the hours between', () => {
    expect(dayLabel('2026-11-17', today, 'en', en)).toBe('today');
    expect(dayLabel('2026-11-16', today, 'vi', vi)).toBe('hôm qua');
    // A minute past midnight: the day before is still "yesterday".
    expect(dayLabel('2026-11-16', new Date(2026, 10, 17, 0, 1), 'en', en)).toBe('yesterday');
    // A minute before midnight: today is still "today".
    expect(dayLabel('2026-11-17', new Date(2026, 10, 17, 23, 59), 'en', en)).toBe('today');
  });

  it('says today for a day ahead of the reader’s own', () => {
    expect(dayLabel('2026-11-18', today, 'en', en)).toBe('today');
  });

  it('counts days up to a week, then writes the date', () => {
    expect(dayLabel('2026-11-15', today, 'en', en)).toBe('2 days ago');
    expect(dayLabel('2026-11-10', today, 'vi', vi)).toBe(`${RELATIVE_DAYS} ngày trước`);
    expect(dayLabel('2026-11-09', today, 'vi', vi)).toBe('09/11');
    expect(dayLabel('2026-01-05', today, 'en', en)).toBe('5 Jan');
  });

  it('counts whole days across a night the clocks changed', () => {
    // New York fell back on 1 Nov 2026: that night was 25 hours long.
    expect(dayLabel('2026-10-31', new Date(2026, 10, 2, 0, 30), 'en', en)).toBe('2 days ago');
  });
});
