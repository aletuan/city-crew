// The `refresh-photos` Edge Function, as deployed.
//
// It exists for the places Google took their photos back from — 104 of
// them on the first rehost, 82 left with no picture at all, the Cathedral
// and Hỏa Lò among them — and it rewrites their rows in place. The rules
// it carries are the kind nobody sees break: a row keeps its id, order and
// cover flag and only its picture changes; a ref a working row already
// shows is never handed out a second time; a row an editor hid is left
// alone; and a row with nothing left to show is hidden, never deleted.
// None of it had a test.
//
// What is pinned: the gate, how many places a call takes and which, the
// Place Details request, what each row is written, the copy that follows
// (`_shared/rehost.ts`, run for real against the stubbed `fetch`), and
// that a place that fails is written down without stopping the next.
//
// Loaded unchanged, as the other `.fn.test.ts` files load theirs: `Deno`
// captures the handler, the `npm:` Supabase client is `lib/testing`'s, and
// `fetch` is a stand-in that answers Google's two endpoints from a table a
// test sets. The fake client has no `.is`, `.not` or `.gt`, which only the
// batch jobs use; they are added here, recording into the same log.

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Asked, fakeSupabase, Reply } from './testing';

const h = vi.hoisted(() => ({
  fake: null as unknown as ReturnType<typeof fakeSupabase>,
  handler: null as unknown as (req: Request) => Promise<Response>,
  env: {} as Record<string, string | undefined>,
}));

vi.mock('npm:@supabase/supabase-js@2', async () => {
  const { fakeSupabase } = await import('./testing');
  h.fake = fakeSupabase();
  return { createClient: () => withBatchVerbs(h.fake) };
});

/** The fake client, with the three filters the batch jobs use and
 *  nothing else does, recorded with Postgres's own operator beside the
 *  column as `gte` already is. */
function withBatchVerbs(fake: ReturnType<typeof fakeSupabase>) {
  return {
    ...fake.client,
    from: (table: string) => {
      const b = fake.client.from(table) as Record<string, unknown>;
      const asked = fake.log.at(-1)!;
      b.is = (k: string, v: unknown) => { asked.filters.push([`${k} is`, v]); return b; };
      b.not = (k: string, op: string, v: unknown) => { asked.filters.push([`${k} not ${op}`, v]); return b; };
      b.gt = (k: string, v: unknown) => { asked.filters.push([`${k}>`, v]); return b; };
      return b;
    },
  };
}

/** What Google answers, by place: its details, or a status and a body. */
let google: Record<string, { photos?: unknown[] } | { status: number; text: string }> = {};
/** What the media endpoint answers for a ref; a JPEG unless a test says. */
let media: Record<string, { status: number; text: string }> = {};
const fetched: { url: string; headers: Record<string, string> }[] = [];

const fakeFetch = async (input: string, init?: { headers?: Record<string, string> }) => {
  fetched.push({ url: input, headers: init?.headers ?? {} });
  const m = input.match(/^https:\/\/places\.googleapis\.com\/v1\/(places\/[^/?]+\/photos\/[^/?]+)\/media/);
  if (m) {
    const bad = media[m[1]];
    if (bad) return new Response(bad.text, { status: bad.status });
    return new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/jpeg' } });
  }
  const gid = input.replace('https://places.googleapis.com/v1/places/', '');
  const a = google[gid] ?? {};
  if ('status' in a) return new Response(a.text, { status: a.status });
  return new Response(JSON.stringify(a));
};

beforeAll(async () => {
  vi.stubGlobal('Deno', {
    serve: (fn: (req: Request) => Promise<Response>) => { h.handler = fn; },
    env: { get: (k: string) => h.env[k] },
  });
  vi.stubGlobal('fetch', fakeFetch);
  const fn = '../../../supabase/functions/refresh-photos/index.ts';
  await import(/* @vite-ignore */ fn);
});

afterAll(() => { vi.unstubAllGlobals(); });

beforeEach(() => {
  h.fake.reset();
  h.env = { GOOGLE_MAPS_API_KEY: 'gkey', SUPABASE_URL: 'https://p.test', SUPABASE_SERVICE_ROLE_KEY: 'k' };
  google = {};
  media = {};
  fetched.length = 0;
});

const call = (body?: unknown, init: { method?: string; headers?: Record<string, string> } = {}) =>
  h.handler(new Request('https://p.test/functions/v1/refresh-photos', {
    method: init.method ?? 'POST',
    headers: init.headers ?? { Authorization: 'Bearer jwt' },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  }));

const editor = (): Reply[] => [
  { data: { user: { email: 'desk@crew.test' } }, error: null },
  { data: { email: 'desk@crew.test' }, error: null },
];
const ok: Reply = { data: null, error: null };
/** One stale row as the first query sees it: the place, joined. */
const staleOf = (place_id: string, slug = place_id, google_place_id: string | null = `G${place_id}`) =>
  ({ place_id, places: { id: place_id, slug, google_place_id } });
const row = (id: string, sort_order: number, over: Record<string, unknown> = {}) =>
  ({ id, photo_ref: `places/old/photos/${id}`, sort_order, storage_path: null, is_hidden: false, ...over });
const fresh = (name: string, author?: { displayName?: string; uri?: string }) =>
  ({ name, ...(author ? { authorAttributions: [author] } : {}) });
/** The three replies one successful copy spends: the row's new ref, the
 *  upload, and the row pointed at the copy. (`getPublicUrl` takes none.) */
const copied = (): Reply[] => [ok, ok, ok];

const first = () => h.fake.log.find((a) => a.table === 'place_photos' && a.op === 'select')!;
const writes = () => h.fake.log.filter((a) => a.table === 'place_photos' && a.op === 'update') as
  (Asked & { payload: Record<string, unknown> })[];
const body = async (res: Response) => res.json() as Promise<{
  places: number; refreshed: number; hidden: number; failed: number; cursor: string | null;
  errors: { place: string; error: string }[];
}>;

describe('who gets through the door', () => {
  it('answers the preflight and refuses anything but POST, asking nothing', async () => {
    expect((await call(undefined, { method: 'OPTIONS' })).status).toBe(200);
    expect((await call(undefined, { method: 'GET' })).status).toBe(405);
    expect(h.fake.log).toEqual([]);
  });

  it('says so plainly when the Google key is not configured, before anything is read', async () => {
    h.env.GOOGLE_MAPS_API_KEY = undefined;
    const res = await call({});
    expect(res.status).toBe(500);
    expect(h.fake.log).toEqual([]);
  });

  it('refuses a caller who is not an editor, and reads no photos', async () => {
    h.fake.replies({ data: { user: { email: 'reader@crew.test' } }, error: null }, { data: null });
    expect((await call({})).status).toBe(403);
    expect(h.fake.log.some((a) => a.table === 'place_photos')).toBe(false);
  });

  it('lets the job in with its own live token', async () => {
    h.fake.replies(
      { data: { token: 'tok', expires_at: new Date(Date.now() + 60_000).toISOString() } },
      { data: [], error: null },
    );
    expect((await call({}, { headers: { 'x-ops-token': 'tok' } })).status).toBe(200);
    expect(h.fake.log[0]).toMatchObject({ table: 'ops_tokens', filters: [['name', 'refresh-photos']] });
  });
});

describe('which places one call takes', () => {
  it('reads only Google rows with a ref and no copy, in place order, from the empty body too', async () => {
    h.fake.replies(...editor(), { data: [], error: null });
    expect(await body(await call())).toEqual({ places: 0, refreshed: 0, hidden: 0, failed: 0, cursor: null, errors: [] });
    expect(first()).toMatchObject({
      payload: 'place_id, places!inner(id, slug, google_place_id)',
      // Hidden rows are not work: the loop leaves them alone, so a place
      // whose only stale rows are hidden must not be picked at all.
      filters: [['source', 'google'], ['storage_path is', null], ['photo_ref not is', null], ['is_hidden', false]],
      order: ['place_id'],
    });
  });

  // The query returns rows, several to a place; the cap is on places. A
  // place already counted is not a new one, however late its rows come.
  it('stops at four places by default, counting places and not rows', async () => {
    const rows = ['a', 'a', 'b', 'c', 'd', 'd', 'e'].map((p) => staleOf(p));
    h.fake.replies(...editor(), { data: rows, error: null });
    const out = await body(await call({}));
    expect(out.places).toBe(4);
    expect(out.cursor).toBe('d');
  });

  it('never more than eight places, never fewer than one, whatever is asked', async () => {
    const many = Array.from({ length: 12 }, (_, i) => staleOf(`p${String(i).padStart(2, '0')}`));
    for (const [asked, taken] of [[50, 8], [-1, 1], [0, 4], [2, 2]] as const) {
      h.fake.reset();
      h.fake.replies(...editor(), { data: many, error: null });
      expect((await body(await call({ limit: asked }))).places, `limit ${asked}`).toBe(taken);
    }
  });

  it('walks on from the cursor, and takes named places as named, eight at most', async () => {
    h.fake.replies(...editor(), { data: [], error: null });
    await call({ after: 'p3' });
    expect(first().filters).toContainEqual(['place_id>', 'p3']);

    h.fake.reset();
    h.fake.replies(...editor(), { data: [], error: null });
    const ids = Array.from({ length: 10 }, (_, i) => `p${i}`);
    await call({ place_ids: ids });
    expect(first().filters).toContainEqual(['place_id', ids.slice(0, 8)]);
  });

  it('says so when the rows cannot be read', async () => {
    h.fake.replies(...editor(), { data: null, error: { message: 'timeout' } });
    const res = await call({});
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'timeout' });
  });

  it('treats no rows at all as no work', async () => {
    h.fake.replies(...editor(), { data: null, error: null });
    expect((await body(await call({}))).places).toBe(0);
  });
});

describe('a place', () => {
  it('asks Place Details for its photos alone, on the key, by its Google id', async () => {
    google = { Gp1: { photos: [] } };
    h.fake.replies(...editor(), { data: [staleOf('p1')], error: null }, { data: [], error: null });
    await call({});
    expect(fetched[0]).toEqual({
      url: 'https://places.googleapis.com/v1/places/Gp1',
      headers: { 'X-Goog-Api-Key': 'gkey', 'X-Goog-FieldMask': 'photos' },
    });
    const rows = h.fake.log.filter((a) => a.table === 'place_photos' && a.op === 'select')[1];
    expect(rows).toMatchObject({
      payload: 'id, photo_ref, sort_order, storage_path, is_hidden',
      filters: [['place_id', 'p1'], ['source', 'google']],
      order: ['sort_order'],
    });
  });

  // The whole job, on one place: its stale rows take Google's current refs
  // in order, skipping the one a working row already shows; the hidden row
  // is passed over; and the row left with nothing is hidden.
  it('gives each stale row the next fresh ref, in order, and hides the one left over', async () => {
    google = { Gp1: { photos: [
      fresh('places/Gp1/photos/shown'),
      fresh('places/Gp1/photos/n1', { displayName: 'Lan', uri: 'https://maps.test/lan' }),
      fresh('places/Gp1/photos/n2'),
    ] } };
    h.fake.replies(
      ...editor(),
      { data: [staleOf('p1', 'cathedral')], error: null },
      { data: [
        row('w', 0, { photo_ref: 'places/Gp1/photos/shown', storage_path: 'cathedral/w.jpg' }),
        row('s1', 1),
        row('hid', 2, { is_hidden: true }),
        row('s2', 3),
        row('s3', 4),
      ], error: null },
      ...copied(), ...copied(), ok,
    );
    const out = await body(await call({}));
    expect(out).toEqual({ places: 1, refreshed: 2, hidden: 1, failed: 0, cursor: 'p1', errors: [] });

    const [s1, s1copy, s2, s2copy, s3] = writes();
    expect(s1).toMatchObject({
      filters: [['id', 's1']],
      payload: { photo_ref: 'places/Gp1/photos/n1', attribution_name: 'Lan', attribution_uri: 'https://maps.test/lan' },
    });
    // Only the picture changes: no order, no cover, no visibility.
    expect(Object.keys(s1.payload).sort()).toEqual(['attribution_name', 'attribution_uri', 'photo_ref']);
    expect(s1copy).toMatchObject({
      filters: [['id', 's1']],
      payload: { storage_path: 'cathedral/s1.jpg', photo_uri: 'https://storage.test/place-photos/cathedral/s1.jpg' },
    });
    expect(s2).toMatchObject({
      filters: [['id', 's2']],
      payload: { photo_ref: 'places/Gp1/photos/n2', attribution_name: null, attribution_uri: null },
    });
    expect(s2copy.payload).toMatchObject({ storage_path: 'cathedral/s2.jpg' });
    expect(s3).toMatchObject({ filters: [['id', 's3']], payload: { is_hidden: true } });
    expect(writes().some((w) => w.filters[0][1] === 'hid' || w.filters[0][1] === 'w')).toBe(false);
    // The copies are of the new refs, at the width the app draws.
    expect(fetched.slice(1).map((f) => f.url)).toEqual([
      'https://places.googleapis.com/v1/places/Gp1/photos/n1/media?maxWidthPx=1200&key=gkey',
      'https://places.googleapis.com/v1/places/Gp1/photos/n2/media?maxWidthPx=1200&key=gkey',
    ]);
    expect(h.fake.log.filter((a) => a.fn === 'upload').map((a) => (a.payload as { path: string }).path))
      .toEqual(['cathedral/s1.jpg', 'cathedral/s2.jpg']);
    // Nothing is ever deleted.
    expect(h.fake.log.some((a) => a.op === 'delete' || a.fn === 'remove')).toBe(false);
  });

  it('hides every stale row when Google lists no photos at all', async () => {
    google = { Gp1: {} };
    h.fake.replies(...editor(), { data: [staleOf('p1')], error: null }, { data: [row('s1', 0), row('s2', 1)], error: null }, ok, ok);
    const out = await body(await call({}));
    expect(out).toMatchObject({ refreshed: 0, hidden: 2 });
    expect(writes().map((w) => w.payload)).toEqual([{ is_hidden: true }, { is_hidden: true }]);
  });

  it('has nothing to do when its rows come back empty', async () => {
    google = { Gp1: { photos: [fresh('places/Gp1/photos/n1')] } };
    h.fake.replies(...editor(), { data: [staleOf('p1')], error: null }, { data: null, error: null });
    expect(await body(await call({}))).toMatchObject({ places: 1, refreshed: 0, hidden: 0, failed: 0 });
    expect(writes()).toEqual([]);
  });
});

describe('a place that fails', () => {
  const run = async (...replies: Reply[]) => {
    h.fake.replies(...editor(), { data: [staleOf('p1', 'hoa-lo')], error: null }, ...replies);
    return body(await call({}));
  };

  it('is written down, without a call to Google, when it has no Google id', async () => {
    h.fake.replies(...editor(), { data: [staleOf('p1', 'hoa-lo', null)], error: null });
    const out = await body(await call({}));
    expect(out).toMatchObject({ failed: 1, errors: [{ place: 'hoa-lo', error: 'no google_place_id' }] });
    expect(fetched).toEqual([]);
  });

  it('is written down with Google’s status and its answer, the whole line cut to 200 characters', async () => {
    google = { Gp1: { status: 404, text: 'N'.repeat(500) } };
    const out = await run();
    expect(out.errors).toEqual([{ place: 'hoa-lo', error: `Google 404: ${'N'.repeat(188)}` }]);
    expect(writes()).toEqual([]);
  });

  it('is written down when its rows cannot be read', async () => {
    google = { Gp1: { photos: [] } };
    expect((await run({ data: null, error: { message: 'rls' } })).errors).toEqual([{ place: 'hoa-lo', error: 'rls' }]);
  });

  it('is written down when a row cannot be hidden', async () => {
    google = { Gp1: { photos: [] } };
    const out = await run({ data: [row('s1', 0)], error: null }, { error: { message: 'locked' } });
    expect(out).toMatchObject({ hidden: 0, errors: [{ place: 'hoa-lo', error: 'locked' }] });
  });

  it('is written down, and copies nothing, when a row cannot take its new ref', async () => {
    google = { Gp1: { photos: [fresh('places/Gp1/photos/n1')] } };
    const out = await run({ data: [row('s1', 0)], error: null }, { error: { message: 'conflict' } });
    expect(out).toMatchObject({ refreshed: 0, errors: [{ place: 'hoa-lo', error: 'conflict' }] });
    expect(fetched).toHaveLength(1);
  });

  // The copy throws with Google's own words; the row keeps its new ref
  // and no copy, so it is still stale and the next run takes it again.
  it('is written down when the copy fails, and the row is left stale for a later run', async () => {
    google = { Gp1: { photos: [fresh('places/Gp1/photos/n1')] } };
    media = { 'places/Gp1/photos/n1': { status: 400, text: 'retrieve it from Places API endpoints' } };
    const out = await run({ data: [row('s1', 0)], error: null }, ok);
    expect(out).toMatchObject({ refreshed: 0, errors: [{ place: 'hoa-lo', error: 'Google 400: retrieve it from Places API endpoints' }] });
    expect(writes().map((w) => Object.keys(w.payload))).toEqual([['photo_ref', 'attribution_name', 'attribution_uri']]);
  });

  it('is written down whatever is thrown, even something that is not an Error', async () => {
    google = { Gp1: { photos: [] } };
    h.fake.replies(...editor(), { data: [staleOf('p1', 'hoa-lo')], error: null }, { throws: 'socket hang up' });
    expect((await body(await call({}))).errors).toEqual([{ place: 'hoa-lo', error: 'socket hang up' }]);
  });

  it('does not stop the next place', async () => {
    google = { Gp1: { status: 500, text: 'boom' }, Gp2: { photos: [fresh('places/Gp2/photos/n1')] } };
    h.fake.replies(
      ...editor(),
      { data: [staleOf('p1', 'hoa-lo'), staleOf('p2', 'mausoleum')], error: null },
      { data: [row('s1', 0)], error: null },
      ...copied(),
    );
    const out = await body(await call({}));
    expect(out).toEqual({
      places: 2, refreshed: 1, hidden: 0, failed: 1, cursor: 'p2',
      errors: [{ place: 'hoa-lo', error: 'Google 500: boom' }],
    });
  });
});
