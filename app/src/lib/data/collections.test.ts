// The writes and reads in `lib/data/collections.ts`, pressed against the fake
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

import {
  addPlaceToCollection, copyCollection, createCollection, deleteCollection, fetchCollections,
  fetchLikeCounts, fetchMyCollections, fetchMyLikes, likeCollection, removePlaceFromCollection,
  reorderCollection, setCollectionPublic, unlikeCollection, updateCollection,
} from './collections';

const dup = { message: 'duplicate key value violates unique constraint', code: '23505' };

const fake = () => h.fake!;
beforeEach(() => fake().reset());

describe('createCollection', () => {
  const input = { ownerId: 'u1', cityId: 'hanoi', title: '  Quán cà phê cũ  ', desc: '  yên tĩnh ' };

  it('writes the title into all three languages, trimmed, and stays private', async () => {
    const slug = await createCollection(input);

    const [call] = fake().log;
    expect(call.table).toBe('collections');
    expect(call.op).toBe('insert');
    expect(call.payload).toEqual({
      slug,
      city_id: 'hanoi',
      owner_id: 'u1',
      // The user's own words, in every column. We have no translation of
      // them, and an empty title in Japanese would be worse than English.
      title_en: 'Quán cà phê cũ', title_vi: 'Quán cà phê cũ', title_ja: 'Quán cà phê cũ',
      desc_en: 'yên tĩnh', desc_vi: 'yên tĩnh', desc_ja: 'yên tĩnh',
      // RLS refuses an owned row created public. The app never asks.
      is_public: false,
    });
    expect(slug).toMatch(/^quan-ca-phe-cu-[a-z0-9]{1,6}$/);
  });

  it('stores a blank description as nothing rather than as an empty string', async () => {
    await createCollection({ ...input, desc: '   ' });
    expect(fake().log[0].payload).toMatchObject({ desc_en: null, desc_vi: null, desc_ja: null });
    fake().reset();
    await createCollection({ ownerId: 'u1', cityId: 'hanoi', title: 'x' });
    expect(fake().log[0].payload).toMatchObject({ desc_en: null });
  });

  // The suffix is random, so a collision is bad luck rather than a name
  // already taken. Retrying with the *same* slug would just collide again,
  // which is why the loop rebuilds it.
  it('retries a unique violation with a different slug', async () => {
    fake().replies({ error: dup }, { error: null });
    const slug = await createCollection(input);

    expect(fake().log).toHaveLength(2);
    const first = (fake().log[0].payload as { slug: string }).slug;
    expect(first).not.toBe(slug);
    expect(slug).toBe((fake().log[1].payload as { slug: string }).slug);
  });

  it('gives up after the second collision', async () => {
    fake().replies({ error: dup }, { error: dup });
    await expect(createCollection(input)).rejects.toThrow('duplicate key');
    expect(fake().log).toHaveLength(2);
  });

  // Anything that is not a collision will happen again on the retry, so
  // spending a second round trip on it only delays the message.
  it('does not retry any other failure', async () => {
    fake().replies({ error: { message: 'new row violates row-level security policy', code: '42501' } });
    await expect(createCollection(input)).rejects.toThrow('row-level security');
    expect(fake().log).toHaveLength(1);
  });
});

describe('updateCollection', () => {
  it('renames all three columns and scopes the write to one slug', async () => {
    await updateCollection('quan-ca-phe-cu', { title: ' Mới ', desc: '' });

    const [call] = fake().log;
    expect(call.op).toBe('update');
    expect(call.payload).toEqual({
      title_en: 'Mới', title_vi: 'Mới', title_ja: 'Mới',
      desc_en: null, desc_vi: null, desc_ja: null,
      // No pick sent: the cover clears to the fallback, not to whatever
      // happened to be there.
      cover_photo_id: null,
    });
    expect(call.filters).toEqual([['slug', 'quan-ca-phe-cu']]);
  });

  it('writes the chosen cover photograph when one is picked', async () => {
    await updateCollection('quan-ca-phe-cu', { title: 'Mới', coverPhotoId: 'ph-9' });

    const [call] = fake().log;
    expect(call.payload).toMatchObject({ cover_photo_id: 'ph-9' });
  });

  it('throws what the database said', async () => {
    fake().replies({ error: { message: 'no such collection' } });
    await expect(updateCollection('gone', { title: 'x' })).rejects.toThrow('no such collection');
  });
});

describe('setCollectionPublic', () => {
  // The one assertion in this file worth more than the rest of it. The
  // byline is stamped by a trigger from the owner's profile; a
  // `curator_handle` sent from a client is a client naming itself, which is
  // exactly what `20260815120000_publish_collections.sql` exists to stop.
  it('sends the boolean and nothing else', async () => {
    await setCollectionPublic('quan-ca-phe-cu', true);
    expect(fake().log[0].payload).toEqual({ is_public: true });
    expect(Object.keys(fake().log[0].payload as object)).toEqual(['is_public']);
  });

  it('takes a list back the same way', async () => {
    await setCollectionPublic('quan-ca-phe-cu', false);
    expect(fake().log[0].payload).toEqual({ is_public: false });
    expect(fake().log[0].filters).toEqual([['slug', 'quan-ca-phe-cu']]);
  });

  it('throws what the database said', async () => {
    fake().replies({ error: { message: 'not yours' } });
    await expect(setCollectionPublic('someone-elses', true)).rejects.toThrow('not yours');
  });
});

describe('deleteCollection', () => {
  it('deletes by slug and lets RLS decide whose it is', async () => {
    await deleteCollection('quan-ca-phe-cu');
    expect(fake().log[0]).toMatchObject({
      table: 'collections', op: 'delete', filters: [['slug', 'quan-ca-phe-cu']],
    });
  });

  it('throws what the database said', async () => {
    fake().replies({ error: { message: 'not yours' } });
    await expect(deleteCollection('someone-elses')).rejects.toThrow('not yours');
  });
});

describe('addPlaceToCollection', () => {
  // Both tables key on slug for the app and on id for the join table, so
  // the two lookups are unavoidable. They run together — one after the
  // other would double the wait on the commonest write in the app.
  const ids = () => fake().replies({ data: { id: 'c-id' } }, { data: { id: 'p-id' } });

  it('looks both ids up, then writes the join row', async () => {
    ids();
    await addPlaceToCollection('quan-ca-phe-cu', 'cong-caphe', 3);

    expect(fake().log.map((c) => c.table)).toEqual(['collections', 'places', 'collection_places']);
    expect(fake().log[0]).toMatchObject({ single: true, filters: [['slug', 'quan-ca-phe-cu']] });
    expect(fake().log[1]).toMatchObject({ single: true, filters: [['slug', 'cong-caphe']] });
    expect(fake().log[2].payload).toEqual({ collection_id: 'c-id', place_id: 'p-id', sort_order: 3 });
  });

  it('puts it first when the caller does not say where', async () => {
    ids();
    await addPlaceToCollection('quan-ca-phe-cu', 'cong-caphe');
    expect(fake().log[2].payload).toMatchObject({ sort_order: 0 });
  });

  // Already in the list is the state the caller wanted. Two taps racing
  // each other is not something to show an error for.
  it('is content when the place is already in the list', async () => {
    ids();
    fake().replies({ error: dup });
    await expect(addPlaceToCollection('quan-ca-phe-cu', 'cong-caphe')).resolves.toBeUndefined();
  });

  it('throws on any other refusal', async () => {
    ids();
    fake().replies({ error: { message: 'not your list', code: '42501' } });
    await expect(addPlaceToCollection('quan-ca-phe-cu', 'cong-caphe')).rejects.toThrow('not your list');
  });

  // A missing slug fails at the lookup, before anything is written. Each
  // side has to be reported on its own — "collection not found" and "place
  // not found" send the reader to different places.
  it('stops at a collection that does not exist', async () => {
    fake().replies({ error: { message: 'no rows' } }, { data: { id: 'p-id' } });
    await expect(addPlaceToCollection('gone', 'cong-caphe')).rejects.toThrow('no rows');
    expect(fake().log).toHaveLength(2);
  });

  it('stops at a place that does not exist', async () => {
    fake().replies({ data: { id: 'c-id' } }, { error: { message: 'no place' } });
    await expect(addPlaceToCollection('quan-ca-phe-cu', 'gone')).rejects.toThrow('no place');
    expect(fake().log).toHaveLength(2);
  });
});

describe('removePlaceFromCollection', () => {
  it('deletes the one join row, by both ids', async () => {
    fake().replies({ data: { id: 'c-id' } }, { data: { id: 'p-id' } });
    await removePlaceFromCollection('quan-ca-phe-cu', 'cong-caphe');

    expect(fake().log[2]).toMatchObject({
      table: 'collection_places',
      op: 'delete',
      filters: [['collection_id', 'c-id'], ['place_id', 'p-id']],
    });
  });

  // Unlike adding, there is no code to forgive here: a removal that failed
  // left the place in the list, and the screen has already taken it out.
  it('throws what the database said', async () => {
    fake().replies({ data: { id: 'c-id' } }, { data: { id: 'p-id' } }, { error: { message: 'not yours' } });
    await expect(removePlaceFromCollection('quan-ca-phe-cu', 'cong-caphe')).rejects.toThrow('not yours');
  });
});

// ── preferences and history ──────────────────────────────────────────
//
// Two tables nothing else in this file touches, and the reason they are
// worth pinning here is the same as everything above: the rule is invisible
// at the call site. A missing preferences row is not an error, an event
// nobody opted into must not be written, and "opened and not saved" is a
// verdict over a sequence rather than a row you can look up.

const embedded = (slug: string, cps: { sort_order: number; places: unknown }[]) => ({
  id: `c-${slug}`, slug, is_public: true, collection_places: cps,
});

describe('fetchCollections', () => {
  it('asks for public lists only, newest first with the desk’s order as tie-break', async () => {
    fake().replies({ data: [embedded('coffee', [])] });
    await fetchCollections('hanoi', null);

    const [q] = fake().log;
    expect(q.table).toBe('collections');
    expect(q.filters).toEqual([['is_public', true]]);
    // Time leads because a list published this morning is the reason to
    // open the tab. `sort_order` decides only the editorial rows, which all
    // share one timestamp and would otherwise come back in no order at all.
    expect(q.orders).toEqual([
      ['created_at', { ascending: false }],
      ['sort_order', { nullsFirst: false }],
    ]);
  });

  // Your own lists come back through fetchMyCollections. A list in both
  // sections reads as two lists: publishing should change who else can see
  // it, not make a second copy appear under your own name.
  it('excludes the reader’s own lists when there is a reader', async () => {
    fake().replies({ data: [] });
    await fetchCollections('hanoi', 'u1');
    expect(fake().log[0].or).toBe('owner_id.is.null,owner_id.neq.u1');
  });

  // Signed out there is nobody to exclude, and `owner_id.neq.null` is not
  // the same question as `is not null` in PostgREST's grammar — it would
  // quietly match nothing.
  it('writes no exclusion clause at all when signed out', async () => {
    fake().replies({ data: [] });
    await fetchCollections('hanoi', null);
    expect(fake().log[0].or).toBeUndefined();
  });

  it('is not filtered by city — a list appears in every city it reaches', async () => {
    fake().replies({ data: [] });
    await fetchCollections('hanoi', 'u1');
    expect(fake().log[0].filters.map(([k]) => k)).not.toContain('city_id');
  });

  it('falls back to the pre-ownership shape on a database that lacks owner_id', async () => {
    fake().replies(
      { error: { message: 'column collections.owner_id does not exist' } },
      { data: [{ slug: 'coffee' }] },
    );
    const out = await fetchCollections('hanoi', 'u1');
    expect(out.map((c) => c.slug)).toEqual(['coffee']);

    const [, legacy] = fake().log;
    // That migration brought `created_at` too, so the fallback can order by
    // neither — and it filters by city, because every row on a database that
    // old is editorial and stamped with one.
    expect(legacy.filters).toEqual([['is_public', true], ['city_id', 'hanoi']]);
    expect(legacy.order).toEqual(['sort_order']);
    expect(String(legacy.payload)).not.toContain('owner_id');
  });

  it('throws when even the fallback fails', async () => {
    fake().replies(
      { error: { message: 'column collections.owner_id does not exist' } },
      { error: { message: 'relation does not exist' } },
    );
    await expect(fetchCollections('hanoi', 'u1')).rejects.toThrow('relation does not exist');
  });

  it('answers empty rather than null on the fallback path', async () => {
    fake().replies(
      { error: { message: 'column collections.owner_id does not exist' } },
      { data: null },
    );
    expect(await fetchCollections('hanoi', 'u1')).toEqual([]);
  });

  it('throws on a failure it has no fallback for', async () => {
    fake().replies({ error: { message: 'permission denied' } });
    await expect(fetchCollections('hanoi', 'u1')).rejects.toThrow('permission denied');
    expect(fake().log).toHaveLength(1);
  });
});

// `withMembers` has no export of its own; it is what both read paths hand
// their rows through, and these are its rules.
describe('the members a read builds', () => {
  it('orders them by sort_order, which PostgREST cannot ask an embed for', async () => {
    fake().replies({
      data: [embedded('coffee', [
        { sort_order: 2, places: { slug: 'c' } },
        { sort_order: 0, places: { slug: 'a' } },
        { sort_order: 1, places: { slug: 'b' } },
      ])],
    });
    const [c] = await fetchCollections('hanoi', null);
    expect(c.members?.map((p) => p.slug)).toEqual(['a', 'b', 'c']);
  });

  // A row RLS declined to hand over arrives as a null embed. It is dropped
  // from `members` — a list of four with one unpublished shows three, not
  // three and a hole.
  it('drops a member the database refused to return', async () => {
    fake().replies({
      data: [embedded('coffee', [
        { sort_order: 0, places: { slug: 'a' } },
        { sort_order: 1, places: null },
      ])],
    });
    const [c] = await fetchCollections('hanoi', null);
    expect(c.members?.map((p) => p.slug)).toEqual(['a']);
    // But it stays in `collection_places`, as a null, so `holds()` and the
    // counts see the same list whichever query produced the row.
    expect(c.collection_places).toEqual([
      { sort_order: 0, places: { slug: 'a' } },
      { sort_order: 1, places: null },
    ]);
  });

  it('narrows collection_places to slugs whatever the embed carried', async () => {
    fake().replies({
      data: [embedded('coffee', [
        { sort_order: 0, places: { slug: 'a', name_en: 'A', lat: 1 } },
      ])],
    });
    const [c] = await fetchCollections('hanoi', null);
    expect(c.collection_places).toEqual([{ sort_order: 0, places: { slug: 'a' } }]);
  });

  it('reads no rows at all as no lists', async () => {
    // The `data ?? []` that `withMembers` opens with: a query that came back
    // with nothing has to leave the shelf empty rather than throwing on the
    // way to drawing it.
    fake().replies({ data: null });
    expect(await fetchCollections('hanoi', null)).toEqual([]);
  });

  it('reads a list with no members at all as an empty one', async () => {
    fake().replies({ data: [{ id: 'c-1', slug: 'empty', collection_places: null }] });
    const [c] = await fetchCollections('hanoi', null);
    expect(c.members).toEqual([]);
  });
});

describe('fetchMyCollections', () => {
  it('reads this owner’s lists, newest first', async () => {
    fake().replies({ data: [embedded('mine', [])] });
    expect(await fetchMyCollections('u1')).toHaveLength(1);

    const [q] = fake().log;
    expect(q.filters).toEqual([['owner_id', 'u1']]);
    expect(q.orders).toEqual([['created_at', { ascending: false }]]);
  });

  // Not filtered by city and not filtered by published: a list made in
  // Hanoi still shows while the app is looking at Saigon, and a draft is
  // still yours.
  it('filters by neither city nor is_public', async () => {
    fake().replies({ data: [] });
    await fetchMyCollections('u1');
    const cols = fake().log[0].filters.map(([k]) => k);
    expect(cols).not.toContain('city_id');
    expect(cols).not.toContain('is_public');
  });

  it('throws when the read failed', async () => {
    fake().replies({ error: { message: 'timeout' } });
    await expect(fetchMyCollections('u1')).rejects.toThrow('timeout');
  });
});

describe('fetchLikeCounts', () => {
  // Through a Postgres function rather than a select on the likes table,
  // and that is the privacy boundary rather than a convenience: anyone may
  // learn a list has forty likes, nobody may learn who the forty are.
  it('takes the totals from a function and the slugs from the table', async () => {
    fake().replies(
      { data: [{ collection_id: 'c-1', likes: 4 }, { collection_id: 'c-2', likes: 1 }] },
      { data: [{ id: 'c-1', slug: 'coffee' }, { id: 'c-2', slug: 'views' }] },
    );
    expect(await fetchLikeCounts()).toEqual({ coffee: 4, views: 1 });

    const [rpc, table] = fake().log;
    expect(rpc).toMatchObject({ op: 'rpc', fn: 'collection_like_counts' });
    expect(table).toMatchObject({ table: 'collections' });
    expect(table.filters).toEqual([['is_public', true]]);
  });

  it('drops a count whose collection it cannot name', async () => {
    fake().replies(
      { data: [{ collection_id: 'gone', likes: 9 }] },
      { data: [{ id: 'c-1', slug: 'coffee' }] },
    );
    expect(await fetchLikeCounts()).toEqual({});
  });

  // Failure is an empty map: every count then reads as zero, `rankByLikes`
  // falls back to the order the shelf had before likes existed, and no
  // heart shows a tally — the state the feature ships in anyway.
  it('answers an empty map when the function failed', async () => {
    fake().replies({ error: { message: 'no such function' } }, { data: [] });
    expect(await fetchLikeCounts()).toEqual({});
  });

  it('answers an empty map when the slug lookup failed', async () => {
    fake().replies({ data: [] }, { error: { message: 'timeout' } });
    expect(await fetchLikeCounts()).toEqual({});
  });

  it('answers an empty map when either side returned nothing', async () => {
    fake().replies({ data: null }, { data: [] });
    expect(await fetchLikeCounts()).toEqual({});
    fake().reset();
    fake().replies({ data: [] }, { data: null });
    expect(await fetchLikeCounts()).toEqual({});
  });
});

describe('fetchMyLikes', () => {
  it('reads the reader’s own rows, which is all RLS would return anyway', async () => {
    fake().replies({ data: [{ collection_id: 'c-1' }, { collection_id: 'c-2' }] });
    expect(await fetchMyLikes('u1')).toEqual(['c-1', 'c-2']);

    const [q] = fake().log;
    expect(q.table).toBe('collection_likes');
    expect(q.filters).toEqual([['user_id', 'u1']]);
  });

  it('answers empty when the read failed', async () => {
    fake().replies({ error: { message: 'timeout' } });
    expect(await fetchMyLikes('u1')).toEqual([]);
  });

  it('answers empty when there is no data', async () => {
    fake().replies({ data: null });
    expect(await fetchMyLikes('u1')).toEqual([]);
  });
});

describe('likeCollection', () => {
  it('reports that the state changed', async () => {
    fake().replies({ error: null });
    expect(await likeCollection('c-1', 'u1')).toBe(true);

    const [q] = fake().log;
    expect(q).toMatchObject({ table: 'collection_likes', op: 'insert' });
    expect(q.payload).toEqual({ collection_id: 'c-1', user_id: 'u1' });
  });

  // The insert can legitimately fail and the caller must not treat it as
  // breakage: the policy refuses a like on your own list and the primary key
  // refuses a second from the same person. Both are the rules working — what
  // the caller needs back is only whether to refetch.
  it('reports no change rather than throwing when the rules refused it', async () => {
    fake().replies({ error: { message: 'duplicate key value', code: '23505' } });
    expect(await likeCollection('c-1', 'u1')).toBe(false);
  });
});

describe('unlikeCollection', () => {
  it('deletes the reader’s own row, both ends named', async () => {
    fake().replies({ error: null });
    expect(await unlikeCollection('c-1', 'u1')).toBe(true);

    const [q] = fake().log;
    expect(q).toMatchObject({ table: 'collection_likes', op: 'delete' });
    expect(q.filters).toEqual([['collection_id', 'c-1'], ['user_id', 'u1']]);
  });

  it('reports no change rather than throwing when it was refused', async () => {
    fake().replies({ error: { message: 'not yours' } });
    expect(await unlikeCollection('c-1', 'u1')).toBe(false);
  });
});

describe('copyCollection', () => {
  const input = {
    ownerId: 'u1', cityId: 'hanoi', title: 'Borrowed', placeSlugs: ['a', 'b'],
  };

  it('makes the list, then fills it in the order it was given', async () => {
    fake().replies(
      { error: null },                                                 // createCollection
      { data: { id: 'c-1' } },                                         // the new list's id
      { data: [{ id: 'p-a', slug: 'a' }, { id: 'p-b', slug: 'b' }] },  // the places
      { error: null },                                                 // the members
    );
    expect(await copyCollection(input)).toMatch(/^borrowed-[a-z0-9]{6}$/);

    const insert = fake().log[3];
    expect(insert).toMatchObject({ table: 'collection_places', op: 'insert' });
    expect(insert.payload).toEqual([
      { collection_id: 'c-1', place_id: 'p-a', sort_order: 0 },
      { collection_id: 'c-1', place_id: 'p-b', sort_order: 1 },
    ]);
  });

  it('stops at the empty list when there is nothing to copy', async () => {
    fake().replies({ error: null });
    expect(await copyCollection({ ...input, placeSlugs: [] })).toMatch(/^borrowed-[a-z0-9]{6}$/);
    expect(fake().log).toHaveLength(1);
  });

  // A place the catalog has stopped holding is dropped rather than failing
  // the copy — the same choice `saveTrip` makes about its stops.
  it('drops a place the catalog no longer holds', async () => {
    fake().replies(
      { error: null },
      { data: { id: 'c-1' } },
      { data: [{ id: 'p-a', slug: 'a' }] },
      { error: null },
    );
    await copyCollection(input);
    expect(fake().log[3].payload).toEqual([
      { collection_id: 'c-1', place_id: 'p-a', sort_order: 0 },
    ]);
  });

  it('writes no members at all when none of them survived', async () => {
    fake().replies(
      { error: null },
      { data: { id: 'c-1' } },
      { data: [] },
    );
    expect(await copyCollection(input)).toMatch(/^borrowed-[a-z0-9]{6}$/);
    expect(fake().log).toHaveLength(3);
  });

  it('throws when the new list cannot be found again', async () => {
    fake().replies(
      { error: null },
      { error: { message: 'gone' } },
      { data: [] },
    );
    await expect(copyCollection(input)).rejects.toThrow('gone');
  });

  it('throws when the place lookup failed', async () => {
    fake().replies(
      { error: null },
      { data: { id: 'c-1' } },
      { error: { message: 'timeout' } },
    );
    await expect(copyCollection(input)).rejects.toThrow('timeout');
  });

  it('throws when the members were refused', async () => {
    fake().replies(
      { error: null },
      { data: { id: 'c-1' } },
      { data: [{ id: 'p-a', slug: 'a' }] },
      { error: { message: 'refused' } },
    );
    await expect(copyCollection(input)).rejects.toThrow('refused');
  });
});

describe('reorderCollection', () => {
  // A loop of updates rather than an upsert: the key is
  // (collection_id, place_id), so positions may collide mid-loop without
  // anything failing — which is exactly why the position is not in the key.
  it('writes each place its new position, one update per row', async () => {
    fake().replies(
      { data: { id: 'c-1' } },
      { data: [{ id: 'p-a', slug: 'a' }, { id: 'p-b', slug: 'b' }] },
      { error: null },
      { error: null },
    );
    await reorderCollection('coffee', ['b', 'a']);

    const [, , first, second] = fake().log;
    expect(first).toMatchObject({ table: 'collection_places', op: 'update' });
    expect(first.payload).toEqual({ sort_order: 0 });
    expect(first.filters).toEqual([['collection_id', 'c-1'], ['place_id', 'p-b']]);
    expect(second.payload).toEqual({ sort_order: 1 });
    expect(second.filters).toEqual([['collection_id', 'c-1'], ['place_id', 'p-a']]);
  });

  it('skips a slug the catalog cannot resolve', async () => {
    fake().replies(
      { data: { id: 'c-1' } },
      { data: [{ id: 'p-a', slug: 'a' }] },
      { error: null },
    );
    await reorderCollection('coffee', ['a', 'gone']);
    expect(fake().log).toHaveLength(3);
  });

  it('throws when the list cannot be found', async () => {
    fake().replies({ error: { message: 'no such list' } });
    await expect(reorderCollection('coffee', ['a'])).rejects.toThrow('no such list');
  });

  it('throws when the place lookup failed', async () => {
    fake().replies({ data: { id: 'c-1' } }, { error: { message: 'timeout' } });
    await expect(reorderCollection('coffee', ['a'])).rejects.toThrow('timeout');
  });

  it('throws on the first update the database refuses', async () => {
    fake().replies(
      { data: { id: 'c-1' } },
      { data: [{ id: 'p-a', slug: 'a' }, { id: 'p-b', slug: 'b' }] },
      { error: { message: 'not yours' } },
    );
    await expect(reorderCollection('coffee', ['a', 'b'])).rejects.toThrow('not yours');
    // Stopped rather than carried on: a half-applied order is worse than a
    // refused one the reader can retry.
    expect(fake().log).toHaveLength(3);
  });
});
