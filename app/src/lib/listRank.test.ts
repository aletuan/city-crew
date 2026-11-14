import { describe, expect, it } from 'vitest';
import {
  AUTHOR_RUN, FRESH_GONE_DAYS, FULL_AT, LIST_RATING_SD, LIST_WEIGHTS, listFacts, listScores, meanRating, rankLists,
  THIN_BELOW, THIN_PENALTY, USED_FLOOR, listUseBySlug, VIEWS_FROM, type ListFacts, type ListUse, type RankedList,
} from './listRank';
import { NEW_LIST_DAYS } from './newest';

const NOW = Date.parse('2026-11-14T05:00:00Z');
const MEAN = 4.6;
const daysAgo = (d: number) => new Date(NOW - d * 86_400_000).toISOString();

type Row = RankedList & { facts?: Partial<ListFacts> };

/** A finished list nothing separates from the next: described, exactly
 *  full, every place at the mean, long past new. Its content is the half
 *  a full list earns and half of the half a rating can, and every other
 *  term is nothing. */
const list = (slug: string, more: Partial<Row> = {}): Row => ({ slug, created_at: daysAgo(60), ...more });
const full = Array.from({ length: FULL_AT }, () => ({ rating: MEAN, rating_count: 100 }));
const factsOf = (c: Row): ListFacts => ({ places: full, described: true, taste: 0, ...c.facts });
const BASE = LIST_WEIGHTS.content * 0.75;

const scores = (rows: Row[], o: { likes?: Record<string, number>; use?: Record<string, ListUse> } = {}) =>
  listScores(rows, { factsOf, likes: o.likes ?? {}, use: o.use, mean: MEAN, now: NOW });
const order = (rows: Row[], o: { likes?: Record<string, number>; use?: Record<string, ListUse> } = {}) =>
  rankLists(rows, { factsOf, likes: o.likes ?? {}, use: o.use, mean: MEAN, now: NOW }).map((c) => c.slug);

describe('the weights', () => {
  it('sum to one over the five that describe the list, with taste on top', () => {
    const { taste, ...own } = LIST_WEIGHTS;
    expect(Object.values(own).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
    expect(taste).toBe(0.1);
  });

  // The figures `docs/collection-ranking.md` gives, pinned: every other
  // test here reads them by name, and would pass on any numbers.
  it('are the document’s', () => {
    expect(LIST_WEIGHTS).toEqual({ likes: 0.3, used: 0.25, content: 0.2, fresh: 0.15, views: 0.1, taste: 0.1 });
    expect({ THIN_PENALTY, THIN_BELOW, FULL_AT, USED_FLOOR, FRESH_GONE_DAYS, VIEWS_FROM, AUTHOR_RUN, LIST_RATING_SD })
      .toEqual({ THIN_PENALTY: 0.85, THIN_BELOW: 3, FULL_AT: 8, USED_FLOOR: 5, FRESH_GONE_DAYS: 21, VIEWS_FROM: 20, AUTHOR_RUN: 2, LIST_RATING_SD: 0.2 });
  });
});

describe('listScores', () => {
  it('gives a finished, average list nobody has touched three quarters of its content and nothing else', () => {
    expect(scores([list('a')])[0]).toBeCloseTo(BASE, 10);
  });

  it('counts likes on a log, so the twelfth is not worth the first', () => {
    const [top, some, none] = scores([list('a'), list('b'), list('c')], { likes: { a: 12, b: 2 } });
    expect(top).toBeCloseTo(BASE + LIST_WEIGHTS.likes, 10);
    expect(some).toBeCloseTo(BASE + LIST_WEIGHTS.likes * (Math.log(3) / Math.log(13)), 10);
    expect(none).toBeCloseTo(BASE, 10);
    // Two of twelve likes is a sixth of the count and well over a third
    // of the score.
    expect((some - BASE) / (top - BASE)).toBeGreaterThan(0.4);
  });

  it('holds one use to a floor while the most-used list has few', () => {
    const use = { a: { uses: 1, views: 0, liked: 0 } };
    const [a, b] = scores([list('a'), list('b')], { use });
    expect(a - BASE).toBeCloseTo(LIST_WEIGHTS.used * (Math.log(2) / Math.log(1 + USED_FLOOR)), 10);
    expect(b).toBeCloseTo(BASE, 10);
  });

  it('measures use against the most-used list once it is past the floor', () => {
    const use = { a: { uses: 9, views: 0, liked: 0 }, b: { uses: 3, views: 0, liked: 0 } };
    const [a, b] = scores([list('a'), list('b')], { use });
    expect(a - BASE).toBeCloseTo(LIST_WEIGHTS.used, 10);
    expect(b - BASE).toBeCloseTo(LIST_WEIGHTS.used * (Math.log(4) / Math.log(10)), 10);
  });

  it('counts a place towards fullness until the list is full, and not after', () => {
    const of = (n: number) => ({ places: full.concat(full, full).slice(0, n) });
    const [half, whole, more] = scores([list('a', { facts: of(FULL_AT / 2) }), list('b', { facts: of(FULL_AT) }), list('c', { facts: of(FULL_AT * 3) })]);
    expect(half).toBeCloseTo(LIST_WEIGHTS.content * 0.5, 10);
    expect(whole).toBeCloseTo(BASE, 10);
    expect(more).toBeCloseTo(whole, 10);
  });

  it('reads a rating two standard deviations either side of the mean, and no further', () => {
    // Counts so large the shrink towards the mean moves nothing.
    const rated = (rating: number) => ({ places: full.map(() => ({ rating, rating_count: 1e12 })) });
    const at = (rating: number) => scores([list('a', { facts: rated(rating) })])[0] - LIST_WEIGHTS.content * 0.5;
    expect(at(MEAN)).toBeCloseTo(LIST_WEIGHTS.content * 0.25, 8);
    expect(at(MEAN + LIST_RATING_SD)).toBeCloseTo(LIST_WEIGHTS.content * 0.375, 8);
    expect(at(MEAN + 2 * LIST_RATING_SD)).toBeCloseTo(LIST_WEIGHTS.content * 0.5, 8);
    expect(at(MEAN - 2 * LIST_RATING_SD)).toBeCloseTo(0, 8);
    expect(at(MEAN - 1)).toBe(0);
    expect(at(5)).toBeCloseTo(LIST_WEIGHTS.content * 0.5, 8);
  });

  it('scores two lists of the same places the same, however many of them there are', () => {
    // Min–max over the shelf put these a half of content apart, on the
    // last bit of a floating-point mean.
    const of = (n: number) => ({ places: Array.from({ length: n }, () => ({ rating: 4.7, rating_count: 37 })) });
    const [a, b] = scores([list('a', { facts: of(FULL_AT) }), list('b', { facts: of(FULL_AT * 3) })]);
    expect(a).toBeCloseTo(b, 10);
  });

  it('believes a rating by how many gave it, and takes an unrated place at the mean', () => {
    // Five stars from three people is nearer the mean than 4.9 from two
    // thousand; a place with no rating at all is the mean exactly.
    const few = { places: full.map(() => ({ rating: 5, rating_count: 3 })) };
    const many = { places: full.map(() => ({ rating: 4.9, rating_count: 2000 })) };
    const unrated = { places: full.map(() => ({})) };
    const [a, b, c] = scores([list('a', { facts: few }), list('b', { facts: many }), list('c', { facts: unrated })]);
    expect(b).toBeGreaterThan(a);
    expect(a).toBeGreaterThan(c);
    expect(c).toBeCloseTo(BASE, 10);
  });

  it('gives a list with no places no content at all, and the penalty', () => {
    const [empty, other] = scores([list('a', { facts: { places: [] } }), list('b')], { likes: { a: 3, b: 3 } });
    expect(empty).toBeCloseTo(THIN_PENALTY * LIST_WEIGHTS.likes, 10);
    expect(other).toBeCloseTo(BASE + LIST_WEIGHTS.likes, 10);
  });

  it('is new for the week the badge shows, and then less each day until it is not', () => {
    const at = (d: number | null) => scores([list('a', { created_at: d == null ? null : daysAgo(d) })])[0] - BASE;
    expect(at(0)).toBeCloseTo(LIST_WEIGHTS.fresh, 10);
    expect(at(NEW_LIST_DAYS)).toBeCloseTo(LIST_WEIGHTS.fresh, 10);
    expect(at((NEW_LIST_DAYS + FRESH_GONE_DAYS) / 2)).toBeCloseTo(LIST_WEIGHTS.fresh / 2, 10);
    expect(at(FRESH_GONE_DAYS)).toBeCloseTo(0, 10);
    expect(at(90)).toBeCloseTo(0, 10);
    // A clock that disagrees is not a reason to bury a new list.
    expect(at(-1)).toBeCloseTo(LIST_WEIGHTS.fresh, 10);
  });

  it('does not call a list new that has no date, or a date that is not one', () => {
    for (const x of scores([list('a', { created_at: null }), list('b', { created_at: undefined }), list('c', { created_at: 'soon' })])) {
      expect(x).toBeCloseTo(BASE, 10);
    }
  });

  it('does not lift an unfinished list for being new', () => {
    const thin = { places: full.slice(0, THIN_BELOW - 1) };
    const enough = { places: full.slice(0, THIN_BELOW) };
    const [a, b] = scores([list('a', { created_at: daysAgo(1), facts: thin }), list('b', { created_at: daysAgo(1), facts: enough })]);
    expect(a).toBeCloseTo(THIN_PENALTY * LIST_WEIGHTS.content * (0.5 * ((THIN_BELOW - 1) / FULL_AT) + 0.25), 10);
    expect(b).toBeCloseTo(LIST_WEIGHTS.content * (0.5 * (THIN_BELOW / FULL_AT) + 0.25) + LIST_WEIGHTS.fresh, 10);
  });

  it('takes the penalty once for a list that is both thin and undescribed', () => {
    const [both, one] = scores([
      list('a', { facts: { places: full.slice(0, 1), described: false } }),
      list('b', { facts: { places: full.slice(0, 1) } }),
    ]);
    expect(both).toBe(one);
  });

  it('keeps part of an undescribed list back', () => {
    const [bare, said] = scores([list('a', { facts: { described: false } }), list('b')], { likes: { a: 5, b: 5 } });
    expect(bare).toBeCloseTo(THIN_PENALTY * said, 10);
  });

  it('reads likes per open, and only from a list opened enough to say', () => {
    const use = {
      a: { uses: 0, views: VIEWS_FROM, liked: 4 },
      b: { uses: 0, views: VIEWS_FROM * 2, liked: 4 },
      c: { uses: 0, views: VIEWS_FROM - 1, liked: 19 },
    };
    const [a, b, c, d] = scores([list('a'), list('b'), list('c'), list('d')], { use });
    expect(a - BASE).toBeCloseTo(LIST_WEIGHTS.views, 10);
    expect(b - BASE).toBeCloseTo(LIST_WEIGHTS.views / 2, 10);
    expect(c).toBeCloseTo(BASE, 10);
    expect(d).toBeCloseTo(BASE, 10);
  });

  it('falls when its author opens it again', () => {
    const before = scores([list('a'), list('b')], { use: { a: { uses: 0, views: 20, liked: 4 }, b: { uses: 0, views: 20, liked: 2 } } });
    const after = scores([list('a'), list('b')], { use: { a: { uses: 0, views: 20, liked: 4 }, b: { uses: 0, views: 80, liked: 2 } } });
    expect(after[1]).toBeLessThan(before[1]);
  });

  it('adds what the reader leans towards, to the weight and no further', () => {
    const [a, b] = scores([list('a', { facts: { taste: 1 } }), list('b', { facts: { taste: 0.5 } })]);
    expect(a - BASE).toBeCloseTo(LIST_WEIGHTS.taste, 10);
    expect(b - BASE).toBeCloseTo(LIST_WEIGHTS.taste / 2, 10);
  });

  it('has nothing to say about an empty shelf', () => {
    expect(scores([])).toEqual([]);
  });
});

describe('rankLists', () => {
  it('puts the highest score first', () => {
    expect(order([list('quiet'), list('liked'), list('used')], {
      likes: { liked: 4, used: 4 }, use: { used: { uses: 2, views: 0, liked: 0 } },
    })).toEqual(['used', 'liked', 'quiet']);
  });

  it('lets a new list nobody has liked yet stand above an old one somebody has', () => {
    // The cold start the freshness term is for: 0.15 against one like of
    // twelve, 0.30 × ln2/ln13.
    expect(order([list('old', { created_at: daysAgo(80) }), list('new', { created_at: daysAgo(2) }), list('top')],
      { likes: { old: 1, top: 12 } })).toEqual(['top', 'new', 'old']);
  });

  it('breaks a tie by the newest, then the desk sequence, then the slug', () => {
    const at = daysAgo(40);
    expect(order([
      list('z', { created_at: at }), list('a', { created_at: at }),
      list('second', { created_at: at, sort_order: 2 }), list('first', { created_at: at, sort_order: 1 }),
      list('newer', { created_at: daysAgo(30) }),
      list('undated-b', { created_at: null }), list('undated-a', { created_at: null }),
    ])).toEqual(['newer', 'first', 'second', 'a', 'z', 'undated-a', 'undated-b']);
  });

  it('does not let the last bit of a mean decide between two lists', () => {
    // Twenty-four places at 4.6 average a hair under eight of them, in
    // the sixteenth place. The newer list is first all the same.
    const many = { places: full.concat(full, full) };
    expect(scores([list('older'), list('newer', { facts: many })])[0])
      .not.toBe(scores([list('older'), list('newer', { facts: many })])[1]);
    expect(order([list('older', { created_at: daysAgo(50) }), list('newer', { created_at: daysAgo(40), facts: many })]))
      .toEqual(['newer', 'older']);
  });

  it('is one order, whatever order the lists came in', () => {
    const shelf = [list('c'), list('a'), list('b')];
    expect(order([...shelf].reverse())).toEqual(order(shelf));
  });

  it('does not disturb the array it was given', () => {
    const shelf = [list('b'), list('a')];
    order(shelf, { likes: { a: 9 } });
    expect(shelf.map((c) => c.slug)).toEqual(['b', 'a']);
  });

  it('lets no author stand more than twice in a row', () => {
    const by = (slug: string, owner_id: string | null, likes: number) => [list(slug, { owner_id }), likes] as const;
    const shelf = [by('t1', 't', 9), by('t2', 't', 8), by('t3', 't', 7), by('t4', 't', 6), by('m1', 'm', 5), by('s1', 's', 4)];
    expect(AUTHOR_RUN).toBe(2);
    expect(order(shelf.map(([c]) => c), { likes: Object.fromEntries(shelf.map(([c, n]) => [c.slug, n])) }))
      .toEqual(['t1', 't2', 'm1', 't3', 't4', 's1']);
  });

  it('lets a run go on when nobody else is left', () => {
    const shelf = [list('m1', { owner_id: 'm' }), list('t1', { owner_id: 't' }), list('t2', { owner_id: 't' }), list('t3', { owner_id: 't' })];
    expect(order(shelf, { likes: { t1: 9, t2: 8, t3: 7, m1: 1 } })).toEqual(['t1', 't2', 'm1', 't3']);
    expect(order(shelf.slice(1), { likes: { t1: 9, t2: 8, t3: 7 } })).toEqual(['t1', 't2', 't3']);
  });

  it('does not treat the desk as an author', () => {
    const shelf = [list('d1', { owner_id: null }), list('d2', { owner_id: null }), list('d3', { owner_id: null }), list('m1', { owner_id: 'm' })];
    expect(order(shelf, { likes: { d1: 9, d2: 8, d3: 7, m1: 1 } })).toEqual(['d1', 'd2', 'd3', 'm1']);
  });

  it('returns an empty shelf unchanged', () => {
    expect(order([])).toEqual([]);
  });
});

describe('listFacts', () => {
  const cafe = { slug: 'cafe', rating: 4.8, rating_count: 90 };
  const bar = { slug: 'bar', rating: 4.2, rating_count: 12 };
  const none = { desc_en: null, desc_vi: null, desc_ja: null };

  it('hands the places over as they are', () => {
    expect(listFacts(none, [cafe, bar], null).places).toEqual([cafe, bar]);
  });

  it('is described by a description in any one language, and not by blank space', () => {
    expect(listFacts(none, [], null).described).toBe(false);
    expect(listFacts({}, [], null).described).toBe(false);
    expect(listFacts({ ...none, desc_vi: '   ' }, [], null).described).toBe(false);
    expect(listFacts({ ...none, desc_en: 'Quiet rooms.' }, [], null).described).toBe(true);
    expect(listFacts({ ...none, desc_vi: 'Quán yên.' }, [], null).described).toBe(true);
    expect(listFacts({ ...none, desc_ja: '静かな店。' }, [], null).described).toBe(true);
  });

  it('is the mean of what the reader leans towards its places', () => {
    const taste = { affinity: (p: { slug: string }) => (p.slug === 'cafe' ? 0.6 : 0.2) };
    expect(listFacts(none, [cafe, bar], taste).taste).toBeCloseTo(0.4, 10);
  });

  it('takes a place the reader passed over as no lean, not a lean against the list', () => {
    const taste = { affinity: (p: { slug: string }) => (p.slug === 'cafe' ? 0.6 : -0.7) };
    expect(listFacts(none, [cafe, bar], taste).taste).toBeCloseTo(0.3, 10);
  });

  it('has no taste to report for a reader without one, or a list without places', () => {
    expect(listFacts(none, [cafe], null).taste).toBe(0);
    expect(listFacts(none, [], { affinity: () => 1 }).taste).toBe(0);
  });
});

describe('meanRating', () => {
  it('is the mean of the places that have a rating', () => {
    expect(meanRating([{ rating: 4 }, { rating: 5 }, { rating: null }, {}], 1)).toBe(4.5);
  });

  it('is the fallback while there is nothing rated', () => {
    expect(meanRating([], 4.6)).toBe(4.6);
    expect(meanRating([{ rating: null }], 4.6)).toBe(4.6);
  });
});

describe('listUseBySlug', () => {
  it('keys the three figures by slug and drops the rest of the row', () => {
    expect(listUseBySlug([{ slug: 'a', uses: 2, views: 30, liked: 4 }, { slug: 'b', uses: 0, views: 1, liked: 0 }]))
      .toEqual({ a: { uses: 2, views: 30, liked: 4 }, b: { uses: 0, views: 1, liked: 0 } });
    expect(listUseBySlug([])).toEqual({});
  });
});
