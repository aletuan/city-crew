// The `write-blurb` Edge Function, as deployed.
//
// What it holds: the door (an editor or the ops token, nothing else), the
// refusal to touch a place that already has a blurb, what the model is
// handed — the row's facts, five of the desk's own blurbs of the same
// kinds, and a Wikipedia lead only when it names the city — and that the
// function writes nothing. Loaded unchanged, with `Deno`, the Supabase
// client, the Anthropic SDK and `fetch` stood in for, as the sibling
// function tests do.

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { fakeSupabase } from './testing';

const h = vi.hoisted(() => ({
  fake: null as unknown as ReturnType<typeof fakeSupabase>,
  handler: null as unknown as (req: Request) => Promise<Response>,
  create: null as unknown as ReturnType<typeof import('vitest').vi.fn>,
  fetch: null as unknown as ReturnType<typeof import('vitest').vi.fn>,
  env: {} as Record<string, string | undefined>,
}));

vi.mock('npm:@supabase/supabase-js@2', async () => {
  const { fakeSupabase } = await import('./testing');
  h.fake = fakeSupabase();
  return { createClient: () => h.fake.client };
});

vi.mock('npm:@anthropic-ai/sdk@0.70.1', async () => {
  const { vi: v } = await import('vitest');
  h.create = v.fn();
  return { default: class { messages = { create: (...a: unknown[]) => h.create(...a) }; } };
});

const quiet = vi.spyOn(console, 'log').mockImplementation(() => {});

beforeAll(async () => {
  vi.stubGlobal('Deno', {
    serve: (fn: (req: Request) => Promise<Response>) => { h.handler = fn; },
    env: { get: (k: string) => h.env[k] },
  });
  h.fetch = vi.fn();
  vi.stubGlobal('fetch', (...a: unknown[]) => h.fetch(...a));
  const fn = '../../../supabase/functions/write-blurb/index.ts';
  await import(/* @vite-ignore */ fn);
});

afterAll(() => { quiet.mockRestore(); vi.unstubAllGlobals(); });

beforeEach(() => {
  h.fake.reset();
  h.create.mockReset();
  h.fetch.mockReset();
  // Wikipedia has nothing, unless a test says otherwise.
  h.fetch.mockResolvedValue({ ok: false, json: async () => ({}) });
  h.env = { ANTHROPIC_API_KEY: 'sk-test', SUPABASE_URL: 'https://p.test', SUPABASE_SERVICE_ROLE_KEY: 'k' };
});

const call = (body: unknown, init: { method?: string; headers?: Record<string, string> } = {}) =>
  h.handler(new Request('https://p.test/functions/v1/write-blurb', {
    method: init.method ?? 'POST',
    headers: init.headers ?? { Authorization: 'Bearer jwt' },
    body: init.method && init.method !== 'POST' ? undefined : JSON.stringify(body),
  }));

const session = { data: { user: { id: 'u1', email: 'Reader@Crew.TEST' } }, error: null };
const editor = { data: { email: 'reader@crew.test' } };
const notEditor = { data: null };

const PARK = {
  slug: 'thuong-bac-park', name_en: 'Thuong Bac Park', name_vi: 'Công viên Thương Bạc', city_id: 'hue',
  address: 'Đường Trần Hưng Đạo, Phú Xuân, Huế, Vietnam', neighborhood_en: 'Phú Xuân', neighborhood_vi: 'Phú Xuân',
  categories: ['nature'], vibe_tags: ['outdoors', 'chill'], opening_hours: ['Monday: Open 24 hours'],
  website: null, primary_type: 'park', desc_vi: null, desc_en: null,
};
const HUE = { name_en: 'Hue', name_vi: 'Huế', short_en: 'Hue', short_vi: 'Huế' };
const WRITTEN = [
  { name_en: 'Tao Dan Park', categories: ['nature'], desc_vi: 'Thảm cỏ râm mát giữa Quận 1.', desc_en: 'Shaded lawns in D1.' },
  { name_en: 'A café', categories: ['cafes'], desc_vi: 'Quán', desc_en: 'Café' },
  { name_en: 'Half written', categories: ['nature'], desc_vi: 'Chỉ tiếng Việt', desc_en: null },
  { name_en: 'No kinds', categories: null, desc_vi: 'x', desc_en: 'y' },
  ...Array.from({ length: 7 }, (_, i) => ({ name_en: `Park ${i}`, categories: ['nature', 'views'], desc_vi: `vi ${i}`, desc_en: `en ${i}` })),
];

/** Signed in as an editor, the park found, its city, the desk's blurbs. */
const door = (place: unknown = PARK, written: unknown[] = WRITTEN) =>
  h.fake.replies(session, editor, { data: place, error: null }, { data: HUE, error: null }, { data: written, error: null });

const says = (json: unknown) => ({
  content: [{ type: 'text', text: JSON.stringify(json) }],
  usage: { input_tokens: 10, output_tokens: 5 },
});
const sent = () => h.create.mock.calls.at(-1)![0] as {
  model: string; max_tokens: number; system: string;
  output_config: { format: { schema: { required: string[] } } };
  messages: { role: string; content: string }[];
};
const prompt = () => sent().messages[0].content;

describe('the door', () => {
  it('answers the preflight, and refuses anything but POST', async () => {
    expect((await call(null, { method: 'OPTIONS' })).status).toBe(200);
    expect((await call(null, { method: 'GET' })).status).toBe(405);
  });

  it('refuses to run without the model key', async () => {
    h.env.ANTHROPIC_API_KEY = undefined;
    const res = await call({ slug: 'x' });
    expect(res.status).toBe(500);
    expect(h.create).not.toHaveBeenCalled();
  });

  it('is editors only: a signed-in reader is refused before anything is read', async () => {
    h.fake.replies(session, notEditor);
    const res = await call({ slug: 'thuong-bac-park' });
    expect(res.status).toBe(403);
    expect(h.fake.log.filter((a) => a.table === 'places')).toEqual([]);
    expect(h.create).not.toHaveBeenCalled();
  });

  it('opens to the write-blurb ops token, for a batch', async () => {
    h.fake.replies(
      { data: { token: 's3cret', expires_at: new Date(Date.now() + 60_000).toISOString() } },
      { data: PARK, error: null }, { data: HUE, error: null }, { data: [], error: null },
    );
    h.create.mockResolvedValue(says({ desc_vi: 'A', desc_en: 'B' }));
    const res = await call({ slug: 'thuong-bac-park' }, { headers: { 'x-ops-token': 's3cret' } });
    expect(res.status).toBe(200);
    expect(h.fake.log[0]).toMatchObject({ table: 'ops_tokens', filters: [['name', 'write-blurb']] });
  });
});

describe('what it refuses', () => {
  it('needs a slug', async () => {
    h.fake.replies(session, editor);
    expect((await call({})).status).toBe(400);
    h.fake.replies(session, editor);
    expect((await call({ slug: '  ' })).status).toBe(400);
  });

  it('says so for a slug nobody has', async () => {
    h.fake.replies(session, editor, { data: null, error: null });
    const res = await call({ slug: 'nowhere' });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'unknown place: nowhere' });
  });

  // Blanks only: the desk clears a blurb it means to replace, and then
  // this is a blank. A model is never the thing that overwrites a person.
  it('refuses a place that already has a blurb in either language', async () => {
    h.fake.replies(session, editor, { data: { ...PARK, desc_en: 'Written.' }, error: null });
    expect((await call({ slug: PARK.slug })).status).toBe(409);
    h.fake.replies(session, editor, { data: { ...PARK, desc_vi: ' Đã viết ' }, error: null });
    const res = await call({ slug: PARK.slug });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'has_blurb' });
    expect(h.create).not.toHaveBeenCalled();
  });
});

describe('the draft', () => {
  it('returns both languages trimmed, writes nothing, and names no source without an article', async () => {
    door();
    h.create.mockResolvedValue(says({ desc_vi: '  Bờ sông Hương, ghế đá dưới hàng cây. ', desc_en: ' Riverside benches under old trees.  ' }));
    const res = await call({ slug: PARK.slug });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      desc_vi: 'Bờ sông Hương, ghế đá dưới hàng cây.',
      desc_en: 'Riverside benches under old trees.',
      sources: [],
    });
    expect(h.fake.log.filter((a) => a.op !== 'select' && a.op !== 'auth')).toEqual([]);
  });

  it('asks Haiku for a two-field JSON answer under the house rules', async () => {
    door();
    h.create.mockResolvedValue(says({ desc_vi: 'A', desc_en: 'B' }));
    await call({ slug: PARK.slug });
    const req = sent();
    expect(req.model).toBe('claude-haiku-5-5');
    expect(req.output_config.format.schema.required).toEqual(['desc_vi', 'desc_en']);
    expect(req.system).toContain('No invented years');
    expect(req.system).toContain('never mention the rating');
  });

  it('hands the model the row’s facts and the desk’s blurbs of the same kinds, five at most', async () => {
    door();
    h.create.mockResolvedValue(says({ desc_vi: 'A', desc_en: 'B' }));
    await call({ slug: PARK.slug });
    const p = prompt();
    expect(p).toContain('Name: Công viên Thương Bạc / Thuong Bac Park');
    expect(p).toContain('City: Huế / Hue');
    expect(p).toContain('District: Phú Xuân');
    expect(p).toContain('Kinds: nature');
    expect(p).toContain('Hours: Monday: Open 24 hours');
    expect(p).toContain('Website: ?');
    // The park, not the café; both halves written; five, not eight.
    expect(p).toContain('- Tao Dan Park\n  vi: Thảm cỏ râm mát giữa Quận 1.\n  en: Shaded lawns in D1.');
    expect(p).not.toContain('A café');
    expect(p).not.toContain('Half written');
    expect(p).not.toContain('No kinds');
    expect(p).toContain('- Park 3');
    expect(p).not.toContain('- Park 4');
    expect(p).toContain('No article extract');
    // The desk's blurbs, read by source and published only.
    expect(h.fake.log.filter((a) => a.table === 'places')[1]).toMatchObject({
      filters: [['reviewer_source', 'editorial'], ['is_published', true]], limit: 40,
    });
  });

  it('fills the facts it does not have with a question mark rather than a guess', async () => {
    door({ ...PARK, city_id: null, neighborhood_vi: null, neighborhood_en: null, address: null, categories: null, vibe_tags: null, opening_hours: null, primary_type: null }, []);
    h.fake.queue.splice(3, 1, { data: null, error: null }); // no city row
    h.create.mockResolvedValue(says({ desc_vi: 'A', desc_en: 'B' }));
    await call({ slug: PARK.slug });
    const p = prompt();
    expect(p).toContain('City: ? / ');
    expect(p).toContain('District: ?');
    expect(p).toContain('Address: ?');
    expect(p).toContain('Kinds: ?');
    expect(p).toContain('Vibes: ?');
    expect(p).toContain('Google type: ?');
    expect(p).toContain('Hours: ?');
  });

  it('answers 502 when the model fails or gives no text', async () => {
    door();
    h.create.mockRejectedValue(new Error('overloaded'));
    const res = await call({ slug: PARK.slug });
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: 'overloaded' });
    door();
    h.create.mockResolvedValue({ content: [{ type: 'tool_use' }], usage: { input_tokens: 1, output_tokens: 1 } });
    expect((await call({ slug: PARK.slug })).status).toBe(502);
  });
});

describe('the article', () => {
  const page = (over: Record<string, unknown>) => ({
    ok: true,
    json: async () => ({ type: 'standard', extract: 'Công viên Thương Bạc nằm bên sông Hương ở Huế.', content_urls: { desktop: { page: 'https://vi.wikipedia.org/wiki/C%C3%B4ng_vi%C3%AAn_Th%C6%B0%C6%A1ng_B%E1%BA%A1c' } }, ...over }),
  });

  it('passes the Vietnamese lead on with its URL as the source, asking for the Vietnamese title first', async () => {
    door();
    h.fetch.mockResolvedValueOnce(page({}));
    h.create.mockResolvedValue(says({ desc_vi: 'A', desc_en: 'B' }));
    const res = await call({ slug: PARK.slug });
    expect((await res.json()).sources).toEqual(['https://vi.wikipedia.org/wiki/C%C3%B4ng_vi%C3%AAn_Th%C6%B0%C6%A1ng_B%E1%BA%A1c']);
    expect(h.fetch.mock.calls[0][0]).toBe('https://vi.wikipedia.org/api/rest_v1/page/summary/C%C3%B4ng_vi%C3%AAn_Th%C6%B0%C6%A1ng_B%E1%BA%A1c');
    expect(h.fetch).toHaveBeenCalledTimes(1);
    expect(prompt()).toContain('Wikipedia lead (https://vi.wikipedia.org/wiki/');
    expect(prompt()).toContain('nằm bên sông Hương ở Huế');
  });

  it('falls back to the English article, and builds the URL when the page carries none', async () => {
    door();
    h.fetch
      .mockResolvedValueOnce({ ok: false, json: async () => ({}) })
      .mockResolvedValueOnce(page({ extract: 'A riverside park in Hue, Vietnam.', content_urls: undefined }));
    h.create.mockResolvedValue(says({ desc_vi: 'A', desc_en: 'B' }));
    const res = await call({ slug: PARK.slug });
    expect((await res.json()).sources).toEqual(['https://en.wikipedia.org/wiki/Thuong%20Bac%20Park']);
    expect(h.fetch.mock.calls[1][0]).toBe('https://en.wikipedia.org/api/rest_v1/page/summary/Thuong_Bac_Park');
  });

  // "Lake Park" is in Milwaukee as well as Đà Lạt, and the summary
  // endpoint answers with the famous one. A lead that never names the
  // city is a lead about somewhere else.
  it('drops a lead that does not name the city, a disambiguation page, an empty lead, and a network failure', async () => {
    const tryIt = async (...answers: unknown[]) => {
      door();
      h.fetch.mockReset();
      for (const a of answers) h.fetch.mockResolvedValueOnce(a);
      h.fetch.mockResolvedValue({ ok: false, json: async () => ({}) });
      h.create.mockResolvedValue(says({ desc_vi: 'A', desc_en: 'B' }));
      const res = await call({ slug: PARK.slug });
      expect((await res.json()).sources).toEqual([]);
      expect(prompt()).toContain('No article extract');
    };
    await tryIt(page({ extract: 'Lake Park is a park in Milwaukee, Wisconsin.' }));
    await tryIt(page({ type: 'disambiguation' }));
    await tryIt(page({ extract: '   ' }));
    await tryIt(page({ extract: 42 }));
    h.fetch.mockReset();
    h.fetch.mockRejectedValue(new Error('offline'));
    door();
    h.create.mockResolvedValue(says({ desc_vi: 'A', desc_en: 'B' }));
    expect((await (await call({ slug: PARK.slug })).json()).sources).toEqual([]);
  });

  it('matches the city without marks, so "Da Lat" in an English lead counts for Đà Lạt', async () => {
    h.fake.replies(session, editor, { data: { ...PARK, city_id: 'dalat', name_en: 'Lake Park', name_vi: 'Lake Park' }, error: null },
      { data: { name_en: 'Da Lat', name_vi: 'Đà Lạt', short_en: null, short_vi: null }, error: null }, { data: [], error: null });
    h.fetch.mockResolvedValueOnce(page({ extract: 'Lake Park sits on Xuan Huong lake in Da Lat.' }));
    h.create.mockResolvedValue(says({ desc_vi: 'A', desc_en: 'B' }));
    const res = await call({ slug: PARK.slug });
    expect((await res.json()).sources).toHaveLength(1);
  });
});
