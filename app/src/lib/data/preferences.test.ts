// The writes and reads in `lib/data/preferences.ts`, pressed against the fake
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
  clearMyHistory, fetchPassedOver, fetchPreferences, logPlaceEvent, NO_PREFERENCES,
  savePreferences,
} from './preferences';

const fake = () => h.fake!;
beforeEach(() => fake().reset());

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

  it('answers empty when the history table returns nothing at all', async () => {
    fake().replies({ data: null });
    expect(await fetchPassedOver('u1', '2026-01-01')).toEqual([]);
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

describe('fetchPreferences', () => {
  it('reads the one row this person owns', async () => {
    fake().replies({ data: { categories: ['eats'], budget_vnd: 200000, history_on: true } });
    expect(await fetchPreferences('u1')).toEqual({
      categories: ['eats'], budget_vnd: 200000, history_on: true,
    });

    const [q] = fake().log;
    expect(q.table).toBe('preferences');
    expect(q.filters).toEqual([['owner_id', 'u1']]);
    // `maybeSingle`: a person who has never opened the settings sheet has no
    // row, and that is an answer rather than a fault.
    expect(q.maybe).toBe(true);
  });

  // A missing row and a row of defaults are the same thing to every reader:
  // nobody has an opinion until they say so. Answering null instead would
  // make "have they opted in" a three-way question everywhere it is asked.
  it('answers the empty preferences when there is no row', async () => {
    fake().replies({ data: null });
    expect(await fetchPreferences('u1')).toEqual(NO_PREFERENCES);
  });

  it('fills in the columns a partial row left out', async () => {
    fake().replies({ data: { budget_vnd: null } });
    expect(await fetchPreferences('u1')).toEqual({
      categories: [], budget_vnd: null, history_on: false,
    });
  });

  // `history_on` is the opt-in gate, so it is coerced rather than trusted:
  // a null out of the database must read as "not opted in", never as a
  // value that a `!== false` test somewhere would let through.
  it('reads a null opt-in as off', async () => {
    fake().replies({ data: { categories: ['eats'], budget_vnd: 1, history_on: null } });
    expect(await fetchPreferences('u1')).toMatchObject({ history_on: false });
  });

  it('throws when the read itself failed', async () => {
    fake().replies({ error: { message: 'timeout' } });
    await expect(fetchPreferences('u1')).rejects.toThrow('timeout');
  });
});
