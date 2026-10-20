import { describe, expect, it } from 'vitest';
import { cityShort, cityShortById } from './cityName';

// Picks by position, so each assertion says which of the three was asked for.
const en = (e: string) => e;
const vi = (_e: string, v: string) => v;
const ja = (_e: string, _v: string, j: string) => j;

const HN = { id: 'hn', short_en: 'Hanoi', short_vi: 'Hà Nội', short_ja: 'ハノイ' };
const DN = { id: 'dn', short_en: 'Da Nang', short_vi: 'Đà Nẵng', short_ja: null };

describe('cityShort', () => {
  it('hands each language its own name', () => {
    expect(cityShort(HN, en)).toBe('Hanoi');
    expect(cityShort(HN, vi)).toBe('Hà Nội');
    expect(cityShort(HN, ja)).toBe('ハノイ');
  });

  // A city the desk has not named in Japanese yet.
  it('reads English to a Japanese reader when there is no Japanese name', () => {
    expect(cityShort(DN, ja)).toBe('Da Nang');
    expect(cityShort({ short_en: 'Hue', short_vi: 'Huế' }, ja)).toBe('Hue');
  });
});

describe('cityShortById', () => {
  it('finds the city by its id', () => {
    expect(cityShortById([DN, HN], 'hn', vi)).toBe('Hà Nội');
    expect(cityShortById([DN, HN], 'dn', ja)).toBe('Da Nang');
  });

  it('is null for a city the list does not hold, or no id at all', () => {
    expect(cityShortById([HN], 'sg', en)).toBeNull();
    expect(cityShortById([HN], null, en)).toBeNull();
    expect(cityShortById([HN], undefined, en)).toBeNull();
    expect(cityShortById([HN], '', en)).toBeNull();
  });
});
