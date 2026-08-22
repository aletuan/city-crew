import { describe, expect, it } from 'vitest';
import { CATEGORIES } from './categories';
import {
  collectionHaystack, findPlaces, fold, kindAnswersTo, matches, mergeTerms, placeHaystack,
  queryTerms,
} from './search';

const place = (p: Partial<Parameters<typeof placeHaystack>[0]> = {}) => ({
  name_en: 'CGV Ba Trieu', categories: ['fun'], ...p,
});

describe('fold', () => {
  it('strips diacritics so a plain keyboard reaches an accented name', () => {
    expect(fold('Bánh mì Huỳnh Hoa')).toBe('banh mi huynh hoa');
  });

  // ── the café nobody could find ──
  //
  // The catalog holds `\u{1D402}\u{1D42B}\u{1D42E}\u{1D426}\u{1D41B}\u{1D42C}
  // \u{1D400}\u{1D42B}\u{1D42D}\u{1D41E}\u{1D425}\u{1D422}\u{1D41E}\u{1D42B}` —
  // Mathematical Bold, straight from Google's display name. NFD is
  // canonical decomposition and does not touch a codepoint that merely
  // looks like a letter, so the folded haystack kept the styled letters
  // while the folded needle held plain ones, and "crumbs" matched
  // nothing.
  it('reads a name written in styled characters', () => {
    expect(fold('\u{1D402}\u{1D42B}\u{1D42E}\u{1D426}\u{1D41B}\u{1D42C}')).toBe('crumbs');
  });

  it('reads fullwidth and ligatured names too', () => {
    expect(fold('\uFF13\uFF23 Roastery')).toBe('3c roastery');
    expect(fold('\uFB01nest')).toBe('finest');
  });

  // `đ` is its own letter, not a d with a mark, so no decomposition form
  // takes it apart. The explicit fold stays.
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
    expect(fold('')).toBe('');
  });

  // Both sides of every comparison run through this, so a second pass has
  // to be a no-op or a stored term stops meeting a live query.
  it('is idempotent', () => {
    for (const s of ['Bánh mì', 'Đà Nẵng', '映画館', 'CAFE', '  ']) {
      expect(fold(fold(s)), s).toBe(fold(s));
    }
  });

  it('folds the capital Đ as well as the small one', () => {
    expect(fold('Đường')).toBe('duong');
    expect(fold('ĐƯỜNG')).toBe('duong');
  });

  it('leaves digits, punctuation and spacing where they are', () => {
    expect(fold('45 Bà Triệu, Q. Hai Bà Trưng')).toBe('45 ba trieu, q. hai ba trung');
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

  it('folds on the way in, so the query meets the haystack folded', () => {
    expect(queryTerms('Bánh Mì')).toEqual(['banh', 'mi']);
  });

  // Every kind of whitespace a phone keyboard can produce, including the
  // newline a paste brings with it.
  it('treats tabs and newlines as gaps too', () => {
    expect(queryTerms('cafe\n\thanoi')).toEqual(['cafe', 'hanoi']);
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

  // From the start of a word, not from anywhere inside one. "caf" finding
  // "cafeteria" is what makes the box feel like it keeps up as you type —
  // a word start is where typing begins, so prefixes cost nothing.
  it('matches from the start of a word, so a half-typed query still narrows', () => {
    expect(matches('cafeteria', ['cafe'])).toBe(true);
    expect(matches('bun cha huong lien', ['huong'])).toBe(true);
  });

  // The rule the old substring behaviour got wrong, measured on real
  // words: "đền" folds to "den", which sits inside "garden", so a search
  // for a temple answered with a lake. `kindAnswersTo` had already
  // learned this for synonyms; the exact tier had the same hole.
  it('does not match the middle of a word — a temple is not inside a garden', () => {
    expect(matches('secret garden restaurant', ['den'])).toBe(false);
  });

  it('keeps scanning past a mid-word hit for a real word start', () => {
    expect(matches('garden of den tran', ['den'])).toBe(true);
  });

  // Word edges are anything that is not a letter or digit after folding,
  // not only spaces — the haystack joins vibe keys with underscores and
  // real names carry hyphens.
  it('treats punctuation as a word edge, not part of the word', () => {
    expect(matches('kid_friendly quiet', ['friendly'])).toBe(true);
    expect(matches('deep sii - van bao', ['van'])).toBe(true);
  });

  // Japanese writes without spaces, so a CJK term has no word edge to
  // start at and stays a plain substring — the same exemption `usable`
  // gives the length rule.
  it('matches Japanese inside a run, which has no word edges', () => {
    expect(matches('東京映画館', ['映画'])).toBe(true);
  });

  it('is order-blind — the words may arrive any way round', () => {
    expect(matches('bun cha hanoi', ['hanoi', 'bun'])).toBe(true);
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

  it('de-duplicates within one list, not only across the two', () => {
    expect(mergeTerms({ fun: ['cinema', 'Cinema', 'CINEMA'] }, null).fun).toEqual(['cinema']);
  });

  it('keeps the shipped words first, so the defaults read first in the desk', () => {
    expect(mergeTerms({ fun: ['cinema'] }, { fun: ['bowling'] }).fun)
      .toEqual(['cinema', 'bowling']);
  });

  it('has an answer for two empty maps', () => {
    expect(mergeTerms({}, {})).toEqual({});
    expect(mergeTerms({}, null)).toEqual({});
  });

  it('keeps a category the desk left empty as an empty list, not a hole', () => {
    expect(mergeTerms({}, { fun: [] })).toEqual({ fun: [] });
  });
});

describe('placeHaystack', () => {
  it('matches a place by what the place itself says', () => {
    expect(matches(placeHaystack(place()), queryTerms('CGV'))).toBe(true);
  });

  // Synonyms live in their own haystack, so a place's own words stay a
  // place's own words — see `findPlaces` for why that separation matters.
  it('holds no synonyms', () => {
    expect(matches(placeHaystack(place()), queryTerms('cinema'))).toBe(false);
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

  // The bottom rung of `categoriesOf`: a row written before the categories
  // column existed. Its one legacy value still reaches the right label.
  it('reads the legacy food flag, so an old row is not unsearchable', () => {
    const hay = placeHaystack({ name_en: 'Old row', category: 'food' });
    expect(matches(hay, queryTerms('eats'))).toBe(true);
    expect(matches(hay, queryTerms('ăn uống'))).toBe(true);
  });

  it('does not mind which of the optional fields are absent', () => {
    expect(placeHaystack({ name_en: 'A', vibe_tags: null, categories: null })).toContain('a');
    expect(placeHaystack({ desc_vi: 'chỉ có tiếng Việt' })).toContain('chi co tieng viet');
  });

  // The memo, asserted rather than assumed. Search asked for one hundred and
  // fifty-five of these on every keystroke and got the same answer every
  // time, because a place's own words do not change while somebody types.
  // Same string *identity*, not merely equal: a rebuild would produce a new
  // one, so this fails if the cache is ever dropped.
  it('builds a haystack once and hands back the same string after', () => {
    const p = place({ name_en: 'Remembered' });
    expect(placeHaystack(p)).toBe(placeHaystack(p));
  });

  // Keyed on the object rather than on anything inside it, which is what
  // makes a refetch correct with no version to bump: the catalog hands out
  // new objects and a new object simply misses. So an edit that lands from
  // the desk is searchable the moment it arrives.
  it('reads a refetched place afresh rather than from the old one', () => {
    const before = place({ name_en: 'Old name' });
    expect(placeHaystack(before)).toContain('old name');
    const after = place({ name_en: 'New name' });
    expect(placeHaystack(after)).toContain('new name');
    expect(placeHaystack(after)).not.toContain('old name');
  });
});

describe('kindAnswersTo', () => {
  const T = { fun: ['cinema', 'movie'], nightlife: ['bar'], cafes: ['quan ca phe'] };

  it('answers for any category the place carries', () => {
    const both = { categories: ['fun', 'nightlife'] };
    expect(kindAnswersTo(both, 'cinema', T)).toBe(true);
    expect(kindAnswersTo(both, 'bar', T)).toBe(true);
  });

  // So the box keeps answering while somebody is still typing.
  it('answers to the start of a word', () => {
    expect(kindAnswersTo({ categories: ['fun'] }, 'cine', T)).toBe(true);
  });

  // The other direction is deliberately not checked: a plural is a word
  // the desk adds after watching somebody type it, not a rule.
  it('does not answer to a word longer than the one it knows', () => {
    expect(kindAnswersTo({ categories: ['fun'] }, 'movies', T)).toBe(false);
  });

  // The bug that made this a phrase match. Tokenised, "quán ăn" becomes
  // "quan" and "an", and both are inside the café list's "quán cà phê" —
  // so a search for somewhere to eat came back with cafés.
  it('is not fooled by fragments of a multi-word term', () => {
    expect(kindAnswersTo({ categories: ['cafes'] }, 'quan an', T)).toBe(false);
    expect(kindAnswersTo({ categories: ['cafes'] }, 'quan ca phe', T)).toBe(true);
  });

  it('is not fooled across the gap between two terms either', () => {
    expect(kindAnswersTo({ categories: ['fun'] }, 'a mo', T)).toBe(false);
  });

  // The second thing a substring match got wrong, and the reason this
  // anchors to the start of a word: "đền" folds to "den", which sits
  // inside "garden", so a search for a temple came back with a lake.
  it('does not match from the middle of a word', () => {
    const N = { nature: ['garden', 'park'], heritage: ['den'] };
    expect(kindAnswersTo({ categories: ['nature'] }, 'den', N)).toBe(false);
    expect(kindAnswersTo({ categories: ['heritage'] }, 'den', N)).toBe(true);
    expect(kindAnswersTo({ categories: ['nature'] }, 'gar', N)).toBe(true);
  });

  // A word inside a multi-word term still counts, so somebody typing only
  // the distinctive half of a phrase is answered.
  it('answers to a word from the middle of a phrase', () => {
    const F = { fun: ['rap phim'] };
    expect(kindAnswersTo({ categories: ['fun'] }, 'phim', F)).toBe(true);
    expect(kindAnswersTo({ categories: ['fun'] }, 'rap ph', F)).toBe(true);
    expect(kindAnswersTo({ categories: ['fun'] }, 'him', F)).toBe(false);
  });

  it('says no to a place with no categories, and to a map with no words', () => {
    expect(kindAnswersTo({ name_en: 'A' }, 'cinema', T)).toBe(false);
    expect(kindAnswersTo({ categories: ['fun'] }, 'cinema', {})).toBe(false);
  });

  it('says no to an empty query rather than yes to everything', () => {
    expect(kindAnswersTo({ categories: ['fun'] }, '', T)).toBe(false);
    expect(kindAnswersTo({ categories: ['fun'] }, '   ', T)).toBe(false);
  });
});

// The tier rule, which is the whole design: a synonym fills a blank
// screen, it never dilutes a real answer.
describe('findPlaces', () => {
  const TERMS = { fun: ['cinema', 'bowling'], heritage: ['museum', 'temple'] };
  const cgv = { name_en: 'CGV Ba Trieu', categories: ['fun'] };
  const vanMieu = { name_en: 'Temple of Literature', categories: ['heritage'] };
  const museum = { name_en: 'Fine Arts Museum', categories: ['heritage'] };
  const all = [cgv, vanMieu, museum];

  // The bug this feature exists for: no record in the catalog says
  // "cinema", so nothing exact is at stake and the guess is welcome.
  it('reaches a cinema by a word no record contains', () => {
    const { hits, related } = findPlaces(all, 'cinema', TERMS);
    expect(hits).toEqual([]);
    expect(related).toEqual([cgv]);
  });

  // The regression that made this two-tier. Twenty-six heritage places
  // carry the synonym "museum"; exactly one of them is a museum.
  it('does not drown a real answer in its category', () => {
    const { hits, related } = findPlaces(all, 'museum', TERMS);
    expect(hits).toEqual([museum]);
    expect(related).toEqual([]);
  });

  // A category is a bucket, so its words are its whole bucket's words.
  // Honest only because the caller labels this tier as a guess.
  it('offers the nearest kind when the exact thing is not in the catalog', () => {
    const { hits, related } = findPlaces(all, 'bowling', TERMS);
    expect(hits).toEqual([]);
    expect(related).toEqual([cgv]);
  });

  it('finds nothing for a word nobody uses', () => {
    expect(findPlaces(all, 'helicopter', TERMS))
      .toEqual({ hits: [], related: [] });
  });

  it('has nothing to say about an empty box', () => {
    expect(findPlaces(all, '', TERMS)).toEqual({ hits: [], related: [] });
  });

  it('needs no synonyms to work at all', () => {
    expect(findPlaces(all, 'CGV', {}).hits).toEqual([cgv]);
  });

  // A place filed under a category the desk has written no words for
  // simply has none — it is not a hole to fall into.
  it('is unbothered by a category with no words', () => {
    const odd = { name_en: 'Somewhere', categories: ['newthing'] };
    expect(findPlaces([odd], 'cinema', TERMS).related).toEqual([]);
    expect(findPlaces([odd], 'somewhere', TERMS).hits).toEqual([odd]);
  });

  // The two tiers are never mixed, and a synonym never rescues half a
  // query: "cinema" is only in the synonyms and "trieu" only in the name,
  // so neither tier holds both words and the honest answer is nothing.
  it('will not stitch one word from each tier into a match', () => {
    const { hits, related } = findPlaces(all, 'cinema literature', TERMS);
    expect(hits).toEqual([]);
    expect(related).toEqual([]);
  });

  it('lists a place once even when two of its categories claim the word', () => {
    const both = { name_en: 'B', categories: ['fun', 'nightlife'] };
    const { related } = findPlaces([both], 'show',
      { fun: ['show'], nightlife: ['show'] });
    expect(related).toEqual([both]);
  });

  // "f" begins a word in two of the three haystacks — "fun" on the
  // cinema's category, "fine" in the museum's name — so the assertion is
  // about which order they come back in, not about who is in it.
  it('keeps the catalog\'s own order in both tiers', () => {
    expect(findPlaces(all, 'f', TERMS).hits).toEqual([cgv, museum]);
    expect(findPlaces(all, 'temple', TERMS).hits).toEqual([vanMieu]);
  });

  // The invariant the whole design rests on, stated once as a rule rather
  // than implied by the cases above.
  it('never returns both tiers at once, for any query', () => {
    const queries = ['cinema', 'museum', 'temple', 'bowling', 'cgv', 'zzz', 'e', 'ba trieu'];
    for (const q of queries) {
      const { hits, related } = findPlaces(all, q, TERMS);
      expect(hits.length && related.length, q).toBeFalsy();
    }
  });

  it('never puts the same place in both tiers', () => {
    for (const q of ['cinema', 'museum', 'cgv', 'temple']) {
      const { hits, related } = findPlaces(all, q, TERMS);
      const overlap = hits.filter((p) => related.includes(p));
      expect(overlap, q).toEqual([]);
    }
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
      findPlaces([{ name_en: 'x', categories: [cat] }], q, terms).related.length > 0;
    expect(hit('fun', 'cinema')).toBe(true);
    expect(hit('focus', 'laptop')).toBe(true);
    expect(hit('focus', 'làm việc')).toBe(true);
    expect(hit('nightlife', 'bia')).toBe(true);
    expect(hit('heritage', 'museum')).toBe(true);
    expect(hit('nature', 'công viên')).toBe(true);
  });
});
