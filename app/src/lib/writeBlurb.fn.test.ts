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
  id: 'pid-1', slug: 'thuong-bac-park', name_en: 'Thuong Bac Park', name_vi: 'Công viên Thương Bạc', city_id: 'hue',
  address: 'Đường Trần Hưng Đạo, Phú Xuân, Huế, Vietnam', neighborhood_en: 'Phú Xuân', neighborhood_vi: 'Phú Xuân',
  categories: ['nature'], vibe_tags: ['outdoors', 'chill'], opening_hours: ['Monday: Open 24 hours'],
  website: null, primary_type: 'park', desc_vi: null, desc_en: null, desc_ja: null, i18n: {},
};
const HUE = { name_en: 'Hue', name_vi: 'Huế', short_en: 'Hue', short_vi: 'Huế' };
const WRITTEN = [
  { name_en: 'Tao Dan Park', categories: ['nature'], desc_vi: 'Thảm cỏ râm mát giữa Quận 1.', desc_en: 'Shaded lawns in D1.', i18n: { ja: { desc: '1区の木陰の芝生。' } } },
  // A Japanese draft nobody has read is no example of Japanese; a column
  // the object does not carry is not read at all.
  { name_en: 'Machine Park', categories: ['nature'], desc_vi: 'Máy', desc_en: 'Machine', i18n: { ja: { desc: '機械。', machine: true } } },
  { name_en: 'Column Park', categories: ['nature'], desc_vi: 'Cột', desc_en: 'Column', desc_ja: '列。', i18n: {} },
  { name_en: 'A café', categories: ['cafes'], desc_vi: 'Quán', desc_en: 'Café' },
  { name_en: 'Half written', categories: ['nature'], desc_vi: 'Chỉ tiếng Việt', desc_en: null },
  { name_en: 'No kinds', categories: null, desc_vi: 'x', desc_en: 'y' },
  ...Array.from({ length: 7 }, (_, i) => ({ name_en: `Park ${i}`, categories: ['nature', 'views'], desc_vi: `vi ${i}`, desc_en: `en ${i}` })),
];

const SHOTS = [
  { photo_uri: 'https://cdn/park/cover.jpg', storage_path: 'thuong-bac-park/cover.jpg' },
  { photo_uri: 'https://cdn/park/2.jpg', storage_path: 'thuong-bac-park/2.jpg' },
  // Google's short-lived link, never copied: left out, since a dead link
  // fails the whole call.
  { photo_uri: 'https://lh3.googleusercontent.com/old', storage_path: null },
];

/** Signed in as an editor, the park found, its city, the desk's blurbs, its photographs. */
const door = (place: unknown = PARK, written: unknown[] = WRITTEN, shots: unknown[] = SHOTS) =>
  h.fake.replies(session, editor, { data: place, error: null }, { data: HUE, error: null }, { data: written, error: null }, { data: shots, error: null });

const says = (json: unknown) => ({
  content: [{ type: 'text', text: JSON.stringify(json) }],
  stop_reason: 'end_turn',
  usage: { input_tokens: 10, output_tokens: 5 },
});
type Block = { type: 'text'; text: string } | { type: 'image'; source: { type: 'url'; url: string } };
const sent = () => h.create.mock.calls.at(-1)![0] as {
  model: string; max_tokens: number; system: string;
  output_config: { format: { schema: { required: string[] } } };
  messages: { role: string; content: Block[] }[];
};
/** The words the model was handed, with the frames between them left out. */
const prompt = () => sent().messages[0].content.filter((b): b is Extract<Block, { type: 'text' }> => b.type === 'text').map((b) => b.text).join('\n');
const frames = () => sent().messages[0].content.filter((b): b is Extract<Block, { type: 'image' }> => b.type === 'image').map((b) => b.source.url);

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
      { data: PARK, error: null }, { data: HUE, error: null }, { data: [], error: null }, { data: [], error: null },
    );
    h.create.mockResolvedValue(says({ desc_vi: 'A', desc_en: 'B', desc_ja: 'C' }));
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
    h.create.mockResolvedValue(says({ desc_vi: '  Bờ sông Hương, ghế đá dưới hàng cây. ', desc_en: ' Riverside benches under old trees.  ', desc_ja: ' フォン川のほとり、木陰のベンチ。 ' }));
    const res = await call({ slug: PARK.slug });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      desc_vi: 'Bờ sông Hương, ghế đá dưới hàng cây.',
      desc_en: 'Riverside benches under old trees.',
      desc_ja: 'フォン川のほとり、木陰のベンチ。',
      sources: [],
      photos: 2,
    });
    expect(h.fake.log.filter((a) => a.op !== 'select' && a.op !== 'auth')).toEqual([]);
  });

  it('asks Haiku for a two-field JSON answer under the house rules', async () => {
    door();
    h.create.mockResolvedValue(says({ desc_vi: 'A', desc_en: 'B', desc_ja: 'C' }));
    await call({ slug: PARK.slug });
    const req = sent();
    expect(req.model).toBe('claude-haiku-5-5');
    expect(req.output_config.format.schema.required).toEqual(['desc_vi', 'desc_en', 'desc_ja']);
    expect(req.system).toContain('No invented years');
    expect(req.system).toContain('never mention the rating');
    expect(req.system).toContain('photographs are the best material');
  });

  // The frames are the material that matters: the first cut had none and
  // wrote two parks that read as any park anywhere. Cover first, every
  // visible frame in the catalog's own Storage, none of Google's links.
  it('shows the model every photograph in Storage, the cover first, and none of Google’s links', async () => {
    door();
    h.create.mockResolvedValue(says({ desc_vi: 'A', desc_en: 'B', desc_ja: 'C' }));
    await call({ slug: PARK.slug });
    expect(frames()).toEqual(['https://cdn/park/cover.jpg', 'https://cdn/park/2.jpg']);
    const content = sent().messages[0].content;
    expect(content[0]).toEqual({ type: 'text', text: '2 photograph(s) of the place, the cover first:' });
    expect(content[1].type).toBe('image');
    expect(content.at(-1)!.type).toBe('text');
    expect(prompt()).not.toContain('No photographs either');
    const asked = h.fake.log.find((a) => a.table === 'place_photos')!;
    expect(asked).toMatchObject({ filters: [['place_id', 'pid-1'], ['is_hidden', false]], limit: 20 });
    expect(asked.orders).toEqual([['is_cover', { ascending: false }], ['sort_order']]);
  });

  it('says so when there are no photographs, and sends no frame', async () => {
    door(PARK, WRITTEN, []);
    h.create.mockResolvedValue(says({ desc_vi: 'A', desc_en: 'B', desc_ja: 'C' }));
    const res = await call({ slug: PARK.slug });
    expect(frames()).toEqual([]);
    expect(sent().messages[0].content[0].type).toBe('text');
    expect(prompt()).toContain('No photographs either. Write only from the facts above');
    expect((await res.json()).photos).toBe(0);
  });

  it('hands the model the row’s facts and the desk’s blurbs of the same kinds, five at most', async () => {
    door();
    h.create.mockResolvedValue(says({ desc_vi: 'A', desc_en: 'B', desc_ja: 'C' }));
    await call({ slug: PARK.slug });
    const p = prompt();
    expect(p).toContain('Name: Công viên Thương Bạc / Thuong Bac Park');
    expect(p).toContain('City: Huế / Hue');
    expect(p).toContain('District: Phú Xuân');
    expect(p).toContain('Kinds: nature');
    expect(p).toContain('Hours: Monday: Open 24 hours');
    expect(p).toContain('Website: ?');
    // The park, not the café; both halves written; five, not ten.
    expect(p).toContain('- Tao Dan Park\n  vi: Thảm cỏ râm mát giữa Quận 1.\n  en: Shaded lawns in D1.\n  ja: 1区の木陰の芝生。');
    // An example with no Japanese a person wrote shows two lines: not a
    // "ja: null", not the machine draft, not the mirrored column.
    expect(p).toContain('- Machine Park\n  vi: Máy\n  en: Machine\n');
    expect(p).toContain('- Column Park\n  vi: Cột\n  en: Column\n');
    expect(p).not.toContain('機械。');
    expect(p).not.toContain('列。');
    expect(p).not.toContain('ja: null');
    expect(sent().system).toContain('desc_ja is Japanese written for a Japanese reader');
    expect(p).not.toContain('A café');
    expect(p).not.toContain('Half written');
    expect(p).not.toContain('No kinds');
    expect(p).toContain('- Park 1');
    expect(p).not.toContain('- Park 2');
    expect(p).toContain('No article extract');
    // The desk's blurbs, read by source and published only, of the same
    // kinds, in a stable order — the database narrows, not the function.
    expect(h.fake.log.filter((a) => a.table === 'places')[1]).toMatchObject({
      filters: [['reviewer_source', 'editorial'], ['is_published', true], ['categories&&', ['nature']]],
      order: ['slug'], limit: 40,
    });
  });

  it('fills the facts it does not have with a question mark rather than a guess', async () => {
    door({ ...PARK, city_id: null, neighborhood_vi: null, neighborhood_en: null, address: null, categories: null, vibe_tags: null, opening_hours: null, primary_type: null }, []);
    h.fake.queue.splice(3, 1, { data: null, error: null }); // no city row
    h.create.mockResolvedValue(says({ desc_vi: 'A', desc_en: 'B', desc_ja: 'C' }));
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
    let res = await call({ slug: PARK.slug });
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: 'overloaded' });
    // A reply with no text block, and one cut off mid-string: both are
    // what the budget running out looks like, and the answer names it.
    door();
    h.create.mockResolvedValue({ content: [{ type: 'thinking' }], stop_reason: 'max_tokens', usage: { input_tokens: 1, output_tokens: 1200 } });
    res = await call({ slug: PARK.slug });
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: 'model gave no text (max_tokens)' });
    door();
    h.create.mockResolvedValue({ content: [{ type: 'text', text: '{"desc_vi": "Bờ sô' }], stop_reason: 'max_tokens', usage: { input_tokens: 1, output_tokens: 1200 } });
    res = await call({ slug: PARK.slug });
    expect(res.status).toBe(502);
    expect((await res.json()).error).toMatch(/JSON.*\(max_tokens\)$/);
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
    h.create.mockResolvedValue(says({ desc_vi: 'A', desc_en: 'B', desc_ja: 'C' }));
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
    h.create.mockResolvedValue(says({ desc_vi: 'A', desc_en: 'B', desc_ja: 'C' }));
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
      h.create.mockResolvedValue(says({ desc_vi: 'A', desc_en: 'B', desc_ja: 'C' }));
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
    h.create.mockResolvedValue(says({ desc_vi: 'A', desc_en: 'B', desc_ja: 'C' }));
    expect((await (await call({ slug: PARK.slug })).json()).sources).toEqual([]);
  });

  it('matches the city without marks, so "Da Lat" in an English lead counts for Đà Lạt', async () => {
    h.fake.replies(session, editor, { data: { ...PARK, city_id: 'dalat', name_en: 'Lake Park', name_vi: 'Lake Park' }, error: null },
      { data: { name_en: 'Da Lat', name_vi: 'Đà Lạt', short_en: null, short_vi: null }, error: null }, { data: [], error: null }, { data: [], error: null });
    h.fetch.mockResolvedValueOnce(page({ extract: 'Lake Park sits on Xuan Huong lake in Da Lat.' }));
    h.create.mockResolvedValue(says({ desc_vi: 'A', desc_en: 'B', desc_ja: 'C' }));
    const res = await call({ slug: PARK.slug });
    expect((await res.json()).sources).toHaveLength(1);
  });
});

// The mirror image: a blurb the desk already has, asked for in Japanese.
// Refuses the two things the full mode accepts and accepts the one it
// refuses; no article, examples with a JA line only, one field back.
describe('the ja mode', () => {
  const WRITTEN_PARK = { ...PARK, desc_vi: 'Ghế đá bờ sông.', desc_en: 'Riverside benches.' };

  it('refuses an unknown mode, a place with no blurb, and one that already has Japanese through either door', async () => {
    h.fake.replies(session, editor);
    expect((await call({ slug: PARK.slug, mode: 'ko' })).status).toBe(400);
    h.fake.replies(session, editor, { data: PARK, error: null });
    let res = await call({ slug: PARK.slug, mode: 'ja' });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'no_blurb' });
    h.fake.replies(session, editor, { data: { ...WRITTEN_PARK, desc_ja: ' 古い。 ' }, error: null });
    res = await call({ slug: PARK.slug, mode: 'ja' });
    expect(await res.json()).toEqual({ error: 'has_ja' });
    h.fake.replies(session, editor, { data: { ...WRITTEN_PARK, i18n: { ja: { desc: '物体。' } } }, error: null });
    res = await call({ slug: PARK.slug, mode: 'ja' });
    expect(await res.json()).toEqual({ error: 'has_ja' });
    expect(h.create).not.toHaveBeenCalled();
  });

  it('hands the model the blurb and nothing to add to it: no frames, no article, desc_ja alone', async () => {
    door(WRITTEN_PARK);
    h.create.mockResolvedValue(says({ desc_ja: ' 川沿いのベンチ。 ' }));
    const res = await call({ slug: PARK.slug, mode: 'ja' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ desc_ja: '川沿いのベンチ。' });
    expect(h.fetch).not.toHaveBeenCalled();
    const req = sent();
    expect(req.output_config.format.schema.required).toEqual(['desc_ja']);
    const p = prompt();
    // The English, alone: it is what a Japanese reader sees until the
    // Japanese exists, so it is what the Japanese must say.
    expect(p).toContain('en: Riverside benches.');
    expect(p).not.toContain('Ghế đá bờ sông.');
    expect(p).toContain('for a Japanese reader');
    expect(p).not.toContain('No article extract');
    // Its own instructions: nothing about photographs or facts to draw on.
    expect(sent().system).toContain('the only material');
    expect(sent().system).not.toContain('photographs');
    expect(sent().system).not.toContain('facts');
    // The gallery is not even read: the two frames the full mode would
    // send are what the first ja drafts elaborated from.
    expect(frames()).toEqual([]);
    expect(p).not.toContain('photograph');
    expect(h.fake.log.find((a) => a.table === 'place_photos')).toBeUndefined();
    // Nor the hours, the address or the website: ten of the first batch's
    // drafts put the opening hours into a blurb that never had them.
    expect(p).toContain('Name: Công viên Thương Bạc / Thuong Bac Park');
    expect(p).toContain('City: ');
    expect(p).not.toContain('Hours:');
    expect(p).not.toContain('Address:');
    expect(p).not.toContain('Website:');
    expect(p).not.toContain('District:');
    // Only an example that carries Japanese a person wrote can show the
    // register, and it is shown as the pair asked for: English, Japanese.
    expect(p).toContain('- Tao Dan Park\n  en: Shaded lawns in D1.\n  ja: 1区の木陰の芝生。');
    expect(p).not.toContain('Thảm cỏ râm mát');
    expect(p).not.toContain('Machine Park');
    expect(p).not.toContain('Column Park');
    expect(p).not.toContain('- Park 0');
    expect(h.fake.log.filter((a) => a.op !== 'select' && a.op !== 'auth')).toEqual([]);
  });

  it('falls back to the Vietnamese only when there is no English', async () => {
    door({ ...WRITTEN_PARK, desc_en: '  ' });
    h.create.mockResolvedValue(says({ desc_ja: 'x' }));
    await call({ slug: PARK.slug, mode: 'ja' });
    expect(prompt()).toContain('The blurb, as the desk wrote it:\nvi: Ghế đá bờ sông.');
    expect(prompt()).not.toContain('en: Riverside benches.');
  });
});

describe('the zh mode', () => {
  const WRITTEN_PARK = { ...PARK, desc_vi: 'Ghế đá bờ sông.', desc_en: 'Riverside benches by the Hương.' };
  const ZH_WRITTEN = [
    ...WRITTEN,
    { name_en: 'Lakeside', categories: ['nature'], desc_vi: 'Bờ hồ.', desc_en: 'By the lake.', i18n: { zh: { desc: '湖边。' } } },
    { name_en: 'Machine Lake', categories: ['nature'], desc_vi: 'Máy', desc_en: 'Machine', i18n: { zh: { desc: '机器。', machine: true } } },
  ];

  // Chinese lives in the object only: there is no column to check, and
  // the Japanese column says nothing about it.
  it('refuses a place that already has Chinese, and only through the object', async () => {
    h.fake.replies(session, editor, { data: { ...WRITTEN_PARK, i18n: { zh: { desc: '已有。' } } }, error: null });
    const res = await call({ slug: PARK.slug, mode: 'zh' });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'has_zh' });
    door({ ...WRITTEN_PARK, desc_ja: '日本語。' });
    h.create.mockResolvedValue(says({ desc_zh: '河边的长椅。' }));
    expect((await call({ slug: PARK.slug, mode: 'zh' })).status).toBe(200);
  });

  it('translates the English for a Chinese reader, place names kept, desc_zh alone', async () => {
    door(WRITTEN_PARK, ZH_WRITTEN);
    h.create.mockResolvedValue(says({ desc_zh: ' Sông Hương 边的长椅。 ' }));
    const res = await call({ slug: PARK.slug, mode: 'zh' });
    expect(await res.json()).toEqual({ desc_zh: 'Sông Hương 边的长椅。' });
    expect(sent().output_config.format.schema.required).toEqual(['desc_zh']);
    expect(sent().system).toContain('Simplified Chinese');
    expect(sent().system).toContain('Never translate or transliterate one');
    expect(sent().system).not.toContain('Japanese');
    const p = prompt();
    expect(p).toContain('en: Riverside benches by the Hương.');
    expect(p).toContain('Write desc_zh: this blurb for a Chinese reader');
    // A person's Chinese is an example; a draft nobody read is not, and
    // Japanese is no example of Chinese.
    expect(p).toContain('- Lakeside\n  en: By the lake.\n  zh: 湖边。');
    expect(p).not.toContain('Machine Lake');
    expect(p).not.toContain('Tao Dan Park');
    expect(frames()).toEqual([]);
    expect(p).not.toContain('Hours:');
  });

  // Before the desk has written any Chinese there is nothing to show, and
  // a heading over an empty list would read as a cue.
  it('says nothing about examples when there are none', async () => {
    door(WRITTEN_PARK);
    h.create.mockResolvedValue(says({ desc_zh: 'x' }));
    await call({ slug: PARK.slug, mode: 'zh' });
    expect(prompt()).not.toContain('Examples of the voice');
    expect(prompt().startsWith('The place:')).toBe(true);
  });
});

describe('the zh-Hant mode', () => {
  const WRITTEN_PARK = { ...PARK, desc_vi: 'Ghế đá bờ sông.', desc_en: 'Riverside benches by the Hương.' };

  // Its own key, `zh-Hant`: the Simplified beside it is not a Traditional
  // blurb, and does not refuse one.
  it('refuses a place that already has Traditional, and only that', async () => {
    h.fake.replies(session, editor, { data: { ...WRITTEN_PARK, i18n: { 'zh-Hant': { desc: '已有。' } } }, error: null });
    const res = await call({ slug: PARK.slug, mode: 'zh-Hant' });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'has_zh-Hant' });
    door({ ...WRITTEN_PARK, i18n: { zh: { desc: '简体。' } } });
    h.create.mockResolvedValue(says({ 'desc_zh-Hant': '河邊的長椅。' }));
    expect((await call({ slug: PARK.slug, mode: 'zh-Hant' })).status).toBe(200);
  });

  it('translates the English for a reader in Taiwan, in Taiwan\'s words', async () => {
    door(WRITTEN_PARK);
    h.create.mockResolvedValue(says({ 'desc_zh-Hant': ' Sông Hương 邊的長椅。 ' }));
    const res = await call({ slug: PARK.slug, mode: 'zh-Hant' });
    expect(await res.json()).toEqual({ 'desc_zh-Hant': 'Sông Hương 邊的長椅。' });
    expect(sent().output_config.format.schema.required).toEqual(['desc_zh-Hant']);
    expect(sent().system).toContain('Traditional Chinese as written in Taiwan');
    expect(sent().system).toContain('影片 not 視頻');
    expect(sent().system).toContain('Never translate or transliterate one');
    expect(sent().system).not.toContain('Simplified');
    expect(prompt()).toContain('Write desc_zh-Hant: this blurb for a reader in Taiwan');
    expect(frames()).toEqual([]);
  });

  it('refuses a script it does not know', async () => {
    h.fake.replies(session, editor);
    const res = await call({ slug: PARK.slug, mode: 'zh-hant' });
    expect(res.status).toBe(400);
  });
});

// The owner's rule for Chinese, checked: a draft that lost a Latin name
// the blurb carries is asked for once more, told which; a second miss is
// returned with the names listed (`_shared/latinNames.ts`).
describe('the Latin names in a Chinese draft', () => {
  const NAMED = { ...PARK, desc_vi: 'Ghế đá bờ sông.', desc_en: 'Benches on Nguyễn Huệ, a walk from Hoàn Kiếm Lake.' };
  const last = () => h.create.mock.calls.at(-1)![0] as { messages: { role: string; content: unknown }[] };

  it('takes a draft that kept every name, at the first ask', async () => {
    door(NAMED);
    h.create.mockResolvedValue(says({ desc_zh: 'Nguyễn Huệ 上的长椅，离 Hoàn Kiếm Lake 不远。' }));
    expect(await (await call({ slug: PARK.slug, mode: 'zh' })).json())
      .toEqual({ desc_zh: 'Nguyễn Huệ 上的长椅，离 Hoàn Kiếm Lake 不远。' });
    expect(h.create).toHaveBeenCalledTimes(1);
  });

  it('asks again, naming what was lost, and takes the second when it keeps them', async () => {
    door(NAMED);
    h.create
      .mockResolvedValueOnce(says({ desc_zh: '阮惠街上的长椅，离还剑湖不远。' }))
      .mockResolvedValueOnce(says({ desc_zh: 'Nguyễn Huệ 上的长椅，离 Hoàn Kiếm Lake 不远。' }));
    expect(await (await call({ slug: PARK.slug, mode: 'zh' })).json())
      .toEqual({ desc_zh: 'Nguyễn Huệ 上的长椅，离 Hoàn Kiếm Lake 不远。' });
    expect(h.create).toHaveBeenCalledTimes(2);
    const turns = last().messages;
    expect(turns).toHaveLength(3);
    expect(turns[1]).toEqual({ role: 'assistant', content: JSON.stringify({ desc_zh: '阮惠街上的长椅，离还剑湖不远。' }) });
    expect(turns[2].content).toContain('Nguyễn Huệ, Hoàn Kiếm Lake');
  });

  it('returns a second miss with the names it still lost', async () => {
    door(NAMED);
    h.create
      .mockResolvedValueOnce(says({ 'desc_zh-Hant': '阮惠街上的長椅。' }))
      .mockResolvedValueOnce(says({ 'desc_zh-Hant': 'Nguyễn Huệ 上的長椅，離還劍湖不遠。' }));
    expect(await (await call({ slug: PARK.slug, mode: 'zh-Hant' })).json()).toEqual({
      'desc_zh-Hant': 'Nguyễn Huệ 上的長椅，離還劍湖不遠。', names_lost: ['Hoàn Kiếm Lake'],
    });
  });

  // A second answer that cannot be read leaves the first standing, listed.
  it('keeps the first draft when the second is cut off', async () => {
    door(NAMED);
    h.create
      .mockResolvedValueOnce(says({ desc_zh: '阮惠街上的长椅。' }))
      .mockResolvedValueOnce({ content: [{ type: 'text', text: '{"desc_zh": "cut' }], stop_reason: 'max_tokens', usage: { input_tokens: 1, output_tokens: 1 } });
    expect(await (await call({ slug: PARK.slug, mode: 'zh' })).json())
      .toEqual({ desc_zh: '阮惠街上的长椅。', names_lost: ['Nguyễn Huệ', 'Hoàn Kiếm Lake'] });
  });

  it('keeps the first draft when the second has no text', async () => {
    door(NAMED);
    h.create
      .mockResolvedValueOnce(says({ desc_zh: '阮惠街上的长椅。' }))
      .mockResolvedValueOnce({ content: [], stop_reason: 'refusal', usage: { input_tokens: 1, output_tokens: 0 } });
    expect((await (await call({ slug: PARK.slug, mode: 'zh' })).json()).desc_zh).toBe('阮惠街上的长椅。');
  });

  it('keeps the first draft when the second is empty', async () => {
    door(NAMED);
    h.create
      .mockResolvedValueOnce(says({ desc_zh: '阮惠街上的长椅。' }))
      .mockResolvedValueOnce(says({ desc_zh: '' }));
    expect((await (await call({ slug: PARK.slug, mode: 'zh' })).json()).desc_zh).toBe('阮惠街上的长椅。');
  });

  it('reads the Vietnamese when the blurb has no English', async () => {
    door({ ...PARK, desc_vi: 'Ghế đá trên Nguyễn Huệ.', desc_en: null });
    h.create.mockResolvedValue(says({ desc_zh: 'Nguyễn Huệ 上的长椅。' }));
    expect(await (await call({ slug: PARK.slug, mode: 'zh' })).json()).toEqual({ desc_zh: 'Nguyễn Huệ 上的长椅。' });
    expect(h.create).toHaveBeenCalledTimes(1);
  });

  // Japanese has the same rule and is not checked yet; see the header.
  it('leaves the Japanese unchecked', async () => {
    door(NAMED);
    h.create.mockResolvedValue(says({ desc_ja: 'グエンフエ通りのベンチ。' }));
    expect(await (await call({ slug: PARK.slug, mode: 'ja' })).json()).toEqual({ desc_ja: 'グエンフエ通りのベンチ。' });
    expect(h.create).toHaveBeenCalledTimes(1);
  });
});
