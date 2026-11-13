import { describe, expect, it } from 'vitest';
import { groupDigits, nothingCounted, STAT_KINDS, statsOf, type StatsRow } from './listStats';

const row = (over: Partial<StatsRow> = {}): StatsRow => ({
  views_total: 120, views_7d: 15, likes_total: 4, likes_7d: 1,
  copies_total: 2, copies_7d: 0, trips_total: 3, trips_7d: 2, ...over,
});

describe('statsOf', () => {
  it('pairs each total with its own seven days', () => {
    expect(statsOf([row()])).toEqual({
      views: { total: 120, week: 15 },
      likes: { total: 4, week: 1 },
      copies: { total: 2, week: 0 },
      trips: { total: 3, week: 2 },
    });
  });

  // No row is the server saying "not yours", not "nothing yet".
  it('is null when the server answered no row', () => {
    expect(statsOf([])).toBeNull();
  });

  it('draws the four in the page’s order', () => {
    expect(STAT_KINDS).toEqual(['views', 'likes', 'copies', 'trips']);
  });
});

describe('nothingCounted', () => {
  const zero = { views_total: 0, views_7d: 0, likes_total: 0, likes_7d: 0, copies_total: 0, copies_7d: 0, trips_total: 0, trips_7d: 0 };

  it('is true of a list with nothing at all', () => {
    expect(nothingCounted(statsOf([zero])!)).toBe(true);
  });

  it('is false the moment any one figure has something', () => {
    for (const k of STAT_KINDS) {
      expect(nothingCounted(statsOf([{ ...zero, [`${k}_total`]: 1 }])!)).toBe(false);
    }
  });
});

describe('groupDigits', () => {
  it('groups by three with a comma, and with a point in Vietnamese', () => {
    expect(groupDigits(1284, 'en')).toBe('1,284');
    expect(groupDigits(1284, 'vi')).toBe('1.284');
    expect(groupDigits(1234567, 'ja')).toBe('1,234,567');
    expect(groupDigits(1234567, 'zh-Hant')).toBe('1,234,567');
  });

  it('leaves a figure under a thousand as it is', () => {
    expect(groupDigits(0, 'en')).toBe('0');
    expect(groupDigits(999, 'vi')).toBe('999');
  });
});
