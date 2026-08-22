import { describe, expect, it } from 'vitest';
import { escapeRoutes, phraseIn } from './deadend';

describe('phraseIn', () => {
  it('finds a whole phrase sitting inside a longer query', () => {
    expect(phraseIn('pizza 4p s thao dien', 'thao dien')).toBe(true);
  });

  it('finds it at the very start and the very end too', () => {
    expect(phraseIn('thao dien pizza', 'thao dien')).toBe(true);
    expect(phraseIn('pizza thao dien', 'thao dien')).toBe(true);
  });

  // The right edge is what keeps district numbers honest: "quan 1" is
  // half of "quan 10", and without the boundary every search mentioning
  // Quận 10 would grow a chip for Quận 1.
  it('does not take half of a longer word or number', () => {
    expect(phraseIn('quan 10 pizza', 'quan 1')).toBe(false);
    expect(phraseIn('quan 1 pizza', 'quan 1')).toBe(true);
  });

  // The left edge is the "đền in garden" rule search itself follows.
  it('does not start in the middle of a word', () => {
    expect(phraseIn('secret garden cafe', 'den')).toBe(false);
  });

  it('keeps scanning past a bad hit for a good one', () => {
    expect(phraseIn('garden den tho', 'den')).toBe(true);
  });

  it('reads CJK as a plain substring, which has no word edges', () => {
    expect(phraseIn('渋谷カフェ', '渋谷')).toBe(true);
  });

  it('never matches an empty phrase', () => {
    expect(phraseIn('anything', '')).toBe(false);
  });

  it('says no when the phrase simply is not there', () => {
    expect(phraseIn('bun cha hanoi', 'thao dien')).toBe(false);
  });
});

describe('escapeRoutes', () => {
  const thaoDien = {
    neighborhood_en: 'Thao Dien', neighborhood_vi: 'Thảo Điền', neighborhood_ja: 'タオディエン',
    categories: ['cafes'],
  };
  const district1 = { neighborhood_en: 'District 1', neighborhood_vi: 'Quận 1', categories: ['eats'] };
  const TERMS = { eats: ['pizza', 'quán ăn'] };

  it('finds the part of town hiding inside a failed query', () => {
    const routes = escapeRoutes("Pizza 4P's Thảo Điền", [thaoDien], {});
    expect(routes).toEqual([
      { kind: 'area', en: 'Thao Dien', vi: 'Thảo Điền', ja: 'タオディエン' },
    ]);
  });

  it('finds the kind of place too, via the synonym terms', () => {
    const routes = escapeRoutes("Pizza 4P's Thảo Điền", [thaoDien, district1], TERMS);
    expect(routes).toEqual([
      { kind: 'area', en: 'Thao Dien', vi: 'Thảo Điền', ja: 'タオディエン' },
      { kind: 'category', key: 'eats' },
    ]);
  });

  it('recognises a category by its own label, with no synonyms at all', () => {
    expect(escapeRoutes('cà phê ngon nhất', [thaoDien], {}))
      .toEqual([{ kind: 'category', key: 'cafes' }]);
  });

  // Every chip is a promise: a category this catalog holds no places for
  // must not be offered, because tapping it would be a second failure.
  it('never offers a category the catalog cannot answer for', () => {
    expect(escapeRoutes('pizza ngon', [thaoDien], TERMS)).toEqual([]);
  });

  it('prefers the longer of two areas that both appear', () => {
    const village = { neighborhood_en: 'Thao Dien Village', neighborhood_vi: 'Làng Thảo Điền' };
    const routes = escapeRoutes('cafe thao dien village', [thaoDien, village], {});
    expect(routes).toEqual([
      { kind: 'area', en: 'Thao Dien Village', vi: 'Làng Thảo Điền', ja: 'Thao Dien Village' },
    ]);
  });

  it('offers at most one of each kind, area first', () => {
    const routes = escapeRoutes('quán ăn thảo điền quận 1', [thaoDien, district1], TERMS);
    expect(routes).toHaveLength(2);
    expect(routes[0].kind).toBe('area');
    expect(routes[1]).toEqual({ kind: 'category', key: 'eats' });
  });

  it('reads each distinct neighbourhood once, however many places share it', () => {
    const twin = { ...thaoDien };
    expect(escapeRoutes('thao dien', [thaoDien, twin, district1], {}))
      .toEqual([{ kind: 'area', en: 'Thao Dien', vi: 'Thảo Điền', ja: 'タオディエン' }]);
  });

  it('skips places that name no neighbourhood', () => {
    const bare = { categories: ['cafes'] };
    expect(escapeRoutes('somewhere new', [bare], {})).toEqual([]);
  });

  it('falls back to the English name when a translation is missing', () => {
    const plain = { neighborhood_en: 'Hoan Kiem' };
    expect(escapeRoutes('pho hoan kiem', [plain], {}))
      .toEqual([{ kind: 'area', en: 'Hoan Kiem', vi: 'Hoan Kiem', ja: 'Hoan Kiem' }]);
  });

  it('has nothing to offer when the query holds nothing it knows', () => {
    expect(escapeRoutes('zzz qqq', [thaoDien, district1], TERMS)).toEqual([]);
  });
});
