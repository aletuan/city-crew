// The `plan-assist` Edge Function, as deployed.
//
// The only part of the planner that talks to a model, and its whole design
// is a promise about what the model cannot do: name a place that is not in
// the plan, or a category the app has no chip for. The schema asks for
// that and the code checks it again. The second check is what a reader is
// actually protected by — a schema is a request — and it had no test.
//
// What is pinned here is that fence, the input it refuses, and the two
// failure shapes: `narrate` degrades to an empty 200 the app can fall back
// from, `parse` says `ok: false` so the screen can say it could not read
// the sentence. Nothing here judges the prose.
//
// Loaded unchanged, as the other `.fn.test.ts` files load theirs: `Deno`
// captures the handler, the `npm:` Supabase client is `lib/testing`'s, and
// the `npm:` Anthropic SDK is a class whose `messages.create` a test sets.

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { fakeSupabase } from './testing';

const h = vi.hoisted(() => ({
  fake: null as unknown as ReturnType<typeof fakeSupabase>,
  handler: null as unknown as (req: Request) => Promise<Response>,
  create: null as unknown as ReturnType<typeof import('vitest').vi.fn>,
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
  return {
    default: class { messages = { create: (...a: unknown[]) => h.create(...a) }; },
  };
});

const quiet = vi.spyOn(console, 'log').mockImplementation(() => {});

beforeAll(async () => {
  vi.stubGlobal('Deno', {
    serve: (fn: (req: Request) => Promise<Response>) => { h.handler = fn; },
    env: { get: (k: string) => h.env[k] },
  });
  const fn = '../../../supabase/functions/plan-assist/index.ts';
  await import(/* @vite-ignore */ fn);
});

afterAll(() => { quiet.mockRestore(); });

beforeEach(() => {
  h.fake.reset();
  h.create.mockReset();
  h.env = { ANTHROPIC_API_KEY: 'sk-test', SUPABASE_URL: 'https://p.test', SUPABASE_SERVICE_ROLE_KEY: 'k' };
  // Signed in, unless a test says otherwise.
  h.fake.replies({ data: { user: { id: 'u1' } } });
});

const call = (body: unknown, init: { method?: string } = {}) =>
  h.handler(new Request('https://p.test/functions/v1/plan-assist', {
    method: init.method ?? 'POST',
    headers: { Authorization: 'Bearer jwt' },
    body: init.method && init.method !== 'POST' ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  }));

/** A model answer carrying `json` as its one text block. */
const says = (json: unknown, over: Record<string, unknown> = {}) => ({
  stop_reason: 'end_turn',
  content: [{ type: 'text', text: JSON.stringify(json) }],
  usage: { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0 },
  ...over,
});

/** The request the handler last sent the model. */
const sent = () => h.create.mock.calls.at(-1)![0] as {
  model: string; max_tokens: number;
  output_config: { format: { schema: { properties: Record<string, any> } } };
  messages: { content: string }[];
};
const opts = () => h.create.mock.calls.at(-1)![1] as { timeout: number };

describe('the door', () => {
  it('answers the preflight and refuses anything but POST', async () => {
    h.fake.reset();
    expect((await call(null, { method: 'OPTIONS' })).status).toBe(200);
    expect((await call({}, { method: 'GET' })).status).toBe(405);
    expect(h.create).not.toHaveBeenCalled();
  });

  it('says so plainly when the model key is not configured', async () => {
    h.env.ANTHROPIC_API_KEY = undefined;
    const res = await call({ action: 'narrate', stops: [{ slug: 'a' }] });
    expect(res.status).toBe(500);
    expect(h.create).not.toHaveBeenCalled();
  });

  it('spends nothing on a caller without a session', async () => {
    h.fake.reset();
    h.fake.replies({ data: { user: null } });
    const res = await call({ action: 'narrate', stops: [{ slug: 'a' }] });
    expect(res.status).toBe(401);
    expect(h.create).not.toHaveBeenCalled();
  });

  it('refuses an action it does not know', async () => {
    const res = await call({ action: 'plan' });
    expect(res.status).toBe(400);
    expect(h.create).not.toHaveBeenCalled();
  });
});

describe('narrate', () => {
  const stop = (slug: string) => ({ slug, name: slug.toUpperCase(), categories: ['cafe'], neighborhood: 'Old Quarter', arrive: '19:00' });

  it('needs stops, and stops need slugs', async () => {
    expect((await call({ action: 'narrate', stops: [] })).status).toBe(400);
    h.fake.replies({ data: { user: { id: 'u1' } } });
    expect((await call({ action: 'narrate', stops: [{ name: 'no slug' }] })).status).toBe(400);
    expect(h.create).not.toHaveBeenCalled();
  });

  it('caps the plan it will describe, and lets the model name only those places', async () => {
    h.create.mockResolvedValue(says({ title: 'T', stops: [] }));
    const nine = Array.from({ length: 9 }, (_, i) => stop(`p${i}`));
    await call({ action: 'narrate', stops: nine, lang: 'vi' });
    const allowed = sent().output_config.format.schema.properties.stops.items.properties.slug.enum;
    expect(allowed).toEqual(['p0', 'p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7']);
    expect(sent().messages[0].content).not.toContain('p8');
    expect(sent().messages[0].content).toContain('Language: Vietnamese');
  });

  it('drops a place the model made up, and a line with nothing to say, but keeps the rest', async () => {
    h.create.mockResolvedValue(says({
      title: '  An evening in the Old Quarter ',
      stops: [
        { slug: 'cong', why: 'Coconut coffee on the corner.' },
        { slug: 'invented-bar', why: 'Does not exist.' },
        { slug: 'bun-cha', why: '   ' },
      ],
    }));
    const res = await call({ action: 'narrate', stops: [stop('cong'), stop('bun-cha')] });
    expect(await res.json()).toEqual({
      title: 'An evening in the Old Quarter',
      stops: [{ slug: 'cong', why: 'Coconut coffee on the corner.' }],
    });
  });

  it('bounds every call: the model, the output budget and the clock', async () => {
    h.create.mockResolvedValue(says({ title: 'T', stops: [] }));
    await call({ action: 'narrate', stops: [stop('a')] });
    expect(sent().max_tokens).toBe(2000);
    expect(opts().timeout).toBe(12_000);
  });

  it('answers a refusal with an empty plan the app can fall back from', async () => {
    h.create.mockResolvedValue(says({ title: 'x', stops: [{ slug: 'a', why: 'y' }] }, { stop_reason: 'refusal' }));
    const res = await call({ action: 'narrate', stops: [stop('a')] });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ title: null, stops: [] });
  });

  it('answers a model failure with the same empty plan, not an error', async () => {
    h.create.mockRejectedValue(new Error('overloaded'));
    const res = await call({ action: 'narrate', stops: [stop('a')] });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ title: null, stops: [] });
  });

  it('answers a body that is not JSON with the empty plan too', async () => {
    const res = await call('{oops');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ title: null, stops: [] });
  });
});

describe('parse', () => {
  const ask = (over: Record<string, unknown> = {}) => ({
    action: 'parse', text: 'coffee with my sister tomorrow evening in Tay Ho',
    today: '2026-09-10', categories: ['cafe', 'food', 'nightlife'], districts: ['Tay Ho', 'Hoan Kiem'],
    ...over,
  });

  it('refuses what it cannot build a question from', async () => {
    expect((await call(ask({ text: '   ' }))).status).toBe(400);
    h.fake.replies({ data: { user: { id: 'u1' } } });
    expect((await call(ask({ categories: [] }))).status).toBe(400);
    h.fake.replies({ data: { user: { id: 'u1' } } });
    expect((await call(ask({ today: '10/09/2026' }))).status).toBe(400);
    expect(h.create).not.toHaveBeenCalled();
  });

  it('offers the model only the client’s own words, and tells it the weekday', async () => {
    h.create.mockResolvedValue(says({ company: 'unknown', categories: [], district: 'unknown', date: '', when: 'unknown' }));
    await call(ask());
    const props = sent().output_config.format.schema.properties;
    expect(props.categories.items.enum).toEqual(['cafe', 'food', 'nightlife']);
    expect(props.district.enum).toEqual(['Tay Ho', 'Hoan Kiem', 'unknown']);
    expect(props.company.enum).toEqual(['solo', 'couple', 'friends', 'family', 'other', 'unknown']);
    // 10 September 2026 is a Thursday — computed from the date sent, on
    // UTC, so the server's own clock cannot shift the reader's day.
    expect(sent().messages[0].content).toContain('Today is 2026-09-10, a Thursday.');
  });

  it('cuts a long sentence before it costs anything', async () => {
    h.create.mockResolvedValue(says({ company: 'unknown', categories: [], district: 'unknown', date: '', when: 'unknown' }));
    await call(ask({ text: 'x'.repeat(5000) }));
    const content = sent().messages[0].content;
    expect(content).toContain(`The sentence: ${'x'.repeat(600)}`);
    expect(content).not.toContain('x'.repeat(601));
  });

  it('keeps only answers the app can use, in the order its own chips use', async () => {
    h.create.mockResolvedValue(says({
      company: 'family',
      categories: ['nightlife', 'jazz', 'cafe'],
      district: 'Tay Ho',
      date: '2026-09-11',
      when: 'evening',
    }));
    const res = await call(ask());
    expect(await res.json()).toEqual({
      ok: true, company: 'family', categories: ['cafe', 'nightlife'],
      district: 'Tay Ho', date: '2026-09-11', when: 'evening',
    });
  });

  it('turns every answer it cannot trust into a blank, not a guess', async () => {
    h.create.mockResolvedValue(says({
      company: 'unknown', categories: ['spa'], district: 'Da Lat', date: 'tomorrow', when: 'night',
    }));
    const res = await call(ask());
    expect(await res.json()).toEqual({
      ok: true, company: null, categories: [], district: null, date: null, when: null,
    });
  });

  it('says it could not read the sentence when the model refuses or fails', async () => {
    h.create.mockResolvedValueOnce(says({}, { stop_reason: 'refusal' }));
    expect(await (await call(ask())).json()).toEqual({ ok: false });

    h.fake.replies({ data: { user: { id: 'u1' } } });
    h.create.mockRejectedValueOnce(new Error('timeout'));
    expect(await (await call(ask())).json()).toEqual({ ok: false });

    h.fake.replies({ data: { user: { id: 'u1' } } });
    h.create.mockResolvedValueOnce({ ...says({}), content: [{ type: 'text', text: 'not json' }] });
    expect(await (await call(ask())).json()).toEqual({ ok: false });
  });
});
