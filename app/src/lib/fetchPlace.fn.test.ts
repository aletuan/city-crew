// The `fetch-place` Edge Function, as deployed.
//
// It is the phone's door onto Google: search, name a point, and write a
// place into the catalog — and it is open to any signed-in account, with
// the service role and a keyed Google quota behind it. So what matters is
// who gets through and what each of them can spend. A session is the only
// thing between a stranger and the Google bill; the editors list is the
// only thing between a reader and a desk import, which carries no daily
// cap and no submitter; and the cap on `suggest` is the only brake on one
// account filling the review queue. None of those lines had a test.
//
// Loaded unchanged, as `deleteAccount.fn.test.ts` loads its function:
// `Deno` captures the handler, the `npm:` Supabase client is `lib/testing`'s
// — with one verb added, below — and `fetch` is Google, answering per
// endpoint from `routes`. What is asserted is the handler's answers, the
// client's log, and what was sent to Google and how often.

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { fakeSupabase, Reply } from './testing';

const h = vi.hoisted(() => ({
  fake: null as unknown as ReturnType<typeof fakeSupabase>,
  handler: null as unknown as (req: Request) => Promise<Response>,
  env: {} as Record<string, string | undefined>,
}));

vi.mock('npm:@supabase/supabase-js@2', async () => {
  const { fakeSupabase } = await import('./testing');
  h.fake = fakeSupabase();
  // `like` is the import's slug-collision probe (`slug like 'base%'`) and
  // nothing in the app asks it, so the shared fake has no such verb. Added
  // here rather than there, recorded with `~~` — Postgres's own marker —
  // so the probe stays assertable without widening every other test's fake.
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

/** One Google endpoint's answer. JSON unless `body` is already a string. */
type Route = { status?: number; body?: unknown };
let routes: Partial<Record<'search' | 'details' | 'geocode' | 'copy' | 'media', Route>> = {};

// Which endpoint a URL is. `copy` and `media` are the same Places endpoint
// asked two ways: `rehost.ts` fetches the bytes (a 302 followed), and the
// import's fallback asks for the short-lived link instead. Only the second
// goes through the handler's `gapi`, and so only the second counts towards
// its cap — the distinction the cap test turns on.
const endpoint = (url: string) =>
  url.includes(':searchText') ? 'search'
    : url.includes('/geocode/') ? 'geocode'
      : url.includes('skipHttpRedirect') ? 'media'
        : url.includes('/media?') ? 'copy'
          : 'details';

const google = vi.fn(async (url: string, _init?: RequestInit) => {
  const kind = endpoint(url);
  const r = routes[kind];
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
  const fn = '../../../supabase/functions/fetch-place/index.ts';
  await import(/* @vite-ignore */ fn);
});

beforeEach(() => {
  h.fake.reset();
  google.mockClear();
  routes = {};
  h.env = { GOOGLE_MAPS_API_KEY: 'gkey', SUPABASE_URL: 'https://p.test', SUPABASE_SERVICE_ROLE_KEY: 'k' };
});

afterEach(() => { vi.useRealTimers(); });

const call = (body?: unknown, init: { method?: string; token?: string | null } = {}) => {
  const token = init.token === undefined ? 'jwt' : init.token;
  return h.handler(new Request('https://p.test/functions/v1/fetch-place', {
    method: init.method ?? 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  }));
};

// Mixed case on purpose: the editors list is stored lowercase, and the
// lookup is only right if the function lowers what GoTrue hands it.
const session = (id = 'u1', email: string | null = 'Reader@Crew.TEST') => ({ data: { user: { id, email } }, error: null });
const editor = { data: { email: 'reader@crew.test' } };
const notEditor = { data: null };
const HCMC = {
  id: 'hcmc', name_en: 'Ho Chi Minh City', name_vi: 'TP. Hồ Chí Minh', short_en: 'HCMC', short_vi: 'SG',
  center_lat: 10.7769, center_lng: 106.7009, radius_km: 15,
};
const HANOI = { ...HCMC, id: 'hanoi', name_en: 'Hanoi', name_vi: 'Hà Nội', center_lat: 21.0285, center_lng: 105.8542, radius_km: 12 };
const city = (c = HCMC) => ({ data: c, error: null });
// A head count, which supabase-js answers in `count` rather than `data`.
// The fake hands a reply back whole, so the field arrives; its `Reply`
// type just has no name for it.
const counted = (n: number | null) => ({ count: n }) as Reply;

/** Signed in, editor or not, in a city — the three replies every action
 *  that gets past the door consumes first. */
const door = (asEditor = false, c = HCMC) =>
  h.fake.replies(session(), asEditor ? editor : notEditor, city(c));

const sentTo = (kind: ReturnType<typeof endpoint>) =>
  google.mock.calls.filter(([url]) => endpoint(url) === kind);
const gapiCalls = () => google.mock.calls.filter(([url]) => endpoint(url) !== 'copy');
const searchBody = () => JSON.parse(sentTo('search')[0][1]!.body as string);
const tables = (t: string) => h.fake.log.filter((a) => a.table === t);

describe('the door', () => {
  it('answers the preflight and refuses anything but POST, asking nobody', async () => {
    const pre = await call(undefined, { method: 'OPTIONS' });
    expect(pre.status).toBe(200);
    expect(pre.headers.get('Access-Control-Allow-Methods')).toBe('POST, OPTIONS');
    expect((await call(undefined, { method: 'GET' })).status).toBe(405);
    expect(h.fake.log).toEqual([]);
    expect(google).not.toHaveBeenCalled();
  });

  it('says so plainly when the Google key is not configured, before asking who is calling', async () => {
    h.env.GOOGLE_MAPS_API_KEY = undefined;
    const res = await call({ action: 'search', query: 'phở' });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'GOOGLE_MAPS_API_KEY secret is not set' });
    expect(h.fake.log).toEqual([]);
  });

  it('spends nothing on a caller with no token', async () => {
    h.fake.replies({ data: { user: null }, error: { message: 'no JWT' } });
    const res = await call({ action: 'search', query: 'phở' }, { token: null });
    expect(res.status).toBe(401);
    expect(h.fake.log).toEqual([expect.objectContaining({ fn: 'getUser', payload: '' })]);
    expect(google).not.toHaveBeenCalled();
  });

  it('spends nothing on a token GoTrue does not recognise', async () => {
    h.fake.replies({ data: null, error: { message: 'invalid JWT' } });
    const res = await call({ action: 'search', query: 'phở' }, { token: 'forged' });
    expect(res.status).toBe(401);
    expect(h.fake.log[0]).toMatchObject({ fn: 'getUser', payload: 'forged' });
    expect(tables('editors')).toEqual([]);
    expect(google).not.toHaveBeenCalled();
  });

  it('refuses an account with no email, which no editors row could ever match', async () => {
    h.fake.replies(session('u1', null));
    expect((await call({ action: 'search', query: 'phở' })).status).toBe(401);
    expect(google).not.toHaveBeenCalled();
  });

  it('looks the caller up on the editors list by the lowered email', async () => {
    door();
    routes.search = { body: {} };
    await call({ action: 'search', query: 'phở' });
    expect(tables('editors')[0]).toMatchObject({ filters: [['email', 'reader@crew.test']], maybe: true });
  });

  it('refuses a body that is not JSON as a 500 with the parser’s reason, spending nothing', async () => {
    h.fake.replies(session(), notEditor);
    const res = await call('{not json');
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBeTruthy();
    expect(tables('cities')).toEqual([]);
    expect(google).not.toHaveBeenCalled();
  });

  it('resolves the city it is given, and Ho Chi Minh City when it is given none', async () => {
    door(false, HANOI);
    routes.search = { body: {} };
    await call({ action: 'search', query: 'phở', city: 'hanoi' });
    expect(tables('cities')[0].filters).toEqual([['id', 'hanoi'], ['is_active', true]]);

    h.fake.reset();
    door();
    await call({ action: 'search', query: 'phở' });
    expect(tables('cities')[0].filters).toEqual([['id', 'hcmc'], ['is_active', true]]);
  });

  it('refuses a city that is not active before spending a Google call', async () => {
    h.fake.replies(session(), notEditor, { data: null, error: null });
    const res = await call({ action: 'search', query: 'phở', city: 'atlantis' });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'unknown city: atlantis' });
    expect(google).not.toHaveBeenCalled();
  });

  it('refuses an action it does not know', async () => {
    door();
    const res = await call({ action: 'delete' });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'unknown action: delete' });
    expect(google).not.toHaveBeenCalled();
  });
});

describe('search', () => {
  it('refuses an empty query without calling Google', async () => {
    door();
    expect((await call({ action: 'search', query: '   ' })).status).toBe(400);
    door();
    expect((await call({ action: 'search' })).status).toBe(400);
    expect(google).not.toHaveBeenCalled();
  });

  it('sends one call with the key, the trimmed query and the city’s circle, and maps what comes back', async () => {
    door();
    routes.search = {
      body: {
        places: [
          {
            id: 'gp1', displayName: { text: 'Phở Hòa' }, formattedAddress: '260C Pasteur',
            location: { latitude: 10.79, longitude: 106.69 }, rating: 4.4, userRatingCount: 9000,
          },
          { id: 'gp2' },
        ],
      },
    };
    const res = await call({ action: 'search', query: '  phở  ' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      candidates: [
        { place_id: 'gp1', name: 'Phở Hòa', address: '260C Pasteur', lat: 10.79, lng: 106.69, rating: 4.4, rating_count: 9000 },
        // A bare hit says nothing it does not know: no zeros, no invented name.
        { place_id: 'gp2', name: '', address: '', lat: null, lng: null, rating: null, rating_count: null },
      ],
    });
    expect(gapiCalls()).toHaveLength(1);
    const headers = sentTo('search')[0][1]!.headers as Record<string, string>;
    expect(headers['X-Goog-Api-Key']).toBe('gkey');
    expect(headers['X-Goog-FieldMask']).toContain('places.location');
    expect(searchBody()).toEqual({
      textQuery: 'phở', maxResultCount: 5,
      locationBias: { circle: { center: { latitude: 10.7769, longitude: 106.7009 }, radius: 15_000 } },
    });
  });

  it('answers no candidates when Google finds nothing', async () => {
    door();
    routes.search = { body: {} };
    expect(await (await call({ action: 'search', query: 'zzz' })).json()).toEqual({ candidates: [] });
  });

  it('leans towards the pin, twenty kilometres wide, when the client sends one', async () => {
    door();
    routes.search = { body: {} };
    await call({ action: 'search', query: 'phở', at: { lat: 21.0, lng: 105.8 } });
    expect(searchBody().locationBias).toEqual({ circle: { center: { latitude: 21.0, longitude: 105.8 }, radius: 20_000 } });
  });

  it('falls back to the city for a pin it cannot use, rather than biasing towards 0,0', async () => {
    routes.search = { body: {} };
    for (const at of [null, { lat: '21', lng: 105.8 }, { lat: 21 }, { lat: 91, lng: 105.8 }, { lat: 21, lng: 181 }]) {
      google.mockClear();
      door();
      await call({ action: 'search', query: 'phở', at });
      expect(searchBody().locationBias.circle.radius).toBe(15_000);
    }
  });

  it('asks in a language the app speaks and leaves any other to Google', async () => {
    door();
    routes.search = { body: {} };
    await call({ action: 'search', query: 'phở', lang: 'vi' });
    expect(searchBody().languageCode).toBe('vi');

    google.mockClear();
    door();
    await call({ action: 'search', query: 'phở', lang: 'fr' });
    expect(searchBody()).not.toHaveProperty('languageCode');
  });

  it('reports Google’s refusal with Google’s own words', async () => {
    door();
    routes.search = { status: 403, body: 'API key not valid' };
    const res = await call({ action: 'search', query: 'phở' });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Google 403: API key not valid' });
  });
});

describe('reverse', () => {
  const ward = {
    results: [{
      types: ['sublocality_level_1'],
      address_components: [{ long_name: 'Hoàn Kiếm', types: ['sublocality_level_1'] }],
    }],
  };

  it('names the point with one Geocoding call carrying the point, the types and the key', async () => {
    door();
    routes.geocode = { body: ward };
    const res = await call({ action: 'reverse', at: { lat: 21.03, lng: 105.85 }, lang: 'ja' });
    expect(await res.json()).toEqual({ name: 'Hoàn Kiếm' });
    expect(gapiCalls()).toHaveLength(1);
    const u = new URL(sentTo('geocode')[0][0]);
    expect(u.searchParams.get('latlng')).toBe('21.03,105.85');
    expect(u.searchParams.get('result_type')).toContain('sublocality_level_1|');
    expect(u.searchParams.get('language')).toBe('ja');
    expect(u.searchParams.get('key')).toBe('gkey');
  });

  it('leaves the language to Google when the client asks for one the app does not speak', async () => {
    door();
    routes.geocode = { body: ward };
    await call({ action: 'reverse', at: { lat: 21.03, lng: 105.85 }, lang: 'xx' });
    expect(new URL(sentTo('geocode')[0][0]).searchParams.has('language')).toBe(false);
  });

  it('refuses a point it cannot use without calling Google', async () => {
    // `1e400` is the one way JSON can carry a non-finite number: it parses
    // to Infinity, which `typeof` still calls a number.
    for (const at of ['null', '{"lat":1e400,"lng":105}', '{"lat":21,"lng":1e400}', '{"lat":-91,"lng":0}', '{"lat":0,"lng":-181}']) {
      door();
      const res = await call(`{"action":"reverse","at":${at}}`);
      expect(res.status).toBe(400);
    }
    door();
    expect((await call({ action: 'reverse' })).status).toBe(400);
    expect(google).not.toHaveBeenCalled();
  });

  it('reports Google’s refusal with Google’s own words', async () => {
    door();
    routes.geocode = { status: 429, body: 'OVER_QUERY_LIMIT' };
    const res = await call({ action: 'reverse', at: { lat: 21, lng: 105 } });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Google 429: OVER_QUERY_LIMIT' });
  });
});

describe('import and suggest', () => {
  const details = (over: Record<string, unknown> = {}) => ({
    id: 'gp1',
    displayName: { text: 'Cộng Cà Phê' },
    formattedAddress: '26 Lý Tự Trọng, Bến Nghé, Quận 1, Hồ Chí Minh',
    location: { latitude: 10.78, longitude: 106.70 },
    photos: [{ name: 'places/gp1/photos/a', authorAttributions: [{ displayName: 'Ann', uri: 'https://maps.test/ann' }] }],
    ...over,
  });
  const nearby = { data: [HANOI, HCMC].map(({ id, center_lat, center_lng }) => ({ id, center_lat, center_lng })) };

  /** The replies an import consumes once it is past the duplicate check:
   *  the cities to measure against, the slugs already taken, the row, one
   *  upload per photo, and the photo rows. */
  const writes = (photos = 1) => h.fake.replies(
    nearby,
    { data: [] },
    { data: { id: 'p1', slug: 'cong-ca-phe' }, error: null },
    ...Array.from({ length: photos }, () => ({ error: null })),
    { error: null },
  );
  const inserted = () => h.fake.log.find((a) => a.table === 'places' && a.op === 'insert')!.payload as Record<string, unknown>;

  it('refuses `import` to a reader, before any lookup or Google call', async () => {
    door(false);
    const res = await call({ action: 'import', place_id: 'gp1', category: 'food' });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'reader@crew.test is not on the editors list' });
    expect(tables('places')).toEqual([]);
    expect(google).not.toHaveBeenCalled();
  });

  it('refuses either action without a place id', async () => {
    door(true);
    expect((await call({ action: 'import', category: 'food' })).status).toBe(400);
    door(false);
    expect((await call({ action: 'suggest', category: 'food' })).status).toBe(400);
    expect(tables('places')).toEqual([]);
    expect(google).not.toHaveBeenCalled();
  });

  it('imports at the desk with no submitter and no cap, through the desk channel', async () => {
    door(true);
    h.fake.replies({ data: null });
    writes();
    routes.details = { body: details() };
    routes.copy = {};
    const res = await call({ action: 'import', place_id: 'gp1', category: 'out' });
    expect(res.status).toBe(200);
    const out = await res.json();
    expect(out).toEqual({ slug: inserted().slug, photos: 1 });
    expect(inserted()).toMatchObject({
      google_place_id: 'gp1', submitted_by: null, channel: 'desk', added_by: 'u1',
      category: 'out', city_id: 'hcmc', is_published: false, review_status: 'pending',
    });
    // An editor's import is never counted: the only `places` read before
    // the write is the duplicate check, by Google's id.
    const reads = tables('places').filter((a) => a.op === 'select');
    expect(reads[0].filters).toEqual([['google_place_id', 'gp1']]);
    expect(reads.flatMap((a) => a.filters).map(([k]) => k)).not.toContain('submitted_by');
    expect(sentTo('details')[0][0]).toBe('https://places.googleapis.com/v1/places/gp1');
  });

  it('suggests from the phone stamped with the caller, through the mobile channel', async () => {
    door(false);
    h.fake.replies(counted(3), { data: null });
    writes();
    routes.details = { body: details() };
    routes.copy = {};
    const res = await call({ action: 'suggest', place_id: 'gp1', category: 'something-else' });
    expect(res.status).toBe(200);
    // Anything but `out` is food: the category is a two-way switch, and a
    // value the client made up does not reach the constraint.
    expect(inserted()).toMatchObject({ submitted_by: 'u1', channel: 'mobile', added_by: 'u1', category: 'food' });
  });

  it('writes the photo row pointing at its own copy, credited, as the cover', async () => {
    door(true);
    h.fake.replies({ data: null });
    writes();
    routes.details = { body: details() };
    routes.copy = {};
    await call({ action: 'import', place_id: 'gp1', category: 'food' });
    const upload = h.fake.log.find((a) => a.fn === 'upload')!;
    expect(upload.table).toBe('place-photos');
    const [row] = tables('place_photos')[0].payload as Record<string, unknown>[];
    expect(row).toMatchObject({
      place_id: 'p1', photo_ref: 'places/gp1/photos/a', source: 'google', is_cover: true,
      attribution_name: 'Ann', attribution_uri: 'https://maps.test/ann',
      storage_path: (upload.payload as { path: string }).path,
    });
  });

  describe('the daily cap on suggestions', () => {
    it('counts the caller’s own submissions over the last twenty-four hours', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-10-09T12:00:00Z'));
      door(false);
      h.fake.replies(counted(0), { data: null });
      writes();
      routes.details = { body: details() };
      routes.copy = {};
      await call({ action: 'suggest', place_id: 'gp1', category: 'food' });
      expect(tables('places')[0]).toMatchObject({
        op: 'select',
        filters: [['submitted_by', 'u1'], ['created_at>=', '2026-10-08T12:00:00.000Z']],
      });
    });

    it('stops the fiftieth-and-first before the duplicate check or Google', async () => {
      door(false);
      h.fake.replies(counted(50));
      const res = await call({ action: 'suggest', place_id: 'gp1', category: 'food' });
      expect(res.status).toBe(429);
      expect(await res.json()).toEqual({ error: 'daily_limit', limit: 50 });
      expect(tables('places')).toHaveLength(1);
      expect(google).not.toHaveBeenCalled();
    });

    it('lets the fiftieth through', async () => {
      door(false);
      h.fake.replies(counted(49), { data: null });
      writes();
      routes.details = { body: details() };
      routes.copy = {};
      expect((await call({ action: 'suggest', place_id: 'gp1', category: 'food' })).status).toBe(200);
    });

    it('reads a count it was not given as none, not as a refusal', async () => {
      door(false);
      h.fake.replies(counted(null), { data: null });
      writes();
      routes.details = { body: details() };
      routes.copy = {};
      expect((await call({ action: 'suggest', place_id: 'gp1', category: 'food' })).status).toBe(200);
    });
  });

  describe('a place already known', () => {
    const dup = (is_published: boolean, review_status: string) =>
      ({ data: { slug: 'cong-ca-phe', is_published, review_status } });

    it('tells the desk its slug, whatever its state', async () => {
      door(true);
      h.fake.replies(dup(false, 'pending'));
      const res = await call({ action: 'import', place_id: 'gp1', category: 'food' });
      expect(res.status).toBe(409);
      expect(await res.json()).toEqual({ error: 'already imported as “cong-ca-phe”', slug: 'cong-ca-phe' });
      expect(google).not.toHaveBeenCalled();
    });

    it('tells a reader where a live place is', async () => {
      door(false);
      h.fake.replies(counted(0), dup(true, 'approved'));
      const res = await call({ action: 'suggest', place_id: 'gp1', category: 'food' });
      expect(res.status).toBe(409);
      expect(await res.json()).toEqual({ error: 'already_known', live: true, slug: 'cong-ca-phe' });
    });

    it('does not leak the slug of somebody’s pending suggestion to a reader', async () => {
      for (const [pub, status] of [[false, 'approved'], [true, 'pending']] as const) {
        door(false);
        h.fake.replies(counted(0), dup(pub, status));
        const res = await call({ action: 'suggest', place_id: 'gp1', category: 'food' });
        expect(await res.json()).toEqual({ error: 'already_known', live: false, slug: null });
      }
      expect(google).not.toHaveBeenCalled();
    });
  });

  it('reports a details call Google refused, and writes nothing', async () => {
    door(true);
    h.fake.replies({ data: null });
    routes.details = { status: 404, body: 'NOT_FOUND' };
    const res = await call({ action: 'import', place_id: 'gp1', category: 'food' });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Google 404: NOT_FOUND' });
    expect(h.fake.log.filter((a) => a.op === 'insert')).toEqual([]);
  });

  it('refuses a place farther than any city from every city, and writes nothing', async () => {
    door(true);
    h.fake.replies({ data: null }, nearby);
    routes.details = { body: details({ location: { latitude: 1.35, longitude: 103.82 } }) };
    const res = await call({ action: 'import', place_id: 'gp1', category: 'food' });
    expect(res.status).toBe(500);
    expect((await res.json()).error).toMatch(/^outside every city City Crew covers/);
    expect(h.fake.log.filter((a) => a.op === 'insert')).toEqual([]);
  });

  // The cap is twenty per request and the most an import can ask through
  // `gapi` is seven: one details call and, when every copy fails, one
  // short-lived-link lookup per photo for six photos. So the cap's refusal
  // cannot be reached from outside — what can be pinned is that the worst
  // case fits under it. A cap lowered below seven would cost the sixth
  // photo silently, which is what this would see.
  it('spends at most seven Google calls on an import, all under the cap', async () => {
    door(true);
    h.fake.replies({ data: null }, nearby, { data: [] }, { data: { id: 'p1', slug: 's' }, error: null }, { error: null });
    routes.details = {
      body: details({ photos: Array.from({ length: 9 }, (_, i) => ({ name: `places/gp1/photos/${i}` })) }),
    };
    routes.copy = { status: 500, body: 'copy failed' };
    routes.media = { body: { photoUri: 'https://lh3.test/x' } };
    const res = await call({ action: 'import', place_id: 'gp1', category: 'food' });
    expect(await res.json()).toMatchObject({ photos: 6 });
    expect(gapiCalls()).toHaveLength(7);
    expect(tables('place_photos')[0].payload).toHaveLength(6);
  });
});
