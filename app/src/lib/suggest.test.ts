import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ fake: null as ReturnType<typeof import('./testing').fakeSupabase> | null }));
vi.mock('./supabase', async () => {
  const { fakeSupabase } = await import('./testing');
  h.fake = fakeSupabase();
  return { supabase: h.fake.client };
});

import { knownByPlaceId, readOutcome, searchPlaces, suggestPlace } from './suggest';

const fake = () => h.fake!;
beforeEach(() => fake().reset());

/** An error as supabase-js hands one back for a non-2xx: a flat message,
 *  with the body the function actually sent hidden in `context`. */
const nonOk = (body: unknown) => ({
  message: 'Edge Function returned a non-2xx status code',
  context: { json: () => Promise.resolve(body) },
});

describe('readOutcome', () => {
  it('reads a slug back as a success', async () => {
    expect(await readOutcome({ data: { slug: 'cong-caphe', photos: 4 } }))
      .toEqual({ ok: true, slug: 'cong-caphe', photos: 4 });
  });

  it('counts no photos as none rather than as a failure', async () => {
    expect(await readOutcome({ data: { slug: 'cong-caphe' } }))
      .toEqual({ ok: true, slug: 'cong-caphe', photos: 0 });
  });

  // A 200 with nothing in it is the one case where the call worked and the
  // outcome is still unusable — there is no place to send the reader to.
  it('treats a success with no slug as an error', async () => {
    expect(await readOutcome({}))
      .toEqual({ ok: false, reason: 'error', message: 'no slug returned' });
  });

  // The whole reason `bodyOf` exists: without it every refusal below reads
  // as "Edge Function returned a non-2xx status code", and "this place is
  // already on City Crew" would look like a crash.
  it('names the daily limit rather than the status code', async () => {
    expect(await readOutcome({ error: nonOk({ error: 'daily_limit', limit: 5 }) }))
      .toEqual({ ok: false, reason: 'daily_limit', limit: 5 });
  });

  it('survives a limit the function did not send', async () => {
    expect(await readOutcome({ error: nonOk({ error: 'daily_limit' }) }))
      .toEqual({ ok: false, reason: 'daily_limit', limit: 0 });
  });

  // Live and visible: the reader can be shown the place they were trying to
  // add. That is a different screen from the one below, which is why the
  // two reasons are separate.
  it('offers the existing place when the duplicate is live', async () => {
    expect(await readOutcome({ error: nonOk({ error: 'already_known', live: true, slug: 'cong-caphe' }) }))
      .toEqual({ ok: false, reason: 'already_live', slug: 'cong-caphe' });
  });

  // Somebody else's unreviewed suggestion. The server knows; the reader
  // must not be told whose, or that there is a pending row at all beyond
  // "we have this one".
  it('says only that it is known when the duplicate is not live', async () => {
    expect(await readOutcome({ error: nonOk({ error: 'already_known' }) }))
      .toEqual({ ok: false, reason: 'already_known' });
    expect(await readOutcome({ error: nonOk({ error: 'already_known', live: true }) }))
      .toEqual({ ok: false, reason: 'already_known' });
    // The one that matters: a hidden row still has a slug, and offering it
    // would send the reader to a page RLS will not serve them — or, worse,
    // confirm that somebody else's unreviewed suggestion exists. Both
    // halves have to be true before the place is named.
    expect(await readOutcome({ error: nonOk({ error: 'already_known', live: false, slug: 'cong-caphe' }) }))
      .toEqual({ ok: false, reason: 'already_known' });
  });

  it('passes an unrecognised reason through as itself', async () => {
    expect(await readOutcome({ error: nonOk({ error: 'city_closed' }) }))
      .toEqual({ ok: false, reason: 'error', message: 'city_closed' });
  });

  it('falls back to the flat message when there is no body to read', async () => {
    expect(await readOutcome({ error: { message: 'Failed to fetch' } }))
      .toEqual({ ok: false, reason: 'error', message: 'Failed to fetch' });
  });

  // Both shapes have been seen from supabase-js, and the second only
  // appears once the first has failed — a body already consumed elsewhere
  // throws on `json()`.
  it('reads the body off `context.body` when `json()` will not give it up', async () => {
    const error = {
      message: 'non-2xx',
      context: {
        json: () => { throw new Error('body already read'); },
        body: { error: 'daily_limit', limit: 3 },
      },
    };
    expect(await readOutcome({ error }))
      .toEqual({ ok: false, reason: 'daily_limit', limit: 3 });
  });

  it('ignores a context that carries no object body', async () => {
    // Declared out here because `Fn['error']` does not admit to having a
    // `context` at all — which is the whole reason `bodyOf` has to reach
    // for it through a cast.
    const error = { message: 'nope', context: { body: 'plain text' } };
    expect(await readOutcome({ error }))
      .toEqual({ ok: false, reason: 'error', message: 'nope' });
  });

  it('has something to say even when nothing said anything', async () => {
    expect(await readOutcome({ error: {} }))
      .toEqual({ ok: false, reason: 'error', message: 'failed' });
  });
});

describe('searchPlaces', () => {
  it('asks fetch-place to search within the city', async () => {
    fake().replies({ data: { candidates: [{ place_id: 'g1' }] } });
    const out = await searchPlaces('cong caphe', 'hanoi');

    expect(fake().log).toEqual([{
      fn: 'fetch-place', op: 'invoke', filters: [],
      payload: { action: 'search', query: 'cong caphe', city: 'hanoi' },
    }]);
    expect(out).toEqual([{ place_id: 'g1' }]);
  });

  it('reads no candidates as an empty list', async () => {
    fake().replies({ data: {} });
    expect(await searchPlaces('nothing', 'hanoi')).toEqual([]);
  });

  // Unlike `findSpots`, this one throws: a search that failed is worth
  // saying so here, because the screen behind it is the suggestion flow
  // and a silent empty list would read as "Google has never heard of it".
  it('throws when the function refuses', async () => {
    fake().replies({ error: { message: 'over quota' } });
    await expect(searchPlaces('cong caphe', 'hanoi')).rejects.toThrow('over quota');
  });
});

describe('suggestPlace', () => {
  it('sends the id and the city, and decides nothing else', async () => {
    fake().replies({ data: { slug: 'cong-caphe', photos: 2 } });
    const out = await suggestPlace('g1', 'hanoi');

    // No `category`, no `submitted_by`, no `status`. Every one of those is
    // the server's to set — sending them from here is the `curator_handle`
    // mistake, which is a client naming its own byline.
    expect(fake().log[0].payload).toEqual({ action: 'suggest', place_id: 'g1', city: 'hanoi' });
    expect(out).toEqual({ ok: true, slug: 'cong-caphe', photos: 2 });
  });

  it('reports a refusal in terms the reader can act on', async () => {
    fake().replies({ error: nonOk({ error: 'already_known', live: true, slug: 'cong-caphe' }) });
    expect(await suggestPlace('g1', 'hanoi'))
      .toEqual({ ok: false, reason: 'already_live', slug: 'cong-caphe' });
  });
});

describe('knownByPlaceId', () => {
  const row = (over: Record<string, unknown> = {}) => ({
    google_place_id: 'g1', slug: 'cong-caphe',
    is_published: true, review_status: 'approved', submitted_by: null, ...over,
  });

  it('asks once for every id rather than once per row', async () => {
    fake().replies({ data: [row(), row({ google_place_id: 'g2', slug: 'the-note' })] });
    const out = await knownByPlaceId(['g1', 'g2']);

    expect(fake().log).toHaveLength(1);
    expect(fake().log[0].table).toBe('places');
    expect(fake().log[0].filters).toEqual([['google_place_id', ['g1', 'g2']]]);
    expect(out).toEqual({
      g1: { state: 'live', slug: 'cong-caphe' },
      g2: { state: 'live', slug: 'the-note' },
    });
  });

  it('does not go to the database for an empty list', async () => {
    expect(await knownByPlaceId([])).toEqual({});
    expect(fake().log).toEqual([]);
  });

  // Two flags, and both have to say so. The desk approves and publishes as
  // separate actions, so approved-and-unpublished is a real state with real
  // rows in it — see `live.ts`.
  it('counts a row as live only when published and approved', async () => {
    fake().replies({ data: [
      row({ google_place_id: 'a', is_published: false }),
      row({ google_place_id: 'b', review_status: 'pending' }),
    ] });
    // With the slug aboard: RLS only returns live rows and your own, so
    // a non-live row is yours and the row can open it. See `Known`.
    expect(await knownByPlaceId(['a', 'b'])).toEqual({
      a: { state: 'mine', slug: 'cong-caphe' },
      b: { state: 'mine', slug: 'cong-caphe' },
    });
  });

  it('skips a row with no google id to key it by', async () => {
    fake().replies({ data: [row({ google_place_id: '' }), row({ google_place_id: 'g2' })] });
    expect(await knownByPlaceId(['g1', 'g2'])).toEqual({ g2: { state: 'live', slug: 'cong-caphe' } });
  });

  // A failed lookup must not take the search results down with it. Every
  // row simply looks new, and the function still refuses the duplicate.
  it('answers "nothing known" when the lookup fails', async () => {
    fake().replies({ error: { message: 'timeout' } });
    expect(await knownByPlaceId(['g1'])).toEqual({});
  });

  it('answers "nothing known" when the lookup returns nothing', async () => {
    fake().replies({ data: null });
    expect(await knownByPlaceId(['g1'])).toEqual({});
  });
});
