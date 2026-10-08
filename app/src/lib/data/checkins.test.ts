// The reads and writes in `lib/data/checkins.ts`, against the fake client:
// which columns go, which refusal means the cap, and what a row becomes.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ fake: null as ReturnType<typeof import('../testing').fakeSupabase> | null }));
vi.mock('../supabase', async () => {
  const { fakeSupabase } = await import('../testing');
  h.fake = fakeSupabase();
  return { supabase: h.fake.client };
});

import { DAILY_LIMIT } from '../quota';
import { addCheckin, fetchMyCheckins, removeCheckin } from './checkins';

const fake = () => h.fake!;
beforeEach(() => fake().reset());

describe('fetchMyCheckins', () => {
  it('reads the owner’s rows newest first, with the place’s slug flattened in', async () => {
    fake().replies({ data: [
      {
        id: 'k2', city_id: 'hanoi', at: '2026-10-08T03:00:00+07:00',
        places: {
          slug: 'cong', name_en: 'Cong', name_vi: 'Cộng', name_ja: null,
          // The cover wins over sort order; a hidden one never shows.
          place_photos: [
            { photo_uri: 'https://x/second.jpg', is_cover: false, is_hidden: false, sort_order: 1 },
            { photo_uri: 'https://x/hidden-cover.jpg', is_cover: true, is_hidden: true, sort_order: 0 },
            { photo_uri: 'https://x/cover.jpg', is_cover: true, is_hidden: false, sort_order: 5 },
          ],
        },
      },
      { id: 'k1', city_id: null, at: '2026-10-01T03:00:00Z', places: null },
      {
        id: 'k0', city_id: 'hanoi', at: '2026-09-01T03:00:00Z',
        places: { slug: 'bare', name_en: 'Bare', name_vi: 'Bare', name_ja: 'ベア', place_photos: [] },
      },
    ] });
    const rows = await fetchMyCheckins('u1');
    const [call] = fake().log;
    expect(call.table).toBe('checkins');
    expect(call.payload).toBe('id, city_id, at, places(slug, name_en, name_vi, name_ja, place_photos(photo_uri, is_cover, is_hidden, sort_order))');
    expect(call.filters).toEqual([['user_id', 'u1']]);
    expect(call.order).toEqual(['at', { ascending: false }]);
    expect(rows).toEqual([
      { id: 'k2', place_slug: 'cong', city_id: 'hanoi', at: '2026-10-08T03:00:00+07:00', place: { name_en: 'Cong', name_vi: 'Cộng', name_ja: null, cover: 'https://x/cover.jpg' } },
      // A row whose place is gone has no slug to show; it still counts.
      { id: 'k1', place_slug: '', city_id: null, at: '2026-10-01T03:00:00Z', place: null },
      { id: 'k0', place_slug: 'bare', city_id: 'hanoi', at: '2026-09-01T03:00:00Z', place: { name_en: 'Bare', name_vi: 'Bare', name_ja: 'ベア', cover: null } },
    ]);
  });
  it('throws the database’s words when the read fails', async () => {
    fake().replies({ data: null, error: { message: 'offline' } });
    await expect(fetchMyCheckins('u1')).rejects.toThrow('offline');
  });
  it('reads an account with no visits as an empty list, not a crash', async () => {
    fake().replies({ data: null, error: null });
    expect(await fetchMyCheckins('u1')).toEqual([]);
  });
});

describe('addCheckin', () => {
  it('finds the place by slug and writes one row for the owner, no id of its own', async () => {
    fake().replies({ data: { id: 'place-uuid' } }, { data: null, error: null });
    await addCheckin({ ownerId: 'u1', placeSlug: 'cong', cityId: 'hanoi' });
    const [lookup, insert] = fake().log;
    expect(lookup.table).toBe('places');
    expect(insert.table).toBe('checkins');
    expect(insert.op).toBe('insert');
    expect(insert.payload).toEqual({ user_id: 'u1', place_id: 'place-uuid', city_id: 'hanoi' });
  });
  it('names a place that is not there rather than inserting nothing quietly', async () => {
    fake().replies({ data: null });
    await expect(addCheckin({ ownerId: 'u1', placeSlug: 'gone', cityId: null })).rejects.toThrow('place_not_found');
    expect(fake().log).toHaveLength(1);
  });
  it('turns a policy refusal into the daily-limit name, and keeps other failures as they are', async () => {
    fake().replies({ data: { id: 'p' } }, { data: null, error: { code: '42501', message: 'new row violates row-level security policy' } });
    await expect(addCheckin({ ownerId: 'u1', placeSlug: 'cong', cityId: null })).rejects.toThrow(DAILY_LIMIT);
    fake().reset();
    fake().replies({ data: { id: 'p' } }, { data: null, error: { code: '08006', message: 'connection lost' } });
    await expect(addCheckin({ ownerId: 'u1', placeSlug: 'cong', cityId: null })).rejects.toThrow('connection lost');
  });
});

describe('removeCheckin', () => {
  it('deletes by id and nothing else', async () => {
    fake().replies({ data: null, error: null });
    await removeCheckin('k1');
    const [call] = fake().log;
    expect(call.table).toBe('checkins');
    expect(call.op).toBe('delete');
    expect(call.filters).toEqual([['id', 'k1']]);
  });
  it('throws the database’s words when it fails', async () => {
    fake().replies({ data: null, error: { message: 'offline' } });
    await expect(removeCheckin('k1')).rejects.toThrow('offline');
  });
});

describe('the cover, when no photo is flagged', () => {
  it('falls back to the first by sort order, skipping hidden ones', async () => {
    fake().replies({ data: [{
      id: 'k', city_id: null, at: '2026-10-01T03:00:00Z',
      places: {
        slug: 'p', name_en: 'P', name_vi: 'P', name_ja: null,
        place_photos: [
          { photo_uri: 'https://x/third.jpg', is_cover: false, is_hidden: false, sort_order: 3 },
          { photo_uri: 'https://x/hidden-first.jpg', is_cover: false, is_hidden: true, sort_order: 0 },
          { photo_uri: 'https://x/second.jpg', is_cover: false, is_hidden: false, sort_order: 2 },
        ],
      },
    }] });
    const [row] = await fetchMyCheckins('u1');
    expect(row.place?.cover).toBe('https://x/second.jpg');
  });
  it('settles two flagged covers by sort order', async () => {
    fake().replies({ data: [{
      id: 'k', city_id: null, at: '2026-10-01T03:00:00Z',
      places: {
        slug: 'p', name_en: 'P', name_vi: 'P', name_ja: null,
        place_photos: [
          { photo_uri: 'https://x/later-cover.jpg', is_cover: true, is_hidden: false, sort_order: 4 },
          { photo_uri: 'https://x/earlier-cover.jpg', is_cover: true, is_hidden: false, sort_order: 1 },
        ],
      },
    }] });
    const [row] = await fetchMyCheckins('u1');
    expect(row.place?.cover).toBe('https://x/earlier-cover.jpg');
  });
  it('reads a row the cache kept before photos rode along as having none', async () => {
    fake().replies({ data: [{ id: 'k', city_id: null, at: '2026-10-01T03:00:00Z', places: { slug: 'p', name_en: 'P', name_vi: 'P', name_ja: null } }] });
    const [row] = await fetchMyCheckins('u1');
    expect(row.place?.cover).toBeNull();
  });
});
