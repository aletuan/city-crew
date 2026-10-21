import { describe, expect, it } from 'vitest';
import { listsWord, pairUp, placesOf, reasonFor, scopeLine, shape } from './collectionShelf';

const en = (e: string) => e;
const vi = (_e: string, v: string) => v;
const ja = (_e: string, _v: string, j?: string) => j ?? '';

const hit = (over: { hits?: number; total?: number; place?: { name_en?: string; name_vi?: string; name_ja?: string | null } | null }) => ({
  c: null, hits: 3, total: 3, place: null, ...over,
});

describe('placesOf and listsWord', () => {
  it('count in the singular and the plural', () => {
    expect(placesOf(1, en)).toBe('1 place');
    expect(placesOf(3, en)).toBe('3 places');
    expect(placesOf(3, vi)).toBe('3 địa điểm');
    expect(listsWord(1, en)).toBe('1 collection');
    expect(listsWord(4, en)).toBe('4 collections');
    expect(listsWord(4, ja)).toBe('4件のコレクション');
  });
});

describe('reasonFor', () => {
  it('says nothing for a list the sift did not list', () => {
    expect(reasonFor(undefined, ['Cafés'], en)).toBeNull();
  });

  // Every place counted and found by its own words: the count says it all.
  it('says nothing when the ordinary count already does', () => {
    expect(reasonFor(hit({}), ['Cafés'], en)).toBeNull();
  });

  // The name alone: the reader just typed it, and "matches" before it
  // said nothing more (owner, 21 Oct 2026).
  it('names the place the words landed on, in the reader’s language', () => {
    const place = { name_en: 'MONO Coffee Lab', name_vi: 'MONO Cà phê', name_ja: null };
    expect(reasonFor(hit({ place }), [], en)).toBe('MONO Coffee Lab');
    expect(reasonFor(hit({ place }), [], vi)).toBe('MONO Cà phê');
    expect(reasonFor(hit({ place: { ...place, name_ja: 'モノ' } }), [], ja)).toBe('モノ');
    // A place named only in Vietnamese still has a name to give.
    expect(reasonFor(hit({ place: { name_vi: 'Quán Mơ' } }), [], vi)).toBe('Quán Mơ');
  });

  it('counts the part a chip reached, and names the chips', () => {
    expect(reasonFor(hit({ hits: 3, total: 8 }), ['Cafés', 'Hanoi'], en)).toBe('3 of 8 places · Cafés · Hanoi');
    expect(reasonFor(hit({ hits: 1, total: 2 }), [], ja)).toBe('2 スポットのうち1');
  });

  it('says both when both are true', () => {
    expect(reasonFor(hit({ hits: 1, total: 4, place: { name_en: 'Mono' } }), ['Cafés'], en))
      .toBe('Mono · 1 of 4 places · Cafés');
  });
});

describe('scopeLine', () => {
  const cityName = (id: string) => ({ hn: 'Hanoi' } as Record<string, string>)[id] ?? id;

  it('names the chips when the shelf is narrowed', () => {
    expect(scopeLine({ count: 2, chosen: ['Cafés', 'Hanoi'], cities: ['hn', 'sg'], cityName }, en))
      .toBe('2 collections · Cafés · Hanoi');
  });

  it('names the one city, counts several, and says nothing of none', () => {
    expect(scopeLine({ count: 1, chosen: [], cities: ['hn'], cityName }, en)).toBe('1 collection · Hanoi');
    expect(scopeLine({ count: 5, chosen: [], cities: ['hn', 'sg', 'dn'], cityName }, en)).toBe('5 collections · 3 cities');
    expect(scopeLine({ count: 5, chosen: [], cities: ['hn', 'sg'], cityName }, vi)).toBe('5 bộ sưu tập · 2 thành phố');
    expect(scopeLine({ count: 0, chosen: [], cities: [], cityName }, en)).toBe('0 collections');
  });
});

describe('pairUp and shape', () => {
  it('packs tiles two to a row-item, the odd last one alone, each knowing where it sits', () => {
    expect(pairUp(['a', 'b', 'c'], true)).toEqual([
      { kind: 'pair', pair: ['a', 'b'], own: true, at: 0 },
      { kind: 'pair', pair: ['c'], own: true, at: 2 },
    ]);
    expect(shape(['a', 'b', 'c'], false, 'tile')).toEqual(pairUp(['a', 'b', 'c'], false));
  });

  // `at` is the card's place in the whole list, whichever shape it wears.
  it('gives rows one card each; the community’s carry where they sit', () => {
    expect(shape(['a', 'b'], true, 'row')).toEqual([{ kind: 'own', c: 'a' }, { kind: 'own', c: 'b' }]);
    expect(shape(['a', 'b'], false, 'row')).toEqual([{ kind: 'com', c: 'a', at: 0 }, { kind: 'com', c: 'b', at: 1 }]);
  });

  it('has no row-items for no lists', () => {
    expect(shape([], true, 'tile')).toEqual([]);
    expect(shape([], true, 'row')).toEqual([]);
  });
});
