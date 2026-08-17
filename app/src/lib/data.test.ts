// The writes in `data.ts` — the six functions a reader's tap actually
// changes the database with.
//
// Not the hooks above them: those are React, and testing them needs a
// renderer this repository does not have. That boundary is the honest one,
// and it is why `data.ts` stays on the coverage gate's exclude list while
// this file exists — see the note in `vitest.config.ts`.
//
// What is worth pinning here is not "did it call Supabase". It is the
// shape of what was sent. Every one of these has a rule that is invisible
// at the call site and expensive to get wrong: which columns a title goes
// into, which error code means "fine, carry on", and — for
// `setCollectionPublic` — which column must *not* be in the payload.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ fake: null as ReturnType<typeof import('./testing').fakeSupabase> | null }));
vi.mock('./supabase', async () => {
  const { fakeSupabase } = await import('./testing');
  h.fake = fakeSupabase();
  return { supabase: h.fake.client };
});
// `data.ts` imports the city context for its hooks. It reaches for
// AsyncStorage and expo-location at import time, neither of which exists in
// a Node process, and none of the writes below touch it.
vi.mock('./city', () => ({ useCity: () => ({ city: null }) }));

import {
  addPlaceToCollection, createCollection, deleteCollection,
  removePlaceFromCollection, setCollectionPublic, updateCollection,
} from './data';

const fake = () => h.fake!;
beforeEach(() => fake().reset());

const dup = { message: 'duplicate key value violates unique constraint', code: '23505' };

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
    });
    expect(call.filters).toEqual([['slug', 'quan-ca-phe-cu']]);
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
