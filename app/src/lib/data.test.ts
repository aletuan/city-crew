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
  addPlaceToCollection, clearMyHistory, createCollection, deleteCollection,
  fetchPassedOver, logPlaceEvent, NO_PREFERENCES,
  removePlaceFromCollection, savePreferences, setCollectionPublic, updateCollection,
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

// ── preferences and history ──────────────────────────────────────────
//
// Two tables nothing else in this file touches, and the reason they are
// worth pinning here is the same as everything above: the rule is invisible
// at the call site. A missing preferences row is not an error, an event
// nobody opted into must not be written, and "opened and not saved" is a
// verdict over a sequence rather than a row you can look up.

describe('savePreferences', () => {
  it('upserts the one row this person is allowed to have', async () => {
    await savePreferences('u-1', { categories: ['cafes'], budget_vnd: 400_000, history_on: true });
    expect(fake().log[0]).toMatchObject({ table: 'preferences', op: 'insert', upsert: true });
    expect(fake().log[0].payload).toMatchObject({
      owner_id: 'u-1', categories: ['cafes'], budget_vnd: 400_000, history_on: true,
    });
  });

  // Unstated is not zero, and it has to survive the round trip as itself.
  it('writes an unstated budget as null, not as nothing', async () => {
    await savePreferences('u-1', { categories: [], budget_vnd: null, history_on: false });
    expect((fake().log[0].payload as { budget_vnd: unknown }).budget_vnd).toBeNull();
  });

  it('throws what the database said', async () => {
    fake().replies({ error: { message: 'not yours' } });
    await expect(savePreferences('u-1', NO_PREFERENCES)).rejects.toThrow('not yours');
  });
});

describe('logPlaceEvent', () => {
  it('records what happened, once it is allowed to', async () => {
    fake().replies({ data: { id: 'p-id' } });
    await logPlaceEvent('u-1', 'cong-caphe', 'open', 'hanoi', true);
    expect(fake().log[1]).toMatchObject({ table: 'place_events', op: 'insert' });
    expect(fake().log[1].payload).toMatchObject({
      user_id: 'u-1', place_id: 'p-id', kind: 'open', city_id: 'hanoi',
    });
  });

  // The opt-in, on the cheap side. The insert policy checks it too — that
  // is the guarantee — but a client that asks anyway spends a round trip to
  // be told no.
  it('asks nothing at all when recording is off', async () => {
    await logPlaceEvent('u-1', 'cong-caphe', 'open', 'hanoi', false);
    await logPlaceEvent(null, 'cong-caphe', 'open', 'hanoi', true);
    expect(fake().log).toHaveLength(0);
  });

  // Recording is a side effect of looking at a place. A screen where
  // opening a café can show an error is the thing this must never become.
  it('never throws when the request itself breaks', async () => {
    fake().replies({ throws: new TypeError('Network request failed') });
    await expect(logPlaceEvent('u-1', 'cong-caphe', 'open', null, true)).resolves.toBeUndefined();
  });

  it('writes nothing for a place the catalog no longer holds', async () => {
    fake().replies({ data: null });
    await expect(logPlaceEvent('u-1', 'gone', 'open', null, true)).resolves.toBeUndefined();
    // One query — the slug lookup — and no event, because an event about a
    // place that is not there is an event about nothing.
    expect(fake().log).toHaveLength(1);
    expect(fake().log[0]).toMatchObject({ table: 'places' });
  });
});

describe('fetchPassedOver', () => {
  const row = (slug: string, kind: string) => ({ kind, places: { slug } });

  // The verdict is over a sequence, newest first, and the newest verb wins:
  // somebody who opened a café, walked away, and saved it a week later has
  // not passed it over.
  it('lets a later save overrule an earlier walk-away', async () => {
    fake().replies({ data: [row('a', 'save'), row('a', 'open')] });
    expect(await fetchPassedOver('u-1', '2026-08-01')).toEqual([]);
  });

  it('counts a place opened and left alone', async () => {
    fake().replies({ data: [row('a', 'open'), row('b', 'save')] });
    expect(await fetchPassedOver('u-1', '2026-08-01')).toEqual(['a']);
  });

  it('counts a stop dropped out of a plan', async () => {
    fake().replies({ data: [row('a', 'plan_drop'), row('b', 'plan_keep')] });
    expect(await fetchPassedOver('u-1', '2026-08-01')).toEqual(['a']);
  });

  // Read over a window, because a café passed over last March says nothing
  // about this Saturday and nothing trims the table yet.
  it('asks only for the recent half', async () => {
    fake().replies({ data: [] });
    await fetchPassedOver('u-1', '2026-08-01');
    expect(fake().log[0].filters).toEqual([['user_id', 'u-1'], ['created_at>=', '2026-08-01']]);
  });

  it('ignores a row whose place has left the catalog', async () => {
    fake().replies({ data: [{ kind: 'open', places: null }] });
    expect(await fetchPassedOver('u-1', '2026-08-01')).toEqual([]);
  });

  it('throws what the database said', async () => {
    fake().replies({ error: { message: 'not yours' } });
    await expect(fetchPassedOver('u-1', '2026-08-01')).rejects.toThrow('not yours');
  });
});

describe('clearMyHistory', () => {
  it('deletes every row this person left behind', async () => {
    await clearMyHistory('u-1');
    expect(fake().log[0]).toMatchObject({
      table: 'place_events', op: 'delete', filters: [['user_id', 'u-1']],
    });
  });

  it('throws what the database said', async () => {
    fake().replies({ error: { message: 'nope' } });
    await expect(clearMyHistory('u-1')).rejects.toThrow('nope');
  });
});
