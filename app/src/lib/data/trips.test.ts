// The writes and reads in `lib/data/trips.ts`, pressed against the fake
// Supabase client rather than a database.
//
// Split out of the single `data.test.ts` when `data.ts` became a directory,
// and kept beside the module it exercises. What is worth pinning here is
// not "did it call Supabase" — it is the shape of what was sent: which
// columns a value goes into, which error code means "fine, carry on", and
// which column must *not* be in the payload.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ fake: null as ReturnType<typeof import('../testing').fakeSupabase> | null }));
vi.mock('../supabase', async () => {
  const { fakeSupabase } = await import('../testing');
  h.fake = fakeSupabase();
  return { supabase: h.fake.client };
});

import { deleteTrip, fetchMyTrips, saveTrip } from './trips';

const fake = () => h.fake!;
beforeEach(() => fake().reset());

describe('saveTrip', () => {
  const input = {
    ownerId: 'u-1', cityId: 'hanoi', title: 'Two coffees before noon',
    company: 'couple', categories: ['cafes'], district: null,
    day: '2026-08-21', when: 'day' as const, stops: [],
  };

  // A trip stores the answers it was built from, because that is what
  // lets it be rebuilt into the plan that was saved rather than into a
  // different one. `district` was stored from the start; the coordinate
  // was not, even though `at_lat` and `at_lng` have been on the table
  // since it was created — it was being dropped in navigation long before
  // it reached here, so nothing noticed the columns were never written.
  it('stores where the day started', async () => {
    fake().replies({ data: { id: 't-1' } });
    await saveTrip({ ...input, atLat: 21.0325, atLng: 105.8135 });
    expect(fake().log[0]).toMatchObject({ table: 'trips', op: 'insert' });
    expect(fake().log[0].payload).toMatchObject({ at_lat: 21.0325, at_lng: 105.8135 });
  });

  // Null and not absent: the column is nullable and "no pin" is a fact
  // about the trip, not a field that failed to arrive.
  it('says so plainly when there was no pin', async () => {
    fake().replies({ data: { id: 't-1' } });
    await saveTrip(input);
    expect(fake().log[0].payload).toMatchObject({ at_lat: null, at_lng: null });
  });

  it('refuses the trip when its own insert failed', async () => {
    fake().replies({ error: { message: 'permission denied' } });
    await expect(saveTrip(input)).rejects.toThrow('permission denied');
    expect(fake().log).toHaveLength(1);
  });

  it('stops at the trip when there is nothing to put in it', async () => {
    fake().replies({ data: { id: 't-1' } });
    expect(await saveTrip(input)).toBe('t-1');
    // One round trip, not two: an empty stop list has no ids to look up.
    expect(fake().log).toHaveLength(1);
  });

  const withStops = {
    ...input,
    stops: [
      { placeSlug: 'cong-caphe', arriveMin: 540, dwellMin: 60, why: 'the balcony', whyLang: 'en' },
      { placeSlug: 'gone', arriveMin: 660, dwellMin: 45 },
    ],
  };

  it('resolves slugs to ids and numbers the stops by their order', async () => {
    fake().replies(
      { data: { id: 't-1' } },
      { data: [{ id: 'p-1', slug: 'cong-caphe' }, { id: 'p-2', slug: 'gone' }] },
      { error: null },
    );
    expect(await saveTrip(withStops)).toBe('t-1');

    const [, lookup, insert] = fake().log;
    expect(lookup).toMatchObject({ table: 'places' });
    expect(lookup.filters).toEqual([['slug', ['cong-caphe', 'gone']]]);
    expect(insert).toMatchObject({ table: 'trip_stops', op: 'insert' });
    expect(insert.payload).toEqual([
      {
        trip_id: 't-1', place_id: 'p-1', sort_order: 0,
        arrive_min: 540, dwell_min: 60, why: 'the balcony', why_lang: 'en',
      },
      {
        trip_id: 't-1', place_id: 'p-2', sort_order: 1,
        arrive_min: 660, dwell_min: 45, why: null, why_lang: null,
      },
    ]);
  });

  // A place the catalog no longer holds is dropped rather than failing the
  // save: the reader is looking at a plan they can see, and refusing it over
  // a row that has gone quiet since would be the wrong half to protect.
  it('drops a stop whose place the catalog has stopped holding', async () => {
    fake().replies(
      { data: { id: 't-1' } },
      { data: [{ id: 'p-1', slug: 'cong-caphe' }] },
      { error: null },
    );
    await saveTrip(withStops);

    const stops = fake().log[2].payload as { place_id: string }[];
    expect(stops).toHaveLength(1);
    expect(stops[0].place_id).toBe('p-1');
  });

  // No transaction is available here, so the rollback is by hand. A
  // half-saved trip in the list is worse than a failed save the reader can
  // retry, and RLS makes the cleanup safe — the delete can only reach a row
  // this user owns.
  it('deletes the trip it just made when the id lookup fails', async () => {
    fake().replies(
      { data: { id: 't-1' } },
      { error: { message: 'lookup exploded' } },
    );
    await expect(saveTrip(withStops)).rejects.toThrow('lookup exploded');

    const rollback = fake().log[2];
    expect(rollback).toMatchObject({ table: 'trips', op: 'delete' });
    expect(rollback.filters).toEqual([['id', 't-1']]);
  });

  it('deletes it again when the stops themselves are refused', async () => {
    fake().replies(
      { data: { id: 't-1' } },
      { data: [{ id: 'p-1', slug: 'cong-caphe' }] },
      { error: { message: 'stops refused' } },
    );
    await expect(saveTrip(withStops)).rejects.toThrow('stops refused');

    const rollback = fake().log[3];
    expect(rollback).toMatchObject({ table: 'trips', op: 'delete' });
    expect(rollback.filters).toEqual([['id', 't-1']]);
  });
});

describe('fetchMyTrips', () => {
  it('reads this owner’s trips, newest day first', async () => {
    fake().replies({ data: [{ id: 't-1', trip_stops: [] }] });
    const out = await fetchMyTrips('u-1');
    expect(out.map((t) => t.id)).toEqual(['t-1']);

    const [q] = fake().log;
    expect(q.table).toBe('trips');
    expect(q.filters).toEqual([['owner_id', 'u-1']]);
    expect(q.order).toEqual(['day', { ascending: false }]);
  });

  // Not scoped to a city, for the reason a user's own collections are not:
  // a Saturday planned in Hanoi is still theirs while the app is looking at
  // Saigon, and hiding it would read as having lost it.
  it('is not scoped to a city', async () => {
    fake().replies({ data: [] });
    await fetchMyTrips('u-1');
    expect(fake().log[0].filters.map(([k]) => k)).not.toContain('city_id');
  });

  // PostgREST cannot order an embedded table, so the stops arrive in
  // whatever order they come back in and are sorted here. Without this a
  // saved plan renders its afternoon before its morning.
  it('sorts the stops by sort_order, which the query could not ask for', async () => {
    fake().replies({
      data: [{
        id: 't-1',
        trip_stops: [{ sort_order: 2 }, { sort_order: 0 }, { sort_order: 1 }],
      }],
    });
    const [trip] = await fetchMyTrips('u-1');
    expect(trip.trip_stops.map((s) => s.sort_order)).toEqual([0, 1, 2]);
  });

  it('reads a trip with no stops at all as an empty list', async () => {
    fake().replies({ data: [{ id: 't-1', trip_stops: null }] });
    const [trip] = await fetchMyTrips('u-1');
    expect(trip.trip_stops).toEqual([]);
  });

  it('answers empty rather than null when there are no trips', async () => {
    fake().replies({ data: null });
    expect(await fetchMyTrips('u-1')).toEqual([]);
  });

  it('throws when the read failed', async () => {
    fake().replies({ error: { message: 'timeout' } });
    await expect(fetchMyTrips('u-1')).rejects.toThrow('timeout');
  });
});

describe('deleteTrip', () => {
  it('deletes by id and lets the cascade take the stops', async () => {
    fake().replies({ error: null });
    await deleteTrip('t-1');

    const [q] = fake().log;
    expect(q).toMatchObject({ table: 'trips', op: 'delete' });
    expect(q.filters).toEqual([['id', 't-1']]);
    // No `trip_stops` delete: the foreign key cascades, and a hand-written
    // second delete would be a second thing to get wrong.
    expect(fake().log).toHaveLength(1);
  });

  it('throws when the delete was refused', async () => {
    fake().replies({ error: { message: 'not yours' } });
    await expect(deleteTrip('t-1')).rejects.toThrow('not yours');
  });
});
