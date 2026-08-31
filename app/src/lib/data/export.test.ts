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

import { fetchMyHistory, fetchMyLikedCollections, fetchMySubmittedPlaces } from './export';

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

  it('answers with an empty list rather than null', async () => {
    fake().replies({ data: null });
    expect(await fetchMyHistory('u-1')).toEqual([]);
  });

  it('throws what the server said', async () => {
    fake().replies({ error: { message: 'down' } });
    await expect(fetchMyHistory('u-1')).rejects.toThrow('down');
  });
});
