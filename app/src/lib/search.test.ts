import { describe, expect, it } from 'vitest';
import { CATEGORIES } from './categories';
import {
  collectionHaystack, fold, matches, mergeTerms, placeHaystack, queryTerms,
} from './search';

const place = (p: Partial<Parameters<typeof placeHaystack>[0]> = {}) => ({
  name_en: 'CGV Ba Trieu', categories: ['fun'], ...p,
});

describe('fold', () => {
  it('strips diacritics so a plain keyboard reaches an accented name', () => {
    expect(fold('Bánh mì Huỳnh Hoa')).toBe('banh mi huynh hoa');
  });

  // `đ` is its own letter, not a d with a mark, so NFD leaves it alone.
  it('folds đ, which decomposition does not', () => {
    expect(fold('Đà Nẵng')).toBe('da nang');
    expect(fold('ĐỐNG ĐA')).toBe('dong da');
  });

  it('leaves Japanese alone rather than mangling it', () => {
    expect(fold('映画館')).toBe('映画館');
  });

  it('has an answer for nothing', () => {
    expect(fold(null)).toBe('');
    expect(fold(undefined)).toBe('');
  });
});

describe('queryTerms', () => {
  it('splits on whitespace and drops the gaps', () => {
    expect(queryTerms('  cafe   Saigon ')).toEqual(['cafe', 'saigon']);
  });

  it('is empty for an empty box', () => {
    expect(queryTerms('   ')).toEqual([]);
  });

  // No spaces to split on, so it arrives whole and matches as a substring.
  it('keeps a Japanese query as one token', () => {
    expect(queryTerms('映画館')).toEqual(['映画館']);
  });
});

describe('matches', () => {
  it('needs every word, so a second word narrows', () => {
    expect(matches('cafe in saigon', ['cafe', 'saigon'])).toBe(true);
    expect(matches('cafe in hanoi', ['cafe', 'saigon'])).toBe(false);
  });

  it('matches nothing against everything', () => {
    expect(matches('anything', [])).toBe(true);
  });
});

describe('mergeTerms', () => {
  it('unions the desk onto the defaults', () => {
    const out = mergeTerms({ fun: ['cinema'] }, { fun: ['rạp phim'] });
    expect(out.fun).toEqual(['cinema', 'rap phim']);
  });

  // The whole safety story: the table can only add. An empty row, a failed
  // fetch and a missing table all leave search as it shipped.
  it('cannot subtract', () => {
    expect(mergeTerms({ fun: ['cinema'] }, { fun: [] }).fun).toEqual(['cinema']);
    expect(mergeTerms({ fun: ['cinema'] }, null).fun).toEqual(['cinema']);
    expect(mergeTerms({ fun: ['cinema'] }, {}).fun).toEqual(['cinema']);
  });

  it('keeps a key only the desk knows about', () => {
    expect(mergeTerms({}, { newthing: ['abc'] }).newthing).toEqual(['abc']);
  });

  it('folds, so a term typed with diacritics meets a query without them', () => {
    expect(mergeTerms({}, { fun: ['Rạp Phim'] }).fun).toEqual(['rap phim']);
  });

  it('does not double a term the desk retyped in another case', () => {
    expect(mergeTerms({ fun: ['rap phim'] }, { fun: ['Rạp phim'] }).fun).toEqual(['rap phim']);
  });

  // Matching is `includes`, so a two-letter synonym is a category that
  // answers almost any query.
  it('drops terms too short to mean anything', () => {
    expect(mergeTerms({}, { fun: ['an', 'co', 'x'] }).fun).toEqual([]);
    expect(mergeTerms({}, { fun: ['bar'] }).fun).toEqual(['bar']);
  });

  // Two characters is a whole word in Japanese, and a script with no
  // alphabet has no shorter-is-vaguer problem.
  it('keeps a short CJK term, which is a whole word', () => {
    expect(mergeTerms({}, { fun: ['映画'] }).fun).toEqual(['映画']);
    expect(mergeTerms({}, { heritage: ['寺'] }).heritage).toEqual(['寺']);
  });

  it('ignores whitespace somebody left in the box', () => {
    expect(mergeTerms({}, { fun: ['  ', 'cinema  '] }).fun).toEqual(['cinema']);
  });
});

describe('placeHaystack', () => {
  // The bug this whole feature exists for: the word is in no field of the
  // record, and the label of the category it is filed under reads "Fun".
  it('finds a cinema by a word its record never contains', () => {
    const hay = placeHaystack(place(), { fun: ['cinema', 'rap phim'] });
    expect(matches(hay, queryTerms('cinema'))).toBe(true);
    expect(matches(hay, queryTerms('rạp phim'))).toBe(true);
    expect(matches(hay, queryTerms('CGV'))).toBe(true);
  });

  it('does not lend one category\'s words to another', () => {
    const cafe = placeHaystack(place({ categories: ['cafes'] }), { fun: ['cinema'] });
    expect(matches(cafe, queryTerms('cinema'))).toBe(false);
  });

  // Search never reads the reader's UI language, and the haystack is why:
  // all three sit in it at once.
  it('answers in any of the three languages at once', () => {
    const hay = placeHaystack({
      name_en: 'Temple of Literature', name_vi: 'Văn Miếu', name_ja: '文廟',
      categories: ['heritage'],
    });
    for (const q of ['temple of literature', 'van mieu', '文廟', 'heritage', 'văn hóa']) {
      expect(matches(hay, queryTerms(q)), q).toBe(true);
    }
  });

  it('reads the description, the area and the address too', () => {
    const hay = placeHaystack({
      name_en: 'A', desc_en: 'Third-wave espresso', neighborhood_en: 'Hoàn Kiếm',
      address: '45 Bà Triệu', vibe_tags: ['chill'], categories: ['cafes'],
    });
    for (const q of ['espresso', 'hoan kiem', 'ba trieu', 'chill']) {
      expect(matches(hay, queryTerms(q)), q).toBe(true);
    }
  });

  it('survives a place with nothing on it', () => {
    expect(() => placeHaystack({})).not.toThrow();
  });

  // A key the table does not know still contributes itself, so data that
  // grew ahead of the app is searchable rather than invisible.
  it('keeps an unknown category key as a word', () => {
    expect(placeHaystack({ categories: ['newthing'] })).toContain('newthing');
  });

  it('works with no synonyms at all', () => {
    expect(matches(placeHaystack(place()), queryTerms('cgv'))).toBe(true);
  });
});

describe('collectionHaystack', () => {
  it('matches a list by its title, its blurb or its curator', () => {
    const hay = collectionHaystack({
      title_vi: 'Cà phê Hà Nội', desc_en: 'Slow mornings', curator_handle: 'trang',
    });
    for (const q of ['ca phe', 'slow', 'trang']) {
      expect(matches(hay, queryTerms(q)), q).toBe(true);
    }
  });
});

// The shipped floor has to clear the same bar the desk's entries do —
// otherwise a default is silently dropped and nobody finds out.
describe('the built-in synonyms', () => {
  it('survive the merge, every one of them', () => {
    for (const [key, cat] of Object.entries(CATEGORIES)) {
      const shipped = cat.terms ?? [];
      const merged = mergeTerms({ [key]: shipped }, null)[key];
      expect(merged, `${key} lost a term to the length guard`)
        .toHaveLength(new Set(shipped.map((s) => fold(s))).size);
    }
  });

  it('reach the categories a reader would look for', () => {
    const terms = mergeTerms(
      Object.fromEntries(Object.entries(CATEGORIES).map(([k, c]) => [k, c.terms ?? []])),
      null,
    );
    const hit = (cat: string, q: string) =>
      matches(placeHaystack({ name_en: 'x', categories: [cat] }, terms), queryTerms(q));
    expect(hit('fun', 'cinema')).toBe(true);
    expect(hit('focus', 'laptop')).toBe(true);
    expect(hit('focus', 'làm việc')).toBe(true);
    expect(hit('nightlife', 'bia')).toBe(true);
    expect(hit('heritage', 'museum')).toBe(true);
    expect(hit('nature', 'công viên')).toBe(true);
  });
});
