// The `rate-photos` Edge Function, as deployed, and the round 4 criteria
// it sends.
//
// What it holds: the door (an editor or its own ops token); that the
// model sees only photographs in our bucket, by an address the function
// read itself; that the kind it is rated as is the labels' and only a sure
// food, interior or exterior one; that each kind is asked with its own
// criteria; that it writes nothing; and that a refusal, a missing answer
// or a broken one fails that photograph and not the request. Loaded
// unchanged, as labelPhotos.fn.test.ts loads its sibling.

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { fakeSupabase } from './testing';
import { CRITERIA, KINDS, SCHEMA, VERSION, instructions, isBeautyKind } from '../../../supabase/functions/_shared/photoBeauty';

const h = vi.hoisted(() => ({
  fake: null as unknown as ReturnType<typeof fakeSupabase>,
  handler: null as unknown as (req: Request) => Promise<Response>,
  create: null as unknown as ReturnType<typeof import('vitest').vi.fn>,
  beta: null as unknown as ReturnType<typeof import('vitest').vi.fn>,
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
  h.beta = v.fn();
  return {
    default: class {
      messages = { create: (...a: unknown[]) => h.create(...a) };
      beta = { messages: { create: (...a: unknown[]) => h.beta(...a) } };
    },
  };
});

const quiet = vi.spyOn(console, 'log').mockImplementation(() => {});

beforeAll(async () => {
  vi.stubGlobal('Deno', {
    serve: (fn: (req: Request) => Promise<Response>) => { h.handler = fn; },
    env: { get: (k: string) => h.env[k] },
  });
  const fn = '../../../supabase/functions/rate-photos/index.ts';
  await import(/* @vite-ignore */ fn);
});

afterAll(() => { quiet.mockRestore(); vi.unstubAllGlobals(); });

beforeEach(() => {
  h.fake.reset();
  h.create.mockReset();
  h.beta.mockReset();
  h.env = { ANTHROPIC_API_KEY: 'sk-test', SUPABASE_URL: 'https://p.test', SUPABASE_SERVICE_ROLE_KEY: 'k' };
});

const call = (body: unknown, init: { method?: string; headers?: Record<string, string> } = {}) =>
  h.handler(new Request('https://p.test/functions/v1/rate-photos', {
    method: init.method ?? 'POST',
    headers: init.headers ?? { Authorization: 'Bearer jwt' },
    body: init.method && init.method !== 'POST' ? undefined : JSON.stringify(body),
  }));

const session = { data: { user: { id: 'u1', email: 'Desk@Crew.TEST' } }, error: null };
const editor = { data: { email: 'desk@crew.test' } };
const notEditor = { data: null };

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const C = '33333333-3333-4333-8333-333333333333';
const D = '44444444-4444-4444-8444-444444444444';
const E = '55555555-5555-4555-8555-555555555555';
const F = '66666666-6666-4666-8666-666666666666';
const photo = (id: string, stored = true) => ({
  id,
  photo_uri: `https://p.test/storage/v1/object/public/place-photos/x/${id}.jpg`,
  storage_path: stored ? `x/${id}.jpg` : null,
});
const label = (photo_id: string, kind: string, unsure = false) => ({ photo_id, signals: { kind, ...(unsure ? { unsure } : {}) } });

const says = (json: unknown, extra: Record<string, unknown> = {}) => ({
  content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: JSON.stringify(json) }],
  stop_reason: 'end_turn',
  usage: { input_tokens: 1400, output_tokens: 60 },
  ...extra,
});
const url = (req: { messages: { content: { source?: { url: string } }[] }[] }) => req.messages[0].content[0].source!.url;

describe('the door', () => {
  it('answers the preflight, and refuses anything but POST', async () => {
    expect((await call(null, { method: 'OPTIONS' })).status).toBe(200);
    expect((await call(null, { method: 'GET' })).status).toBe(405);
  });

  it('refuses to run without the model key', async () => {
    h.env.ANTHROPIC_API_KEY = undefined;
    expect((await call({ photo_ids: [A] })).status).toBe(500);
    expect(h.fake.log).toEqual([]);
  });

  it('is editors only: a signed-in reader is refused before anything is read', async () => {
    h.fake.replies(session, notEditor);
    expect((await call({ photo_ids: [A] })).status).toBe(403);
    expect(h.fake.log.filter((a) => a.table === 'place_photos')).toEqual([]);
  });

  it('opens to its own ops token, not label-photos\'', async () => {
    h.fake.replies(
      { data: { token: 's3cret', expires_at: new Date(Date.now() + 60_000).toISOString() } },
      { data: [photo(A)], error: null },
      { data: [label(A, 'food')], error: null },
    );
    h.create.mockResolvedValue(says({ score: 7, why: 'Sharp.' }));
    const res = await call({ photo_ids: [A] }, { headers: { 'x-ops-token': 's3cret' } });
    expect(res.status).toBe(200);
    expect(h.fake.log[0]).toMatchObject({ table: 'ops_tokens', filters: [['name', 'rate-photos']] });
  });
});

describe('what it refuses', () => {
  it.each([
    ['no list', {}],
    ['an empty list', { photo_ids: [] }],
    ['a list that is not one', { photo_ids: A }],
    ['more than a request holds', { photo_ids: Array(25).fill(A) }],
    ['something that is not an id', { photo_ids: [A, 'https://evil.test/x.jpg'] }],
    ['a number', { photo_ids: [7] }],
  ])('needs photograph ids: %s', async (_, body) => {
    h.fake.replies(session, editor);
    const res = await call(body);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('photo_ids');
  });

  it('takes only the models and efforts it names', async () => {
    h.fake.replies(session, editor);
    expect((await call({ photo_ids: [A], model: 'claude-opus-4-8' })).status).toBe(400);
    h.fake.replies(session, editor);
    expect((await call({ photo_ids: [A], effort: 'max' })).status).toBe(400);
    expect(h.create).not.toHaveBeenCalled();
    expect(h.beta).not.toHaveBeenCalled();
  });

  it('fails the request when the photographs cannot be read', async () => {
    h.fake.replies(session, editor, { data: null, error: { message: 'boom' } });
    const res = await call({ photo_ids: [A] });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'boom' });
  });

  it('fails the request when the labels cannot be read', async () => {
    h.fake.replies(session, editor, { data: [photo(A)], error: null }, { data: null, error: { message: 'no labels' } });
    const res = await call({ photo_ids: [A] });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'no labels' });
    expect(h.create).not.toHaveBeenCalled();
  });
});

describe('a rating', () => {
  it('rates each stored photograph as the kind its label is sure of, and writes nothing', async () => {
    h.fake.replies(
      session, editor,
      { data: [photo(A), photo(B), photo(C), photo(D), photo(E), photo(F, false)], error: null },
      {
        data: [
          label(A, 'interior'),
          label(B, 'food'),
          // Unsure: not rated.
          label(C, 'exterior', true),
          // A kind with no criteria: not rated.
          label(D, 'view'),
          // E has no label at all.
        ],
        error: null,
      },
    );
    h.create.mockImplementation(async (req: never) => says(url(req).includes(A) ? { score: 8, why: ' Deep, straight room. ' } : { score: 4, why: 'Harsh shadow.' }));
    const res = await call({ photo_ids: [A, B, C, D, E, F, '77777777-7777-4777-8777-777777777777'] });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      v: VERSION, model: 'claude-haiku-5-5', effort: 'low',
      scores: [
        { id: A, kind: 'interior', score: 8, why: 'Deep, straight room.' },
        { id: B, kind: 'food', score: 4, why: 'Harsh shadow.' },
      ],
      failed: [], missing: ['77777777-7777-4777-8777-777777777777'], unstored: [F], unkinded: [C, D, E],
      usage: { input_tokens: 2800, output_tokens: 120 },
    });
    // The kind is read from the labels, for the stored photographs only.
    expect(h.fake.log.find((a) => a.table === 'photo_scores')).toMatchObject({
      op: 'select', filters: [['scorer', 'claude-labels'], ['photo_id', [A, B, C, D, E]]],
    });
    expect(h.fake.log.filter((a) => ['insert', 'update', 'delete'].includes(a.op))).toEqual([]);
  });

  it('asks each photograph alone, with its own kind\'s criteria, by its own address', async () => {
    h.fake.replies(session, editor, { data: [photo(A), photo(B)], error: null }, { data: [label(A, 'food'), label(B, 'exterior')], error: null });
    h.create.mockResolvedValue(says({ score: 6, why: '' }, { usage: undefined }));
    const out = await (await call({ photo_ids: [A, B] })).json();
    expect(out.usage).toEqual({ input_tokens: 0, output_tokens: 0 });
    expect(h.create).toHaveBeenCalledTimes(2);
    const byUrl = Object.fromEntries(h.create.mock.calls.map(([req]) => [url(req), req]));
    expect(byUrl[photo(A).photo_uri].system).toBe(instructions('food'));
    expect(byUrl[photo(B).photo_uri].system).toBe(instructions('exterior'));
    const req = byUrl[photo(A).photo_uri];
    expect(req.messages[0].content).toHaveLength(2);
    expect(req.output_config).toEqual({ effort: 'low', format: { type: 'json_schema', schema: SCHEMA } });
    expect(req).not.toHaveProperty('fallbacks');
    expect(h.beta).not.toHaveBeenCalled();
  });

  it('asks Opus with the refusal fallback, at the effort named', async () => {
    h.fake.replies(session, editor, { data: [photo(A)], error: null }, { data: [label(A, 'interior')], error: null });
    h.beta.mockResolvedValue(says({ score: 9, why: 'Everything.' }));
    const out = await (await call({ photo_ids: [A], model: 'claude-opus-5-5', effort: 'medium' })).json();
    expect(out).toMatchObject({ model: 'claude-opus-5-5', effort: 'medium', scores: [{ id: A, score: 9 }] });
    expect(h.beta.mock.calls[0][0]).toMatchObject({
      model: 'claude-opus-5-5',
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium' },
    });
    expect(h.create).not.toHaveBeenCalled();
  });

  it('reads no labels and calls no model when nothing it was given is stored', async () => {
    h.fake.replies(session, editor, { data: null, error: null });
    const out = await (await call({ photo_ids: [A] })).json();
    expect(out).toMatchObject({ scores: [], missing: [A], unkinded: [] });
    expect(h.fake.log.filter((a) => a.table === 'photo_scores')).toEqual([]);
    expect(h.create).not.toHaveBeenCalled();
  });

  it('reads an empty label answer as no kinds', async () => {
    h.fake.replies(session, editor, { data: [photo(A)], error: null }, { data: null, error: null });
    const out = await (await call({ photo_ids: [A] })).json();
    expect(out).toMatchObject({ scores: [], unkinded: [A] });
  });

  it('fails one photograph, not the request, on a refusal, a missing answer, broken JSON or an error', async () => {
    h.fake.replies(
      session, editor,
      { data: [photo(A), photo(B), photo(C), photo(D)], error: null },
      { data: [label(A, 'food'), label(B, 'food'), label(C, 'food'), { photo_id: D, signals: { kind: 'food', unsure: false } }], error: null },
    );
    h.create.mockImplementation(async (req: never) => {
      const u = url(req);
      if (u.includes(A)) return { content: [], stop_reason: 'refusal', usage: { input_tokens: 10, output_tokens: 0 } };
      if (u.includes(B)) return { content: [{ type: 'thinking', thinking: '' }], stop_reason: 'max_tokens', usage: { input_tokens: 10, output_tokens: 4000 } };
      if (u.includes(C)) return { content: [{ type: 'text', text: '{"score": 7' }], stop_reason: 'end_turn', usage: { input_tokens: 10, output_tokens: 5 } };
      throw new Error('overloaded');
    });
    const res = await call({ photo_ids: [A, B, C, D] });
    expect(res.status).toBe(200);
    const out = await res.json();
    expect(out.scores).toEqual([]);
    expect(out.failed.map((f: { id: string }) => f.id)).toEqual([A, B, C, D]);
    expect(out.failed[0].error).toBe('no answer (refusal)');
    expect(out.failed[1].error).toBe('no answer (max_tokens)');
    expect(out.failed[3].error).toBe('overloaded');
    expect(out.usage).toEqual({ input_tokens: 30, output_tokens: 4005 });
  });

  it('a label row with no signals is no kind', async () => {
    h.fake.replies(session, editor, { data: [photo(A)], error: null }, { data: [{ photo_id: A, signals: null }], error: null });
    const out = await (await call({ photo_ids: [A] })).json();
    expect(out.unkinded).toEqual([A]);
  });
});

describe('the criteria', () => {
  it('are the three kinds a cover is drawn from, each with the owner\'s five points', () => {
    expect([...KINDS]).toEqual(['food', 'interior', 'exterior']);
    for (const k of KINDS) expect(CRITERIA[k].points).toHaveLength(5);
    expect(isBeautyKind('interior')).toBe(true);
    expect(isBeautyKind('view')).toBe(false);
    expect(isBeautyKind(undefined)).toBe(false);
  });

  it('give each kind its own points and nobody else\'s, beside the common four', () => {
    for (const k of KINDS) {
      const text = instructions(k);
      for (const p of CRITERIA[k].points) expect(text).toContain(`- ${p}`);
      for (const other of KINDS.filter((o) => o !== k)) {
        for (const p of CRITERIA[other].points) expect(text).not.toContain(p);
      }
      expect(text).toContain('- No text or watermark laid over the photograph.');
    }
  });

  // A bar at night is settled by the criteria as approved (18 Oct 2026):
  // warm lamps are good light, for a room and for a front.
  it('do not mark down a room or a front lit at night', () => {
    expect(instructions('interior')).toContain('warm lamps used with intent');
    expect(instructions('exterior')).toContain('attractive lighting in the evening');
  });

  it('ask a whole number from 1 to 10 and a reason, nothing else', () => {
    expect(SCHEMA.properties.score.enum).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(SCHEMA.required).toEqual(['score', 'why']);
  });
});
