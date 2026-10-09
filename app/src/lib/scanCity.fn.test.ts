// The `scan-city` Edge Function, as deployed.
//
// One press of Scan on the desk runs a curated Google search for a city and
// writes up to eight places into the catalog, each with a details call and
// its photos — the most Google money any single request here can spend,
// with the service role behind it. Its only guard is the editors list, and
// the rest of what it promises is accounting: places already known are not
// bought twice, one place that fails does not lose the others, and the
// answer says what happened. None of it had a test.
//
// Loaded unchanged, as `fetchPlace.fn.test.ts` loads its sibling: `Deno`
// captures the handler, the `npm:` Supabase client is `lib/testing`'s with
// the `like` verb the import's slug probe needs, and `fetch` is Google,
// answering per endpoint from `routes`.

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { fakeSupabase, Reply } from './testing';

const h = vi.hoisted(() => ({
  fake: null as unknown as ReturnType<typeof fakeSupabase>,
  handler: null as unknown as (req: Request) => Promise<Response>,
  env: {} as Record<string, string | undefined>,
}));

vi.mock('npm:@supabase/supabase-js@2', async () => {
  const { fakeSupabase } = await import('./testing');
  h.fake = fakeSupabase();
  // See `fetchPlace.fn.test.ts`: `like` is the import's slug probe, which
  // the shared fake has no verb for.
  const from = h.fake.client.from;
  const client = {
    ...h.fake.client,
    from: (table: string) => {
      const b = from(table) as Record<string, unknown>;
      const asked = h.fake.log.at(-1)!;
      b.like = (k: string, v: unknown) => { asked.filters.push([`${k}~~`, v]); return b; };
      return b;
    },
  };
  return { createClient: () => client };
});

type Route = { status?: number; body?: unknown };
let routes: Partial<Record<'search' | 'details' | 'copy' | 'media', Route>> = {};
/** Per-place details, by Google id; a place missing here gets `routes.details`. */
let detailsById: Record<string, Route> = {};

// `copy` is `rehost.ts` fetching the bytes, outside the handler's `gapi`;
// `media` is the import's fallback for a failed copy, inside it. Only the
// second counts towards the cap.
const endpoint = (url: string) =>
  url.includes(':searchText') ? 'search'
    : url.includes('skipHttpRedirect') ? 'media'
      : url.includes('/media?') ? 'copy'
        : 'details';

const google = vi.fn(async (url: string, _init?: RequestInit) => {
  const kind = endpoint(url);
  const r = kind === 'details' ? detailsById[url.split('/').pop()!] ?? routes.details : routes[kind];
  if (!r) throw new Error(`no route for ${kind}: ${url}`);
  const status = r.status ?? 200;
  if (kind === 'copy' && status === 200) {
    return new Response(new Uint8Array([0xff, 0xd8, 0xff]), { status, headers: { 'content-type': 'image/jpeg' } });
  }
  return new Response(typeof r.body === 'string' ? r.body : JSON.stringify(r.body ?? {}), { status });
});

beforeAll(async () => {
  vi.stubGlobal('Deno', {
    serve: (fn: (req: Request) => Promise<Response>) => { h.handler = fn; },
    env: { get: (k: string) => h.env[k] },
  });
  vi.stubGlobal('fetch', google);
  const fn = '../../../supabase/functions/scan-city/index.ts';
  await import(/* @vite-ignore */ fn);
});

beforeEach(() => {
  h.fake.reset();
  google.mockClear();
  routes = {};
  detailsById = {};
  h.env = { GOOGLE_MAPS_API_KEY: 'gkey', SUPABASE_URL: 'https://p.test', SUPABASE_SERVICE_ROLE_KEY: 'k' };
});

const call = (body?: unknown, init: { method?: string; token?: string | null } = {}) => {
  const token = init.token === undefined ? 'jwt' : init.token;
  return h.handler(new Request('https://p.test/functions/v1/scan-city', {
    method: init.method ?? 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  }));
};

const session = (id = 'u1', email: string | null = 'Desk@Crew.TEST') => ({ data: { user: { id, email } }, error: null });
const editor = { data: { email: 'desk@crew.test' } };
const HANOI = {
  id: 'hanoi', name_en: 'Hanoi', name_vi: 'Hà Nội', short_en: 'HN', short_vi: 'HN',
  center_lat: 21.0285, center_lng: 105.8542, radius_km: 12,
};
const tables = (t: string) => h.fake.log.filter((a) => a.table === t);
const sentTo = (kind: ReturnType<typeof endpoint>) =>
  google.mock.calls.filter(([url]) => endpoint(url) === kind);
const gapiCalls = () => google.mock.calls.filter(([url]) => endpoint(url) !== 'copy');

/** A search hit: what the scan reads off it is the id and the name. */
const hit = (id: string, name?: string) => (name ? { id, displayName: { text: name } } : { id });

/** The replies one successful import consumes, for a place with no
 *  location (so no cities query) and `photos` copied photos. */
const imports = (slug: string, photos = 0) => [
  { data: [] },
  { data: { id: `row-${slug}`, slug }, error: null },
  ...Array.from({ length: photos }, () => ({ error: null })),
  ...(photos ? [{ error: null }] : []),
];

describe('the door', () => {
  it('answers the preflight and refuses anything but POST, asking nobody', async () => {
    expect((await call(undefined, { method: 'OPTIONS' })).status).toBe(200);
    expect((await call(undefined, { method: 'GET' })).status).toBe(405);
    expect(h.fake.log).toEqual([]);
  });

  it('says so plainly when the Google key is not configured', async () => {
    h.env.GOOGLE_MAPS_API_KEY = undefined;
    const res = await call({ action: 'categories' });
    expect(res.status).toBe(500);
    expect(h.fake.log).toEqual([]);
  });

  it('refuses a caller with no token, or one GoTrue does not recognise', async () => {
    h.fake.replies({ data: { user: null } });
    expect((await call({ action: 'scan', city: 'hanoi', category_key: 'cafes' }, { token: null })).status).toBe(401);
    expect(h.fake.log[0]).toMatchObject({ fn: 'getUser', payload: '' });
    h.fake.replies({ data: null, error: { message: 'invalid JWT' } });
    expect((await call({ action: 'scan', city: 'hanoi', category_key: 'cafes' }, { token: 'forged' })).status).toBe(401);
    h.fake.replies(session('u1', null));
    expect((await call({ action: 'scan', city: 'hanoi', category_key: 'cafes' })).status).toBe(401);
    expect(tables('editors')).toEqual([]);
    expect(google).not.toHaveBeenCalled();
  });

  it('refuses a signed-in reader who is not on the editors list, before any Google call', async () => {
    h.fake.replies(session('u2', 'Reader@Crew.TEST'), { data: null });
    const res = await call({ action: 'scan', city: 'hanoi', category_key: 'cafes' });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'reader@crew.test is not on the editors list' });
    expect(tables('editors')[0].filters).toEqual([['email', 'reader@crew.test']]);
    expect(tables('places')).toEqual([]);
    expect(google).not.toHaveBeenCalled();
  });

  it('refuses a body that is not JSON, spending nothing', async () => {
    h.fake.replies(session(), editor);
    const res = await call('{not json');
    expect(res.status).toBe(500);
    expect(google).not.toHaveBeenCalled();
  });

  it('refuses an action it does not know', async () => {
    h.fake.replies(session(), editor);
    const res = await call({ action: 'import' });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'unknown action: import' });
  });
});

describe('categories', () => {
  it('lists every curated query without the query itself', async () => {
    h.fake.replies(session(), editor);
    const { categories } = await (await call({ action: 'categories' })).json();
    expect(categories).toHaveLength(10);
    expect(categories[0]).toEqual({
      key: 'cafes', label_en: 'Cafés', label_vi: 'Quán cà phê', category: 'food', vibes: ['cafes'], categories: ['cafes'],
    });
    expect(categories.some((c: Record<string, unknown>) => 'q' in c)).toBe(false);
    expect(google).not.toHaveBeenCalled();
  });
});

describe('scan', () => {
  const editorIn = (c: Reply = { data: HANOI, error: null }) => h.fake.replies(session(), editor, c);

  it('refuses a category it has no query for, before resolving the city', async () => {
    h.fake.replies(session(), editor);
    const res = await call({ action: 'scan', city: 'hanoi', category_key: 'casinos' });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'unknown category_key: casinos' });
    expect(tables('cities')).toEqual([]);
    expect(google).not.toHaveBeenCalled();
  });

  it('refuses a scan with no city rather than defaulting one', async () => {
    editorIn({ data: null, error: null });
    const res = await call({ action: 'scan', category_key: 'cafes' });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'unknown city: ' });
    expect(tables('cities')[0].filters).toEqual([['id', ''], ['is_active', true]]);
    expect(google).not.toHaveBeenCalled();
  });

  it('searches with the query in the city’s English name, inside the city’s circle', async () => {
    editorIn();
    routes.search = { body: {} };
    await call({ action: 'scan', city: 'hanoi', category_key: 'cafes' });
    const [, init] = sentTo('search')[0];
    expect((init!.headers as Record<string, string>)['X-Goog-Api-Key']).toBe('gkey');
    expect(JSON.parse(init!.body as string)).toEqual({
      textQuery: 'best specialty coffee shops in Hanoi', maxResultCount: 10,
      locationBias: { circle: { center: { latitude: 21.0285, longitude: 105.8542 }, radius: 12_000 } },
    });
  });

  it('asks in Vietnamese where the curated query is Vietnamese', async () => {
    editorIn();
    routes.search = { body: {} };
    const out = await (await call({ action: 'scan', city: 'hanoi', category_key: 'markets' })).json();
    expect(out.query).toBe('chợ địa phương nổi tiếng Hà Nội');
  });

  it('answers an empty scan without asking the catalog anything', async () => {
    editorIn();
    routes.search = { body: {} };
    const res = await call({ action: 'scan', city: 'hanoi', category_key: 'cafes' });
    expect(await res.json()).toEqual({
      city: 'hanoi', category_key: 'cafes', query: 'best specialty coffee shops in Hanoi',
      found: 0, imported: [], skipped_existing: 0, errors: [],
    });
    expect(tables('places')).toEqual([]);
  });

  it('skips places already in the catalog, buying no details for them', async () => {
    editorIn();
    h.fake.replies({ data: [{ google_place_id: 'a' }] }, ...imports('b-place'));
    routes.search = { body: { places: [hit('a', 'A'), hit('b', 'B place')] } };
    routes.details = { body: { id: 'b', displayName: { text: 'B place' } } };
    const out = await (await call({ action: 'scan', city: 'hanoi', category_key: 'cafes' })).json();
    expect(tables('places')[0]).toMatchObject({ op: 'select', filters: [['google_place_id', ['a', 'b']]] });
    expect(out).toMatchObject({ found: 2, skipped_existing: 1, imported: [{ slug: 'b-place', name: 'B place' }], errors: [] });
    expect(sentTo('details').map(([u]) => u)).toEqual(['https://places.googleapis.com/v1/places/b']);
  });

  it('treats an unanswered known-places query as none known', async () => {
    editorIn();
    h.fake.replies({ data: null }, ...imports('a'));
    routes.search = { body: { places: [hit('a')] } };
    routes.details = { body: { id: 'a' } };
    const out = await (await call({ action: 'scan', city: 'hanoi', category_key: 'cafes' })).json();
    // A hit with no name is reported by its slug.
    expect(out).toMatchObject({ skipped_existing: 0, imported: [{ slug: 'unnamed-place', name: 'unnamed-place' }] });
  });

  it('writes each place as a scan by the editor, with the category’s own vibes and categories', async () => {
    editorIn();
    h.fake.replies({ data: [] }, ...imports('sky-bar'));
    routes.search = { body: { places: [hit('a', 'Sky Bar')] } };
    routes.details = { body: { id: 'a', displayName: { text: 'Sky Bar' }, types: ['cafe'], primaryType: 'cafe' } };
    await call({ action: 'scan', city: 'hanoi', category_key: 'rooftops' });
    const row = tables('places').find((a) => a.op === 'insert')!.payload;
    expect(row).toMatchObject({
      google_place_id: 'a', channel: 'scan', added_by: 'u1', submitted_by: null, city_id: 'hanoi',
      category: 'out', vibe_tags: ['views', 'nightlife'], categories: ['views', 'nightlife'],
      is_published: false, review_status: 'pending',
    });
  });

  it('copies three photos a place, not the six a single import takes', async () => {
    editorIn();
    h.fake.replies({ data: [] }, ...imports('a', 3));
    routes.search = { body: { places: [hit('a', 'A')] } };
    routes.details = { body: { id: 'a', displayName: { text: 'A' }, photos: Array.from({ length: 5 }, (_, i) => ({ name: `places/a/photos/${i}` })) } };
    routes.copy = {};
    await call({ action: 'scan', city: 'hanoi', category_key: 'cafes' });
    expect(tables('place_photos')[0].payload).toHaveLength(3);
  });

  it('keeps going past a place that fails, and says which one and why', async () => {
    editorIn();
    h.fake.replies({ data: [] }, ...imports('c'));
    routes.search = { body: { places: [hit('a', 'Gone'), hit('b'), hit('c', 'C')] } };
    detailsById = {
      a: { status: 404, body: 'NOT_FOUND' },
      b: { status: 500, body: 'boom' },
      c: { body: { id: 'c', displayName: { text: 'C' } } },
    };
    const out = await (await call({ action: 'scan', city: 'hanoi', category_key: 'cafes' })).json();
    expect(out.errors).toEqual(['Gone: Google 404: NOT_FOUND', 'b: Google 500: boom']);
    expect(out.imported).toEqual([{ slug: 'c', name: 'C' }]);
  });

  it('imports no more than eight places from one search', async () => {
    editorIn();
    const ten = Array.from({ length: 10 }, (_, i) => hit(`p${i}`, `P${i}`));
    h.fake.replies({ data: [] }, ...ten.slice(0, 8).flatMap((p) => imports(p.id)));
    routes.search = { body: { places: ten } };
    routes.details = { body: { id: 'x' } };
    const out = await (await call({ action: 'scan', city: 'hanoi', category_key: 'cafes' })).json();
    expect(out.found).toBe(10);
    expect(out.imported).toHaveLength(8);
    expect(sentTo('details')).toHaveLength(8);
  });

  it('reports a search Google refused, and writes nothing', async () => {
    editorIn();
    routes.search = { status: 403, body: 'API key not valid' };
    const res = await call({ action: 'scan', city: 'hanoi', category_key: 'cafes' });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Google 403: API key not valid' });
    expect(tables('places')).toEqual([]);
  });

  // The cap is forty-five a request and the worst a scan can ask through
  // `gapi` is thirty-three: the search, then eight places each with a
  // details call and, when every copy fails, a short-lived-link lookup for
  // each of its three photos. So the cap's refusal is not reachable from
  // outside; what is pinned is that the worst case fits under it. A cap
  // lowered below thirty-three would cost the last place a photo without
  // an error anywhere — a failed lookup is skipped, not reported — which
  // is what the photo rows here would show.
  it('spends at most thirty-three Google calls on the worst scan, all under the cap', async () => {
    editorIn();
    const ten = Array.from({ length: 10 }, (_, i) => hit(`p${i}`, `P${i}`));
    h.fake.replies({ data: [] }, ...ten.slice(0, 8).flatMap((p) => [...imports(p.id), { error: null }]));
    routes.search = { body: { places: ten } };
    routes.details = { body: { id: 'x', photos: Array.from({ length: 6 }, (_, i) => ({ name: `places/x/photos/${i}` })) } };
    routes.copy = { status: 500, body: 'copy failed' };
    routes.media = { body: { photoUri: 'https://lh3.test/x' } };
    const out = await (await call({ action: 'scan', city: 'hanoi', category_key: 'cafes' })).json();
    expect(out.errors).toEqual([]);
    expect(gapiCalls()).toHaveLength(33);
    expect(tables('place_photos').map((a) => (a.payload as unknown[]).length)).toEqual(Array(8).fill(3));
  });
});
