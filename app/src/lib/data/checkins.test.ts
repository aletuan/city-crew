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
import { addCheckin, fetchMyCheckins, fetchPersonCheckins, likeCheckin, removeCheckin, saveCheckin } from './checkins';

const fake = () => h.fake!;
beforeEach(() => fake().reset());

describe('fetchMyCheckins', () => {
  it('reads the owner’s rows newest first, with the place’s slug flattened in', async () => {
    fake().replies({ data: [
      {
        id: 'k2', city_id: 'hanoi', at: '2026-10-08T03:00:00+07:00', note: 'Crisp sourdough.', audience: 'friends',
        // In position order, whatever order the embed came in; the
        // hidden one left out.
        checkin_photos: [
          { id: 'p2', path: 'u1/k2/p2.jpg', width: 900, height: 1200, position: 2, hidden_at: null },
          { id: 'p3', path: 'u1/k2/p3.jpg', width: 900, height: 1200, position: 3, hidden_at: '2026-11-25T00:00:00Z' },
          { id: 'p1', path: 'u1/k2/p1.jpg', width: 1200, height: 900, position: 1, hidden_at: null },
        ],
        places: {
          slug: 'cong', name_en: 'Cong', name_vi: 'Cộng', i18n: null, categories: ['cafes', 'eats'],
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
        places: { slug: 'bare', name_en: 'Bare', name_vi: 'Bare', i18n: { ja: { name: 'ベア' } }, place_photos: [] },
      },
    ] });
    const rows = await fetchMyCheckins('u1');
    const [call] = fake().log;
    expect(call.table).toBe('checkins');
    expect(call.payload).toBe('id, city_id, at, note, audience, checkin_photos(id, path, width, height, position, hidden_at), places(slug, name_en, name_vi, i18n, categories, place_photos(photo_uri, is_cover, is_hidden, sort_order))');
    expect(call.filters).toEqual([['user_id', 'u1']]);
    expect(call.order).toEqual(['at', { ascending: false }]);
    expect(rows).toEqual([
      { id: 'k2', place_slug: 'cong', city_id: 'hanoi', at: '2026-10-08T03:00:00+07:00', note: 'Crisp sourdough.', audience: 'friends', photos: [{ id: 'p1', path: 'u1/k2/p1.jpg', width: 1200, height: 900 }, { id: 'p2', path: 'u1/k2/p2.jpg', width: 900, height: 1200 }], place: { name_en: 'Cong', name_vi: 'Cộng', i18n: null, cover: 'https://x/cover.jpg', categories: ['cafes', 'eats'] } },
      // A row whose place is gone has no slug to show; it still counts.
      // No note and no answer on it: nulls, never holes.
      { id: 'k1', place_slug: '', city_id: null, at: '2026-10-01T03:00:00Z', note: null, audience: null, photos: [], place: null },
      // No categories on the row: an empty list, never a hole.
      { id: 'k0', place_slug: 'bare', city_id: 'hanoi', at: '2026-09-01T03:00:00Z', note: null, audience: null, photos: [], place: { name_en: 'Bare', name_vi: 'Bare', i18n: { ja: { name: 'ベア' } }, cover: null, categories: [] } },
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
    fake().replies({ data: { id: 'place-uuid' } }, { data: { id: 'k9' }, error: null });
    // The new row's id comes back, for the sheet that writes its note.
    expect(await addCheckin({ ownerId: 'u1', placeSlug: 'cong', cityId: 'hanoi' })).toBe('k9');
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
  // Offline is not "the place is gone": the lookup's own failure is what
  // the reader is told, and nothing is inserted.
  it('says the lookup failed, not that the place is missing, when it did', async () => {
    fake().replies({ error: { message: 'Failed to fetch' } });
    await expect(addCheckin({ ownerId: 'u1', placeSlug: 'cong', cityId: null })).rejects.toThrow('Failed to fetch');
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

describe('saveCheckin', () => {
  it('writes the note and who sees it to the one row, and nothing else', async () => {
    fake().replies({ data: null, error: null });
    await saveCheckin('k1', { note: 'Crisp sourdough.', audience: 'friends' });
    const [call] = fake().log;
    expect([call.table, call.op]).toEqual(['checkins', 'update']);
    expect(call.payload).toEqual({ note: 'Crisp sourdough.', audience: 'friends' });
    expect(call.filters).toEqual([['id', 'k1']]);
  });
  it('leaves who sees it alone when that was not asked', async () => {
    fake().replies({ data: null, error: null });
    await saveCheckin('k1', { note: null });
    expect(fake().log[0].payload).toEqual({ note: null });
  });
  it('says so when the write fails', async () => {
    fake().replies({ data: null, error: { message: 'connection lost' } });
    await expect(saveCheckin('k1', { note: null, audience: 'private' })).rejects.toThrow('connection lost');
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
        slug: 'p', name_en: 'P', name_vi: 'P', i18n: null,
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
        slug: 'p', name_en: 'P', name_vi: 'P', i18n: null,
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
    fake().replies({ data: [{ id: 'k', city_id: null, at: '2026-10-01T03:00:00Z', places: { slug: 'p', name_en: 'P', name_vi: 'P', i18n: null } }] });
    const [row] = await fetchMyCheckins('u1');
    expect(row.place?.cover).toBeNull();
  });
});

describe('fetchPersonCheckins', () => {
  it('asks the function for this person, and reads a row as the page holds it', async () => {
    fake().replies({ data: [{
      id: 'k1', place_slug: 'cong', name_en: 'Cong', name_vi: 'Cộng', i18n: { ja: { name: 'コン' } }, categories: ['cafes'],
      cover: 'https://x/cover.jpg', city_id: 'hanoi', day: '2026-11-24', note: 'Crisp sourdough.', audience: 'friends', likes: 2, liked: true,
      photos: [{ id: 'p1', path: 'u2/k1/p1.jpg', width: 1200, height: 900 }],
    }] });
    expect(await fetchPersonCheckins('u1')).toEqual([{
      id: 'k1', place_slug: 'cong',
      place: { name_en: 'Cong', name_vi: 'Cộng', cover: 'https://x/cover.jpg', i18n: { ja: { name: 'コン' } }, categories: ['cafes'] },
      city_id: 'hanoi', day: '2026-11-24', note: 'Crisp sourdough.', audience: 'friends', likes: 2, liked: true,
      photos: [{ id: 'p1', path: 'u2/k1/p1.jpg', width: 1200, height: 900 }],
    }]);
    expect(fake().log).toEqual([{ op: 'rpc', fn: 'person_checkins', payload: { p_person: 'u1' }, filters: [] }]);
  });

  it('reads what the server left empty as empty: no note, no picture, no answer, no hearts', async () => {
    fake().replies({ data: [{
      id: 'k1', place_slug: 'cong', name_en: null, name_vi: null, i18n: null, categories: null,
      cover: null, city_id: null, day: '2026-11-24', note: null, audience: null, likes: null, liked: null,
    }] });
    expect(await fetchPersonCheckins('u1')).toEqual([{
      id: 'k1', place_slug: 'cong', place: { name_en: '', name_vi: '', cover: null, i18n: null, categories: [] },
      city_id: null, day: '2026-11-24', note: null, audience: null, likes: 0, liked: false, photos: [],
    }]);
  });

  it('takes only the three answers there are, and a heart only on the word true', async () => {
    fake().replies({ data: [
      { id: 'a', place_slug: 'p', day: '2026-11-24', audience: 'private', liked: 'yes', likes: '3' },
      { id: 'b', place_slug: 'p', day: '2026-11-24', audience: 'everyone' },
      { id: 'c', place_slug: 'p', day: '2026-11-24', audience: 'public' },
      { id: 'd', place_slug: 'p', day: '2026-11-24', audience: 'friends' },
    ] });
    const [a, b, c, d] = await fetchPersonCheckins('u1');
    expect([a.audience, a.liked, a.likes]).toEqual(['private', false, 0]);
    expect(b.audience).toBeNull();
    expect(c.audience).toBe('public');
    expect(d.audience).toBe('friends');
  });

  it('is nobody’s page when the server answers nothing, and throws what it said', async () => {
    fake().replies({ data: null });
    expect(await fetchPersonCheckins('u1')).toEqual([]);
    fake().reset();
    fake().replies({ error: { message: 'down' } });
    await expect(fetchPersonCheckins('u1')).rejects.toThrow('down');
  });
});

describe('likeCheckin', () => {
  it('asks the function to set the reader’s heart, or to take it back', async () => {
    await likeCheckin('k1', true);
    await likeCheckin('k1', false);
    expect(fake().log).toEqual([
      { op: 'rpc', fn: 'like_checkin', payload: { p_id: 'k1', p_on: true }, filters: [] },
      { op: 'rpc', fn: 'like_checkin', payload: { p_id: 'k1', p_on: false }, filters: [] },
    ]);
  });
  it('throws what the server said', async () => {
    fake().replies({ error: { message: 'checkin:unseen' } });
    await expect(likeCheckin('k1', true)).rejects.toThrow('checkin:unseen');
  });
});
