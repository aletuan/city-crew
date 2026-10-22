// The catalog's reads, pressed against the fake Supabase client.
//
// What is worth pinning here is not "did it call Supabase". It is what the
// query asked for: which gate a signed-out reader is held to, which
// disjunction lets a signed-in one see their own pending suggestion, and
// which column each of the two fallbacks drops when the database is older
// than the build asking it.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ fake: null as ReturnType<typeof import('../testing').fakeSupabase> | null }));
vi.mock('../supabase', async () => {
  const { fakeSupabase } = await import('../testing');
  h.fake = fakeSupabase();
  return { supabase: h.fake.client };
});

import {
  fetchCategoryTerms, fetchPlaceBySlug, fetchPlaceCountByCity, fetchPlaceIndex, fetchPlaces, fetchPlacesByGoogleId, fetchSearchIndex, fetchSearchPlaces,
  PLACE_COLS, SEARCH_INDEX_COLS,
} from './places';
import { PAGE_ROWS } from './pages';

const fake = () => h.fake!;
beforeEach(() => fake().reset());

const row = (slug: string, extra: Record<string, unknown> = {}) => ({
  slug, city_id: 'hanoi', is_published: true, review_status: 'approved',
  submitted_by: null, place_photos: [], ...extra,
});

describe('PLACE_COLS', () => {
  it('names city_id, which is selected rather than only filtered on', () => {
    // A place inside a multi-city collection has to be able to say where it
    // is; a row that only ever matched a `where` clause cannot. See
    // `touchesCity`.
    expect(PLACE_COLS(true)).toContain('city_id');
  });

  it('carries categories only when asked', () => {
    expect(PLACE_COLS(true)).toContain(', categories');
    expect(PLACE_COLS(false)).not.toContain(', categories');
  });

  it('embeds the photos rather than leaving a card to fetch its own', () => {
    expect(PLACE_COLS(true)).toContain('place_photos(');
  });
});

describe('fetchPlaces', () => {
  it('holds a signed-out reader to the published catalog', async () => {
    fake().replies({ data: [row('pho-10')] });
    const out = await fetchPlaces('hanoi');
    expect(out.map((p) => p.slug)).toEqual(['pho-10']);

    const [q] = fake().log;
    expect(q.table).toBe('places');
    expect(q.filters).toEqual([
      ['city_id', 'hanoi'], ['is_published', true], ['review_status', 'approved'],
    ]);
    // Two `eq`s, not a disjunction: signed out there is no "or mine" to add.
    expect(q.or).toBeUndefined();
  });

  it('asks for live-or-mine as one clause when there is a reader', async () => {
    fake().replies({ data: [] });
    await fetchPlaces('hanoi', 'u1');

    const [q] = fake().log;
    // One `or`, not chained `eq`s: chaining would ask for both halves at
    // once, which no row can satisfy.
    expect(q.or).toBe('and(is_published.eq.true,review_status.eq.approved),submitted_by.eq.u1');
    expect(q.filters).toEqual([['city_id', 'hanoi']]);
  });

  it('sorts by sort_order with the unranked last, slug as the tiebreak', async () => {
    fake().replies({ data: [] });
    await fetchPlaces('hanoi');
    // Both, in this order. The tiebreak is what makes the order *total*:
    // with every production sort_order NULL, the primary sort alone let
    // Postgres answer in a different order per run — and the Explore
    // hero, picked by "first match", flipped covers between the cached
    // render and the fresh one on any city with no pinned hero.
    expect(fake().log[0].orders).toEqual([
      ['sort_order', { ascending: true, nullsFirst: false }],
      ['slug', { ascending: true }],
    ]);
  });

  it('puts the reader’s own pending suggestion above the catalog', async () => {
    fake().replies({
      data: [row('live-one'), row('mine', { review_status: 'pending', submitted_by: 'u1' })],
    });
    const out = await fetchPlaces('hanoi', 'u1');
    expect(out.map((p) => p.slug)).toEqual(['mine', 'live-one']);
  });

  it('retries without the categories column on a database that lacks it', async () => {
    fake().replies(
      { error: { message: 'column places.categories does not exist' } },
      { data: [row('pho-10')] },
    );
    const out = await fetchPlaces('hanoi', 'u1');
    expect(out.map((p) => p.slug)).toEqual(['pho-10']);

    const [first, second] = fake().log;
    expect(String(first.payload)).toContain(', categories');
    expect(String(second.payload)).not.toContain(', categories');
    // Still the reader's own query: only the column list narrowed.
    expect(second.or).toContain('submitted_by.eq.u1');
  });

  it('falls back to the plain catalog on one that lacks submitted_by', async () => {
    fake().replies(
      { error: { message: 'column places.submitted_by does not exist' } },
      { data: [row('pho-10')] },
    );
    const out = await fetchPlaces('hanoi', 'u1');
    expect(out.map((p) => p.slug)).toEqual(['pho-10']);

    const [, second] = fake().log;
    expect(String(second.payload)).not.toContain('submitted_by');
    expect(String(second.payload)).not.toContain('is_published,');
    // There are no submissions to miss on a database that cannot hold one,
    // so the disjunction goes with the column.
    expect(second.or).toBeUndefined();
    expect(second.filters).toEqual([
      ['city_id', 'hanoi'], ['is_published', true], ['review_status', 'approved'],
    ]);
  });

  it('throws when the failure is not one of the two it knows how to retry', async () => {
    fake().replies({ error: { message: 'permission denied' } });
    await expect(fetchPlaces('hanoi')).rejects.toThrow('permission denied');
    expect(fake().log).toHaveLength(1);
  });

  it('answers empty rather than null when the table has nothing', async () => {
    fake().replies({ data: null });
    expect(await fetchPlaces('hanoi')).toEqual([]);
  });
});

describe('fetchPlaceBySlug', () => {
  it('asks the forgiving question, because a miss is the expected answer', async () => {
    fake().replies({ data: row('pho-10') });
    const out = await fetchPlaceBySlug('pho-10');
    expect(out?.slug).toBe('pho-10');

    const [q] = fake().log;
    expect(q.filters).toEqual([['slug', 'pho-10']]);
    // `maybeSingle`, not `single`: this runs precisely when the catalog
    // missed, so no row is a result and not an error.
    expect(q.maybe).toBe(true);
    expect(q.single).toBeUndefined();
  });

  it('is not scoped to a city — that is the whole reason it exists', async () => {
    fake().replies({ data: null });
    await fetchPlaceBySlug('banh-mi-huynh-hoa');
    expect(fake().log[0].filters.map(([k]) => k)).not.toContain('city_id');
  });

  it('answers null for a slug nothing holds', async () => {
    fake().replies({ data: null });
    expect(await fetchPlaceBySlug('nope')).toBeNull();
  });

  it('throws when the lookup itself failed', async () => {
    fake().replies({ error: { message: 'timeout' } });
    await expect(fetchPlaceBySlug('pho-10')).rejects.toThrow('timeout');
  });
});

describe('fetchCategoryTerms', () => {
  it('keys the desk’s synonyms by category', async () => {
    fake().replies({
      data: [
        { category: 'eats', terms: ['pho', 'bun cha'] },
        { category: 'cafes', terms: ['ca phe'] },
      ],
    });
    expect(await fetchCategoryTerms()).toEqual({
      eats: ['pho', 'bun cha'], cafes: ['ca phe'],
    });
    expect(fake().log[0].table).toBe('category_terms');
  });

  it('reads a row with no terms as a category with none', async () => {
    fake().replies({ data: [{ category: 'views', terms: null }] });
    expect(await fetchCategoryTerms()).toEqual({ views: [] });
  });

  it('skips a row with no category rather than keying on the empty string', async () => {
    fake().replies({ data: [{ category: '', terms: ['x'] }] });
    expect(await fetchCategoryTerms()).toEqual({});
  });

  // The app ships its own defaults and unions this onto them, so an
  // unreachable table leaves search exactly as it shipped — through the
  // hook's empty map, not through an answer this read never had.
  it('throws when the table is unreachable', async () => {
    fake().replies({ error: { message: 'relation does not exist' } });
    await expect(fetchCategoryTerms()).rejects.toThrow('relation does not exist');
  });

  it('answers an empty map when there is no data at all', async () => {
    fake().replies({ data: null });
    expect(await fetchCategoryTerms()).toEqual({});
  });
});

describe('fetchPlaceIndex', () => {
  // The map counts every city under the filters in force, which needs the
  // columns those filters read — and only those. See `cityCounts`.
  it('asks for the columns the filters read, from the live catalog', async () => {
    fake().replies({ data: [{ slug: 'a', city_id: 'hanoi', categories: ['cafes'], vibe_tags: [], category: null, opening_hours: null }] });
    await fetchPlaceIndex();

    const [q] = fake().log;
    expect(q.table).toBe('places');
    expect(q.filters).toEqual([['is_published', true], ['review_status', 'approved']]);
    for (const col of ['slug', 'city_id', 'categories', 'vibe_tags', 'category', 'opening_hours']) {
      expect(q.payload).toContain(col);
    }
    // And nothing else: this is a whole-country read, so every column it
    // does not need is paid for 635 times.
    expect(String(q.payload).split(',')).toHaveLength(6);
  });

  // `categoriesOf` reads `category` as an optional string, the shape the
  // catalog's own rows have. A null would be a different question asked
  // of the same function, so the nulls are dropped rather than carried.
  it('drops a null legacy category rather than carrying it', async () => {
    fake().replies({ data: [
      { slug: 'a', city_id: 'hanoi', categories: [], vibe_tags: [], category: null, opening_hours: null },
      { slug: 'b', city_id: 'hanoi', categories: [], vibe_tags: [], category: 'food', opening_hours: null },
    ] });
    const rows = await fetchPlaceIndex();
    expect('category' in rows[0]).toBe(false);
    expect(rows[1].category).toBe('food');
  });

  // The catalog passed PostgREST's thousand-row cap unnoticed (22 Oct
  // 2026), and the map counted the first thousand places only. Every page,
  // in slug order, until one comes back short.
  it('reads every page, in slug order, until one comes back short', async () => {
    const page = (n: number, at: number) => Array.from({ length: n }, (_, i) => ({
      slug: `p${at + i}`, city_id: 'melbourne', categories: [], vibe_tags: [], category: null, opening_hours: null,
    }));
    fake().replies({ data: page(PAGE_ROWS, 0) }, { data: page(109, PAGE_ROWS) });
    const rows = await fetchPlaceIndex();
    expect(rows).toHaveLength(PAGE_ROWS + 109);
    expect(fake().log.map((q) => q.range)).toEqual([[0, PAGE_ROWS - 1], [PAGE_ROWS, 2 * PAGE_ROWS - 1]]);
    for (const q of fake().log) expect(q.order).toEqual(['slug', { ascending: true }]);
  });

  // The page is the server's cap, not a choice. A larger one is answered
  // with a thousand rows all the same, reads as a short last page, and
  // stops: the very truncation this paging exists to end.
  it('pages at the server’s own cap of a thousand rows', () => {
    expect(PAGE_ROWS).toBe(1000);
  });

  // A full last page leaves one more to ask, which answers nothing.
  it('asks once more after a full page, and stops at the empty one', async () => {
    const full = Array.from({ length: PAGE_ROWS }, (_, i) => ({
      slug: `p${i}`, city_id: 'hanoi', categories: [], vibe_tags: [], category: null, opening_hours: null,
    }));
    fake().replies({ data: full }, { data: [] });
    expect(await fetchPlaceIndex()).toHaveLength(PAGE_ROWS);
    expect(fake().log).toHaveLength(2);
  });

  it('throws when a later page fails, rather than answering part of the country', async () => {
    const full = Array.from({ length: PAGE_ROWS }, (_, i) => ({
      slug: `p${i}`, city_id: 'hanoi', categories: [], vibe_tags: [], category: null, opening_hours: null,
    }));
    fake().replies({ data: full }, { error: { message: 'offline' } });
    await expect(fetchPlaceIndex()).rejects.toThrow('offline');
  });

  // Explore catches, and the markers keep their names and lose their
  // numbers — the map this replaced. The read itself says what happened.
  it('throws an error, and answers missing data with an empty list', async () => {
    fake().replies({ error: { message: 'offline' } });
    await expect(fetchPlaceIndex()).rejects.toThrow('offline');
    fake().replies({ data: null });
    expect(await fetchPlaceIndex()).toEqual([]);
  });
});

describe('fetchPlaceCountByCity', () => {
  // The switcher's promise per row. Only the live catalog counts — a
  // pending suggestion is nobody's promise yet.
  it('counts the live catalog, per city', async () => {
    fake().replies({ data: [
      { city_id: 'hanoi' }, { city_id: 'hanoi' }, { city_id: 'hue' },
    ] });
    expect(await fetchPlaceCountByCity()).toEqual({ hanoi: 2, hue: 1 });

    const [q] = fake().log;
    expect(q.table).toBe('places');
    expect(q.filters).toEqual([['is_published', true], ['review_status', 'approved']]);
  });

  // Past the server's cap of a thousand rows (22 Oct 2026), every page.
  it('counts every page, not the first thousand', async () => {
    const full = Array.from({ length: PAGE_ROWS }, () => ({ city_id: 'hanoi' }));
    fake().replies({ data: full }, { data: [{ city_id: 'melbourne' }] });
    expect(await fetchPlaceCountByCity()).toEqual({ hanoi: PAGE_ROWS, melbourne: 1 });
    expect(fake().log.map((q) => q.range)).toEqual([[0, PAGE_ROWS - 1], [PAGE_ROWS, 2 * PAGE_ROWS - 1]]);
    expect(fake().log[0].order).toEqual(['slug', { ascending: true }]);
  });

  it('skips a row that cannot say where it is', async () => {
    fake().replies({ data: [{ city_id: 'hanoi' }, { city_id: null }] });
    expect(await fetchPlaceCountByCity()).toEqual({ hanoi: 1 });
  });

  // The switcher catches, and its rows keep their quiet — the sheet the
  // app always had. The read itself throws.
  it('throws when the read failed', async () => {
    fake().replies({ error: { message: 'offline' } });
    await expect(fetchPlaceCountByCity()).rejects.toThrow('offline');
  });

  it('answers missing data the same way', async () => {
    fake().replies({ data: null });
    expect(await fetchPlaceCountByCity()).toEqual({});
  });
});

// The lookup behind the "already here" marks on Google's results. One
// query over every id, and the reply handed back as it came: a refusal
// there means "every row looks new", which is `suggest.ts`'s reading.
describe('fetchPlacesByGoogleId', () => {
  it('asks once, by Google id, for the columns the marks are made of', async () => {
    fake().replies({ data: [{ google_place_id: 'p1', slug: 'a' }] });
    expect(await fetchPlacesByGoogleId(['p1', 'p2'])).toEqual({ data: [{ google_place_id: 'p1', slug: 'a' }] });
    expect(fake().log).toHaveLength(1);
    const q = fake().log[0];
    expect(q).toMatchObject({ table: 'places', op: 'select' });
    expect(q.filters).toEqual([['google_place_id', ['p1', 'p2']]]);
    for (const col of ['google_place_id', 'slug', 'is_published', 'review_status', 'submitted_by']) {
      expect(String(q.payload)).toContain(col);
    }
  });

  it('hands a refusal back rather than throwing it', async () => {
    fake().replies({ error: { message: 'denied' } });
    expect(await fetchPlacesByGoogleId(['p1'])).toEqual({ error: { message: 'denied' } });
  });
});

// Search's index of every city (22 Oct 2026): what a match reads and what
// a result's card draws, and nothing a place's own page needs.
describe('fetchSearchPlaces', () => {
  // The few just suggested, by slug, as the index has its rows: not the
  // whole index again.
  it('reads the places named, with the index’s columns and the cover only', async () => {
    fake().replies({ data: [row('a'), row('b')] });
    const rows = await fetchSearchPlaces(['a', 'b']);
    const [q] = fake().log;
    expect(q.table).toBe('places');
    expect(q.payload).toBe(SEARCH_INDEX_COLS);
    expect(q.filters).toEqual(expect.arrayContaining([['slug', ['a', 'b']], ['place_photos.is_cover', true]]));
    expect(rows.map((r) => r.slug)).toEqual(['a', 'b']);
  });

  it('asks nothing for no places', async () => {
    expect(await fetchSearchPlaces([])).toEqual([]);
    expect(fake().log).toHaveLength(0);
  });

  it('reads an empty answer as none, and throws what the database said', async () => {
    fake().replies({ data: null });
    expect(await fetchSearchPlaces(['a'])).toEqual([]);
    fake().replies({ error: { message: 'boom' } });
    await expect(fetchSearchPlaces(['a'])).rejects.toThrow('boom');
  });
});

describe('fetchSearchIndex', () => {
  it('asks for the words a match reads and the card the result is drawn as, and the cover only', async () => {
    fake().replies({ data: [row('a')] });
    await fetchSearchIndex();
    const [q] = fake().log;
    expect(q.table).toBe('places');
    for (const col of ['name_en', 'name_vi', 'i18n', 'neighborhood_en', 'desc_en', 'desc_vi', 'address', 'vibe_tags', 'categories', 'opening_hours', 'rating', 'city_id']) {
      expect(q.payload).toContain(col);
    }
    // The page's own fields stay with the page.
    for (const col of ['lat', 'website', 'phone', 'reviewer_url', 'sort_order']) {
      expect(String(q.payload).split(/[ ,()]+/)).not.toContain(col);
    }
    expect(q.filters).toContainEqual(['place_photos.is_cover', true]);
    expect(q.order).toEqual(['slug', { ascending: true }]);
    expect(q.range).toEqual([0, PAGE_ROWS - 1]);
  });

  it('is the live catalog for a reader signed out', async () => {
    fake().replies({ data: [] });
    await fetchSearchIndex(null);
    const [q] = fake().log;
    expect(q.filters).toEqual(expect.arrayContaining([['is_published', true], ['review_status', 'approved']]));
    expect(q.or).toBeUndefined();
  });

  // As the catalog is: a suggestion is its maker's from the moment it is
  // made, and first in their list.
  it('adds the reader’s own suggestions, first', async () => {
    fake().replies({ data: [row('a'), row('mine', { is_published: false, review_status: 'pending', submitted_by: 'me' })] });
    const rows = await fetchSearchIndex('me');
    expect(fake().log[0].or).toBe('and(is_published.eq.true,review_status.eq.approved),submitted_by.eq.me');
    expect(rows.map((r) => r.slug)).toEqual(['mine', 'a']);
  });

  it('reads every page', async () => {
    const full = Array.from({ length: PAGE_ROWS }, (_, i) => row(`p${i}`));
    fake().replies({ data: full }, { data: [row('last')] });
    expect(await fetchSearchIndex()).toHaveLength(PAGE_ROWS + 1);
    expect(fake().log[1].range).toEqual([PAGE_ROWS, 2 * PAGE_ROWS - 1]);
  });

  it('throws what the database said', async () => {
    fake().replies({ error: { message: 'offline' } });
    await expect(fetchSearchIndex()).rejects.toThrow('offline');
  });
});
