import { describe, expect, it } from 'vitest';
import { agoLabel, RELATIVE_DAYS, type Say } from './ago';
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
