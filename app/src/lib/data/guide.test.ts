// The local guide's reads and writes, as questions put to Postgres.
//
// Every rule behind these is a policy, so what is worth pinning is the
// shape of each call: which one carries a filter and which leaves the
// filter to RLS, what the insert is obliged to say about itself, and
// which of them fails loudly.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ fake: null as ReturnType<typeof import('../testing').fakeSupabase> | null }));
vi.mock('../supabase', async () => {
  const { fakeSupabase } = await import('../testing');
  h.fake = fakeSupabase();
  return { supabase: h.fake.client };
});

import {
  addPlacePhoto, fetchGuideCities, fetchMyPhotoCounts, fetchPlaceId, removePlacePhoto,
} from './guide';

const fake = () => h.fake!;
beforeEach(() => fake().reset());

describe('fetchGuideCities', () => {
  // No filter, because `guides read their own grant` is the filter. A
  // `where user_id = me` here would be a second, weaker copy of it.
  it('takes no filter, because RLS is the filter', async () => {
    fake().replies({ data: [{ city_id: 'hanoi' }] });
    expect(await fetchGuideCities()).toEqual(['hanoi']);
    expect(fake().log[0]).toMatchObject({ table: 'local_guides', op: 'select', filters: [] });
  });

  // The row shape every grant had before the column existed, and the one
  // the migration left them in. It has to keep meaning "anywhere", which
  // downstream is a null in the list rather than a city.
  it('keeps an all-cities grant as a null rather than dropping it', async () => {
    fake().replies({ data: [{ city_id: null }] });
    expect(await fetchGuideCities()).toEqual([null]);
  });

  // Two narrow grants and a wide one can sit together: the reading is
  // the union, so the list is returned whole and judged by the store.
  it('returns every grant, not the first', async () => {
    fake().replies({ data: [{ city_id: 'hanoi' }, { city_id: 'danang' }] });
    expect(await fetchGuideCities()).toEqual(['hanoi', 'danang']);
  });

  it('is empty for an account the desk has not granted', async () => {
    fake().replies({ data: [] });
    expect(await fetchGuideCities()).toEqual([]);
  });

  // A guest, a database that predates the table, and a network that went
  // away are three different facts. All three answer "nowhere", because
  // the safe answer is the one that draws no control.
  it('is empty when the read fails rather than throwing', async () => {
    fake().replies({ error: { message: 'relation does not exist' } });
    expect(await fetchGuideCities()).toEqual([]);
  });

  // No error and no rows either — what PostgREST gives for a `head`
  // request or a reply whose body never arrived. Still "nowhere".
  it('is empty when there is no error and no data', async () => {
    fake().replies({});
    expect(await fetchGuideCities()).toEqual([]);
  });
});

describe('fetchMyPhotoCounts', () => {
  // The one place in this file where a filter is not a duplicate of RLS:
  // `place_photos` has no policy scoping a read to the uploader, so
  // without this clause the count would include the desk's photographs
  // and refuse somebody at five pictures none of which were theirs.
  it('asks only for its own rows, because no policy does that for it', async () => {
    fake().replies({ data: [{ id: '1' }] }, { data: [{ id: '1' }, { id: '2' }] });
    const counts = await fetchMyPhotoCounts('p1', 'u1');
    expect(counts).toEqual({ mineHere: 1, mineToday: 2 });
    expect(fake().log[0].filters).toEqual([['uploaded_by', 'u1'], ['place_id', 'p1']]);
  });

  // The day is a rolling twenty-four hours, the window the policy counts.
  it('counts the day as the last twenty-four hours', async () => {
    fake().replies({ data: [] }, { data: [] });
    await fetchMyPhotoCounts('p1', 'u1');
    const [key, value] = fake().log[1].filters[1];
    expect(key).toBe('created_at>=');
    const ago = Date.now() - Date.parse(value as string);
    expect(ago).toBeGreaterThan(23 * 60 * 60 * 1000);
    expect(ago).toBeLessThan(25 * 60 * 60 * 1000);
  });

  // The policy is the limit; this is only the message in front of it. A
  // count that failed must not be the thing that stops an upload.
  it('answers zero rather than blocking when the count fails', async () => {
    fake().replies({ error: { message: 'down' } }, { error: { message: 'down' } });
    expect(await fetchMyPhotoCounts('p1', 'u1')).toEqual({ mineHere: 0, mineToday: 0 });
  });
});

describe('addPlacePhoto', () => {
  const row = {
    placeId: 'p1', uid: 'u1', publicUrl: 'http://x/a.jpg',
    storagePath: 'u1/cong-1.jpg', sortOrder: 7,
  };

  // Every column the insert policy checks is written out. A default that
  // drifted would be refused by Postgres rather than written wrongly, but
  // the refusal would be a mystery at this call site.
  it('says what the row is, in the words the policy checks', async () => {
    fake().replies({ data: { id: 'ph1' } });
    expect(await addPlacePhoto(row)).toBe('ph1');
    expect(fake().log[0]).toMatchObject({
      table: 'place_photos',
      op: 'insert',
      payload: {
        place_id: 'p1', uploaded_by: 'u1', photo_uri: 'http://x/a.jpg',
        storage_path: 'u1/cong-1.jpg', sort_order: 7,
        source: 'upload', is_cover: false, is_hidden: false,
      },
    });
  });

  // Loud, unlike the reads. A silent failure leaves a file in the bucket,
  // no row pointing at it, and the person believing it is on the place.
  it('throws when the policy refuses', async () => {
    fake().replies({ error: { message: 'new row violates row-level security policy' } });
    await expect(addPlacePhoto(row)).rejects.toThrow(/row-level security/);
  });
});

describe('removePlacePhoto', () => {
  // Nothing but an id: `uploaders remove their own photos` makes that
  // safe. A row that is not this account's is simply not deleted.
  it('deletes by id and leaves the rest to the policy', async () => {
    fake().replies({ data: null });
    await removePlacePhoto('ph1');
    expect(fake().log[0]).toMatchObject({
      table: 'place_photos', op: 'delete', filters: [['id', 'ph1']],
    });
  });

  it('throws when the delete fails', async () => {
    fake().replies({ error: { message: 'gone' } });
    await expect(removePlacePhoto('ph1')).rejects.toThrow('gone');
  });
});

describe('fetchPlaceId', () => {
  // A place travels this app by slug; the uuid is wanted at exactly one
  // moment, so it is fetched at that moment rather than carried on every
  // row of the catalog query.
  it('trades the slug for the row id', async () => {
    fake().replies({ data: { id: 'place-uuid' } });
    expect(await fetchPlaceId('cong-caphe')).toBe('place-uuid');
    expect(fake().log[0]).toMatchObject({
      table: 'places', op: 'select', filters: [['slug', 'cong-caphe']],
    });
  });

  // RLS scopes this read like every other: a slug the caller cannot see
  // answers nothing, and the insert that would have followed was never
  // going to be allowed anyway.
  it('is null for a slug this reader cannot see', async () => {
    fake().replies({ data: null });
    expect(await fetchPlaceId('secret')).toBeNull();
  });

  it('is null rather than throwing when the read fails', async () => {
    fake().replies({ error: { message: 'down' } });
    expect(await fetchPlaceId('cong-caphe')).toBeNull();
  });
});
