// The wizard's arithmetic. No React here, and none in what it imports.

import { describe, expect, it } from 'vitest';
import { areasNear, canPlan, districtsOf, EMPTY_DRAFT, toggle } from './trip';
import type { Place } from './types';

const at = (neighborhood_en: string | null): Place => ({
  slug: `p${Math.random()}`, name_en: 'P', name_vi: 'P', name_ja: null, category: 'food',
  is_featured: false, vibe_tags: [], neighborhood_en, neighborhood_vi: null,
  neighborhood_ja: null, address: null, lat: null, lng: null, rating: null,
  rating_count: null, price_display: null, price_vnd: null, duration_min: null,
  duration_max: null, desc_en: null, desc_vi: null, desc_ja: null, emoji: null,
  opening_hours: null, website: null, phone: null, place_photos: [],
});

const many = (name: string | null, n: number) => Array.from({ length: n }, () => at(name));

describe('districtsOf', () => {
  // The order is a recommendation. Alphabetical would put a district with
  // one café above the one with eleven, and nothing on the chip tells the
  // reader which is which before they tap it.
  it('puts the busiest district first', () => {
    const places = [...many('Thanh Xuân', 2), ...many('Hoàn Kiếm', 5), ...many('Ba Đình', 3)];
    expect(districtsOf(places)).toEqual(['Hoàn Kiếm', 'Ba Đình', 'Thanh Xuân']);
  });

  // Two districts with four places each must not swap when the catalog
  // reloads, so the tie-break is the name rather than whatever order the
  // rows arrived in.
  it('breaks ties on name so the list does not shuffle', () => {
    const a = [...many('Ba Đình', 4), ...many('Hoàn Kiếm', 4)];
    const b = [...many('Hoàn Kiếm', 4), ...many('Ba Đình', 4)];
    expect(districtsOf(a)).toEqual(districtsOf(b));
    expect(districtsOf(a)).toEqual(['Ba Đình', 'Hoàn Kiếm']);
  });

  // A chip promises places behind it. Counting off the places themselves
  // is the only list that cannot make a promise the catalog will not keep.
  it('never offers a district with nothing in it', () => {
    expect(districtsOf([at(null), at('  '), at('Hoàn Kiếm')])).toEqual(['Hoàn Kiếm']);
  });

  it('offers nothing at all from an empty catalog', () => {
    expect(districtsOf([])).toEqual([]);
  });

  it('caps the row rather than running off the screen', () => {
    const places = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].flatMap((n, i) => many(n, 8 - i));
    expect(districtsOf(places)).toHaveLength(6);
    expect(districtsOf(places, 3)).toEqual(['a', 'b', 'c']);
  });
});

describe('toggle', () => {
  it('adds what is missing and removes what is there', () => {
    expect(toggle(['a'], 'b')).toEqual(['a', 'b']);
    expect(toggle(['a', 'b'], 'a')).toEqual(['b']);
  });

  it('keeps the order the reader built', () => {
    expect(toggle(toggle(toggle([], 'c'), 'a'), 'b')).toEqual(['c', 'a', 'b']);
  });

  it('leaves the original alone', () => {
    const before = ['a'];
    toggle(before, 'b');
    expect(before).toEqual(['a']);
  });
});

describe('canPlan', () => {
  it('wants somebody to plan for and something to do', () => {
    expect(canPlan(EMPTY_DRAFT)).toBe(false);
    expect(canPlan({ ...EMPTY_DRAFT, company: 'couple' })).toBe(false);
    expect(canPlan({ ...EMPTY_DRAFT, categories: ['cafes'] })).toBe(false);
    expect(canPlan({ ...EMPTY_DRAFT, company: 'couple', categories: ['cafes'] })).toBe(true);
  });

  // "Near me" is a legitimate answer and the default one, and starting
  // from a collection is a way to begin rather than a requirement to.
  it('does not hold out for a district or a collection', () => {
    const ready = { ...EMPTY_DRAFT, company: 'solo' as const, categories: ['nature'] };
    expect(canPlan(ready)).toBe(true);
    expect(ready.district).toBeNull();
    expect(ready.from).toEqual([]);
  });
});

// A place with a position, for the ordering the chips do.
const put = (name: string, lat: number, lng: number): Place => ({ ...at(name), lat, lng });

describe('areasNear', () => {
  // Hanoi-ish coordinates: Hoàn Kiếm in the middle, Ba Đình a couple of
  // kilometres west, Long Biên across the river.
  const places = [
    put('Hoàn Kiếm', 21.0285, 105.8542),
    put('Hoàn Kiếm', 21.0290, 105.8550),
    put('Ba Đình', 21.0350, 105.8200),
    put('Long Biên', 21.0450, 105.8900),
  ];

  it('puts the closest district first, wherever the pin is', () => {
    expect(areasNear(places, { lat: 21.0350, lng: 105.8200 })[0]).toBe('Ba Đình');
    expect(areasNear(places, { lat: 21.0450, lng: 105.8900 })[0]).toBe('Long Biên');
    expect(areasNear(places, { lat: 21.0287, lng: 105.8546 })[0]).toBe('Hoàn Kiếm');
  });

  // The whole complaint: standing in one district and being offered the
  // busiest one first because it is the busiest.
  it('does not simply repeat the busiest-first order', () => {
    const busy = [...many('Hoàn Kiếm', 20).map((p) => ({ ...p, lat: 21.0285, lng: 105.8542 })),
      put('Ba Đình', 21.0350, 105.8200)];
    expect(districtsOf(busy)[0]).toBe('Hoàn Kiếm');
    expect(areasNear(busy, { lat: 21.0350, lng: 105.8200 })[0]).toBe('Ba Đình');
  });

  // Reordered, never filtered: a far chip the reader can see is far beats
  // no chips at all.
  it('keeps every district it was given, up to the limit', () => {
    expect(areasNear(places, { lat: 10.7769, lng: 106.7009 })).toHaveLength(3);
    expect(areasNear(places, { lat: 21.03, lng: 105.85 }, 2)).toHaveLength(2);
  });

  // No point to measure from is not an error, it is the state before the
  // reader has said anything.
  it('falls back to busiest-first with no position', () => {
    expect(areasNear(places, null)).toEqual(districtsOf(places));
    expect(areasNear(places, undefined)).toEqual(districtsOf(places));
  });

  // A district whose places all lack coordinates cannot be placed, and is
  // still a district somebody may want.
  it('keeps a district with no coordinates, at the back', () => {
    const mixed = [...places, ...many('Tây Hồ', 3)];
    const out = areasNear(mixed, { lat: 21.0285, lng: 105.8542 });
    expect(out).toContain('Tây Hồ');
    expect(out[out.length - 1]).toBe('Tây Hồ');
  });

  it('ignores places with no district at all', () => {
    expect(areasNear([...places, ...many(null, 4)], { lat: 21.03, lng: 105.85 })).toHaveLength(3);
  });
});
