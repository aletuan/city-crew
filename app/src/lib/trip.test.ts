// The wizard's arithmetic. No React here, and none in what it imports.

import { describe, expect, it } from 'vitest';
import { areaCentre, areasNear, canPlan, COMPANY, districtsOf, EMPTY_DRAFT, nearestAreaKm, toggle } from './trip';
import { CATEGORIES } from './categories';
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

describe('nearestAreaKm', () => {
  const places = [
    put('Hoàn Kiếm', 21.0285, 105.8542),
    put('Ba Đình', 21.0350, 105.8200),
  ];

  it('measures to the closest area, not to the first one listed', () => {
    // Standing on Ba Đình: the answer is Ba Đình's distance, near zero,
    // even though Hoàn Kiếm sorts first by every other rule in this file.
    expect(nearestAreaKm(places, { lat: 21.0350, lng: 105.8200 })).toBeLessThan(0.1);
  });

  // The reading that made this function necessary: eighty-five kilometres
  // from Hanoi, under a heading that said "nearby".
  it('is large when the reader is nowhere near the catalog', () => {
    const km = nearestAreaKm(places, { lat: 20.0, lng: 105.6 });
    expect(km).toBeGreaterThan(25);
  });

  it('cannot say without a point to measure from', () => {
    expect(nearestAreaKm(places, null)).toBeNull();
    expect(nearestAreaKm(places, undefined)).toBeNull();
  });

  it('cannot say when there are no areas at all', () => {
    expect(nearestAreaKm([], { lat: 21.03, lng: 105.85 })).toBeNull();
    expect(nearestAreaKm(many(null, 3), { lat: 21.03, lng: 105.85 })).toBeNull();
  });

  // Infinity is how `areasNear` keeps an unplaceable district at the back.
  // It must not escape as a distance, or the caller compares it to 25 and
  // silently drops the claim for a catalog that is perfectly local.
  it('cannot say when no area has coordinates', () => {
    expect(nearestAreaKm(many('Tây Hồ', 3), { lat: 21.03, lng: 105.85 })).toBeNull();
  });
});

describe('areaCentre', () => {
  it('is the mean of the area\'s places', () => {
    expect(areaCentre([
      put('Ba Đình', 21.03, 105.82),
      put('Ba Đình', 21.05, 105.84),
      put('Hoàn Kiếm', 21.0285, 105.8542),
    ], 'Ba Đình')).toEqual({ lat: 21.04, lng: 105.83 });
  });

  // The bug this exists for: choosing an area is a way of placing the pin,
  // and the sheet treated it as no pin at all. A district that cannot be
  // placed must say so rather than hand back (0, 0), which is a real point
  // in the Gulf of Guinea and would move the map there.
  it('cannot place an area whose every place lacks coordinates', () => {
    expect(areaCentre(many('Tây Hồ', 3), 'Tây Hồ')).toBeNull();
  });

  it('ignores the placeless ones when some of the area can be placed', () => {
    expect(areaCentre([...many('Tây Hồ', 2), put('Tây Hồ', 21.06, 105.82)], 'Tây Hồ'))
      .toEqual({ lat: 21.06, lng: 105.82 });
  });

  it('has no answer for an area that is not there', () => {
    expect(areaCentre([put('Ba Đình', 21.03, 105.82)], 'Nowhere')).toBeNull();
  });

  // `draft.district` is null whenever the reader has not chosen one, which
  // is most of the time.
  it('has no answer without a name', () => {
    const places = [put('Ba Đình', 21.03, 105.82)];
    expect(areaCentre(places, null)).toBeNull();
    expect(areaCentre(places, undefined)).toBeNull();
    expect(areaCentre(places, '   ')).toBeNull();
  });

  // The keys are trimmed when the areas are grouped, so the lookup has to
  // trim too or the two disagree about what a name is.
  it('finds an area whose name arrives padded', () => {
    expect(areaCentre([put('Ba Đình', 21.03, 105.82)], '  Ba Đình  '))
      .toEqual({ lat: 21.03, lng: 105.82 });
  });

  it('matches the name the chips are drawn from', () => {
    const places = [put('Ba Đình', 21.03, 105.82), put('Hoàn Kiếm', 21.0285, 105.8542)];
    for (const name of areasNear(places, { lat: 21.03, lng: 105.82 })) {
      expect(areaCentre(places, name)).not.toBeNull();
    }
  });
});

// The company chips sit directly above the category chips, so their
// glyph colours have to belong to the same family without pretending to
// be part of the same code. Those are rules a future sixth option could
// break silently, so they are written down here rather than in a comment.
describe('COMPANY colours', () => {
  const rgb = (c: string) => {
    const h = c.replace('#', '');
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  };
  const relLum = (c: string) => {
    const [r, g, b] = rgb(c).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const contrast = (a: string, b: string) => {
    const [hi, lo] = [relLum(a), relLum(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };
  const hue = (c: string) => {
    const [r, g, b] = rgb(c);
    const max = Math.max(r, g, b); const min = Math.min(r, g, b);
    if (max === min) return 0;
    const d = max - min;
    const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return ((h * 60) % 360 + 360) % 360;
  };
  const apart = (a: number, b: number) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));

  const LIGHT = '#F5F1EA';
  const DARK = '#0A0B0A';
  const cats = Object.values(CATEGORIES).map((c) => c.color);
  const coloured = COMPANY.filter((c) => c.color);

  it('gives every option but Other a glyph and a colour', () => {
    for (const c of COMPANY.filter((x) => x.key !== 'other')) {
      expect(c.icon, c.key).toBeTruthy();
      expect(c.color, c.key).toMatch(/^#[0-9A-F]{6}$/i);
    }
    expect(coloured).toHaveLength(4);
  });

  // An ellipsis is a promise of more to tap, and this chip is an answer
  // like the rest of them.
  it('leaves Other without a glyph', () => {
    const other = COMPANY.find((c) => c.key === 'other');
    expect(other?.icon).toBeUndefined();
  });

  it('reuses no category colour, which would read as the same thing', () => {
    for (const c of coloured) expect(cats).not.toContain(c.color!);
  });

  // Close enough to a category hue and the eye pairs the two rows that
  // have nothing to do with each other.
  it('keeps every hue clear of every category hue', () => {
    for (const c of coloured) {
      const nearest = Math.min(...cats.map((k) => apart(hue(c.color!), hue(k))));
      expect(nearest, `${c.key} is ${nearest.toFixed(0)}° from a category hue`)
        .toBeGreaterThanOrEqual(15);
    }
  });

  it('keeps them apart from each other too', () => {
    for (let i = 0; i < coloured.length; i += 1) {
      for (let j = i + 1; j < coloured.length; j += 1) {
        expect(apart(hue(coloured[i].color!), hue(coloured[j].color!)))
          .toBeGreaterThanOrEqual(15);
      }
    }
  });

  // The one a measurement actually caught: equal HSL lightness across
  // hues is not equal contrast, and an amber picked that way came out at
  // 1.52:1 — visibly fainter than everything beside it.
  it('sits inside the category palette\'s own contrast range', () => {
    const range = (bg: string) => {
      const all = cats.map((c) => contrast(c, bg));
      return [Math.min(...all), Math.max(...all)] as const;
    };
    for (const bg of [LIGHT, DARK]) {
      const [lo, hi] = range(bg);
      for (const c of coloured) {
        const got = contrast(c.color!, bg);
        expect(got, `${c.key} on ${bg}`).toBeGreaterThanOrEqual(lo);
        expect(got, `${c.key} on ${bg}`).toBeLessThanOrEqual(hi);
      }
    }
  });
});