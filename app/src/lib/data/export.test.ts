// The two reads nothing else in the app performs, and one it replaces.
//
// What is worth asserting here is the scope. All three filter on the
// owner explicitly even though RLS already does, and the day somebody
// "simplifies" one of those filters away this is the test that notices —
// an export that quietly widened would hand somebody else's rows to a
// reader, which is the one failure mode this feature cannot have.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ fake: null as ReturnType<typeof import('../testing').fakeSupabase> | null }));
vi.mock('../supabase', async () => {
  const { fakeSupabase } = await import('../testing');
  h.fake = fakeSupabase();
  return { supabase: h.fake.client };
});
const fake = () => h.fake!;

import { fetchMyHistory, fetchMyLikedCollections, fetchMyShares, fetchMySubmittedPlaces } from './export';
import { PAGE_ROWS } from './pages';

beforeEach(() => fake().reset());

describe('fetchMySubmittedPlaces', () => {
  it('asks for this account\'s places, oldest first', async () => {
    fake().replies({ data: [{ slug: 'aa', name_en: 'A', name_vi: 'A', created_at: '2026-01-01T00:00:00Z' }] });
    const rows = await fetchMySubmittedPlaces('u-1');

    expect(fake().log[0]).toMatchObject({
      table: 'places', op: 'select', filters: [['submitted_by', 'u-1']],
      order: ['created_at', { ascending: true }],
    });
    expect(rows).toHaveLength(1);
  });

  // Not city-scoped, which is the difference from `fetchPlaces` and the
  // reason this exists: an export owes every place, not the ones in
  // whichever city the app happens to be showing.
  it('names no city', async () => {
    await fetchMySubmittedPlaces('u-1');
    expect(fake().log[0].filters.map(([k]) => k)).not.toContain('city_id');
  });

  it('answers with an empty list rather than null', async () => {
    fake().replies({ data: null });
    expect(await fetchMySubmittedPlaces('u-1')).toEqual([]);
  });

  it('throws what the server said', async () => {
    fake().replies({ error: { message: 'boom' } });
    await expect(fetchMySubmittedPlaces('u-1')).rejects.toThrow('boom');
  });
});

describe('fetchMyLikedCollections', () => {
  it('brings the slug and the curator, not just the id', async () => {
    fake().replies({ data: [{ created_at: '2026-02-02T00:00:00Z', collections: { slug: 'x', curator_handle: 'ha' } }] });
    const rows = await fetchMyLikedCollections('u-1');

    expect(fake().log[0]).toMatchObject({
      table: 'collection_likes', op: 'select', filters: [['user_id', 'u-1']],
    });
    // The whole reason this is not `fetchMyLikes`: a file of UUIDs is
    // machine-readable and tells its reader nothing.
    expect(fake().log[0].payload).toContain('collections(slug, curator_handle)');
    expect(rows[0].collections?.slug).toBe('x');
  });

  it('answers with an empty list rather than null', async () => {
    fake().replies({ data: null });
    expect(await fetchMyLikedCollections('u-1')).toEqual([]);
  });

  it('throws what the server said', async () => {
    fake().replies({ error: { message: 'nope' } });
    await expect(fetchMyLikedCollections('u-1')).rejects.toThrow('nope');
  });
});

describe('fetchMyShares', () => {
  it('asks for the shares on this account’s lists, and the shares naming it, each scoped in the query', async () => {
    fake().replies(
      { data: [{ created_at: '2026-11-12T00:00:00Z', user_id: 'friend', collections: { slug: 'mine', owner_id: 'u-1' } }] },
      { data: [{ created_at: '2026-11-12T01:00:00Z', user_id: 'u-1', collections: { slug: 'theirs', owner_id: 'friend' } }] },
    );
    const { mine, withMe } = await fetchMyShares('u-1');

    expect(fake().log[0]).toMatchObject({
      table: 'collection_shares', op: 'select', filters: [['collections.owner_id', 'u-1']],
      order: ['created_at', { ascending: true }],
    });
    // Inner, so a share on somebody else's list is not returned at all.
    expect(fake().log[0].payload).toContain('collections!inner(slug, owner_id)');
    expect(fake().log[1]).toMatchObject({
      table: 'collection_shares', op: 'select', filters: [['user_id', 'u-1']],
      order: ['created_at', { ascending: true }],
    });
    expect(mine[0].collections?.slug).toBe('mine');
    expect(withMe[0].collections?.slug).toBe('theirs');
  });

  it('answers with empty lists rather than null', async () => {
    fake().replies({ data: null }, { data: null });
    expect(await fetchMyShares('u-1')).toEqual({ mine: [], withMe: [] });
  });

  it('throws what the server said, on either read', async () => {
    fake().replies({ error: { message: 'mine refused' } }, { data: [] });
    await expect(fetchMyShares('u-1')).rejects.toThrow('mine refused');
    fake().reset();
    fake().replies({ data: [] }, { error: { message: 'theirs refused' } });
    await expect(fetchMyShares('u-1')).rejects.toThrow('theirs refused');
  });
});

describe('fetchMyHistory', () => {
  // The point of it. `fetchPassedOver` reads the same table through a
  // 90-day window and collapses it to a verdict, which is right for
  // ranking and wrong for answering "what do you hold about me".
  it('takes every row, with no window and no verdict', async () => {
    fake().replies({ data: [{ kind: 'open', city_id: 'hanoi', created_at: '2026-03-03T00:00:00Z', places: { slug: 'p' } }] });
    const rows = await fetchMyHistory('u-1');

    expect(fake().log[0]).toMatchObject({
      table: 'place_events', op: 'select', filters: [['user_id', 'u-1']],
    });
    expect(fake().log[0].filters.map(([k]) => k)).not.toContain('created_at>=');
    expect(rows[0].kind).toBe('open');
  });

  // A reader with 1,991 events (22 Oct 2026) was exported a thousand of
  // them: the server's cap on one answer. Every page, in a total order.
  it('reads every page, oldest first, ties broken by id', async () => {
    const full = Array.from({ length: PAGE_ROWS }, (_, i) => ({ kind: 'open', city_id: 'hanoi', created_at: `t${i}`, places: { slug: `p${i}` } }));
    fake().replies({ data: full }, { data: [{ kind: 'save', city_id: 'hanoi', created_at: 'later', places: { slug: 'last' } }] });
    const rows = await fetchMyHistory('u-1');
    expect(rows).toHaveLength(PAGE_ROWS + 1);
    expect(rows.at(-1)!.kind).toBe('save');
    expect(fake().log.map((q) => q.range)).toEqual([[0, PAGE_ROWS - 1], [PAGE_ROWS, 2 * PAGE_ROWS - 1]]);
    expect(fake().log[0].orders).toEqual([['created_at', { ascending: true }], ['id', { ascending: true }]]);
  });

  it('answers with an empty list rather than null', async () => {
    fake().replies({ data: null });
    expect(await fetchMyHistory('u-1')).toEqual([]);
  });

  it('throws what the server said', async () => {
    fake().replies({ error: { message: 'down' } });
    await expect(fetchMyHistory('u-1')).rejects.toThrow('down');
  });
});
