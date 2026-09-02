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
  fetchCategoryTerms, fetchPlaceBySlug, fetchPlaceCountByCity, fetchPlaces, PLACE_COLS,
} from './places';

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

  // Failure is an empty map, never a throw: the app ships its own defaults
  // and unions this onto them, so an unreachable table leaves search exactly
  // as it shipped. That is what lets the desk edit it without risk.
  it('answers an empty map when the table is unreachable', async () => {
    fake().replies({ error: { message: 'relation does not exist' } });
    expect(await fetchCategoryTerms()).toEqual({});
  });

  it('answers an empty map when there is no data at all', async () => {
    fake().replies({ data: null });
    expect(await fetchCategoryTerms()).toEqual({});
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

  it('skips a row that cannot say where it is', async () => {
    fake().replies({ data: [{ city_id: 'hanoi' }, { city_id: null }] });
    expect(await fetchPlaceCountByCity()).toEqual({ hanoi: 1 });
  });

  // Failure is an empty map, never a throw: the sheet's rows simply keep
  // their quiet, which is the sheet the app always had.
  it('answers an error with an empty map', async () => {
    fake().replies({ error: { message: 'offline' } });
    expect(await fetchPlaceCountByCity()).toEqual({});
  });

  it('answers missing data the same way', async () => {
    fake().replies({ data: null });
    expect(await fetchPlaceCountByCity()).toEqual({});
  });
});
