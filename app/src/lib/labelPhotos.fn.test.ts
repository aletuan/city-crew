// The `label-photos` Edge Function, as deployed, and the photo-label
// definitions it shares with the photo-labels skill.
//
// What it holds: the door (an editor or the ops token, nothing else);
// that the model is pointed only at photographs in our own bucket, by an
// address the function read itself; that a photograph already labelled is
// not paid for twice; that a measurement (`write: false`) writes nothing;
// that a refusal, a missing answer or a broken one fails that photograph
// and not the request; and that the skill's write script asks the same
// questions as the function. Loaded unchanged, with `Deno`, the Supabase
// client and the Anthropic SDK stood in for, as the sibling function tests
// do.

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import type { fakeSupabase } from './testing';
import { ATTRS, DEFINITIONS, KINDS, SCHEMA, VERSION, toSignals } from '../../../supabase/functions/_shared/photoLabels';

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
  const fn = '../../../supabase/functions/label-photos/index.ts';
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
  h.handler(new Request('https://p.test/functions/v1/label-photos', {
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
const photo = (id: string, stored = true) => ({
  id,
  photo_uri: `https://p.test/storage/v1/object/public/place-photos/x/${id}.jpg`,
  storage_path: stored ? `x/${id}.jpg` : null,
});

const ANSWER = {
  kind: 'interior', unsure: false, note: '',
  brand: 'yes', wide: 'yes', green: 'no', daylight: 'unknown', people: 'no', staged: 'no',
};
const says = (json: unknown, extra: Record<string, unknown> = {}) => ({
  content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: JSON.stringify(json) }],
  stop_reason: 'end_turn',
  usage: { input_tokens: 1500, output_tokens: 120 },
  ...extra,
});
const writes = () => h.fake.log.filter((a) => a.op === 'insert');

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

  it('opens to the label-photos ops token, for a measurement', async () => {
    h.fake.replies(
      { data: { token: 's3cret', expires_at: new Date(Date.now() + 60_000).toISOString() } },
      { data: [photo(A)], error: null },
    );
    h.beta.mockResolvedValue(says(ANSWER));
    const res = await call({ photo_ids: [A], write: false }, { headers: { 'x-ops-token': 's3cret' } });
    expect(res.status).toBe(200);
    expect(h.fake.log[0]).toMatchObject({ table: 'ops_tokens', filters: [['name', 'label-photos']] });
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

  it('takes only the models and efforts it was measured on', async () => {
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
});

describe('a measurement (write: false)', () => {
  it('labels every stored photograph, by its own address, and writes nothing', async () => {
    h.fake.replies(session, editor, { data: [photo(A), photo(B, false)], error: null });
    h.beta.mockResolvedValue(says(ANSWER));
    const res = await call({ photo_ids: [A, B, C], write: false });
    expect(res.status).toBe(200);
    const out = await res.json();
    expect(out).toEqual({
      model: 'claude-opus-5-5', effort: 'low', write: false,
      labels: [{
        id: A,
        signals: { v: 1, kind: 'interior', brand: true, wide: true, green: false, daylight: null, people: false, staged: false, by: 'fn', model: 'claude-opus-5-5' },
      }],
      failed: [], labelled: [], missing: [C], unstored: [B],
      usage: { input_tokens: 1500, output_tokens: 120 },
    });
    // No label row was read: a measurement asks again on purpose.
    expect(h.fake.log.filter((a) => a.table === 'photo_scores')).toEqual([]);
    expect(writes()).toEqual([]);
    expect(h.create).not.toHaveBeenCalled();
  });

  it('asks Opus with the shared definitions, the image by URL, and the refusal fallback', async () => {
    h.fake.replies(session, editor, { data: [photo(A)], error: null });
    h.beta.mockResolvedValue(says(ANSWER));
    await call({ photo_ids: [A], write: false, effort: 'medium' });
    const req = h.beta.mock.calls[0][0];
    expect(req).toMatchObject({
      model: 'claude-opus-5-5',
      system: DEFINITIONS,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: SCHEMA } },
    });
    expect(req.messages[0].content[0]).toEqual({ type: 'image', source: { type: 'url', url: photo(A).photo_uri } });
    expect(req.max_tokens).toBeGreaterThanOrEqual(4000);
  });

  // Haiku has no server-side fallback: it is asked on the plain endpoint,
  // and a request carrying `fallbacks` would be refused.
  it('asks Haiku without the fallback', async () => {
    h.fake.replies(session, editor, { data: [photo(A)], error: null });
    h.create.mockResolvedValue(says(ANSWER, { usage: undefined }));
    const res = await call({ photo_ids: [A], write: false, model: 'claude-haiku-5-5' });
    const out = await res.json();
    expect(out.labels[0].signals.model).toBe('claude-haiku-5-5');
    expect(out.usage).toEqual({ input_tokens: 0, output_tokens: 0 });
    const req = h.create.mock.calls[0][0];
    expect(req.model).toBe('claude-haiku-5-5');
    expect(req).not.toHaveProperty('fallbacks');
    expect(h.beta).not.toHaveBeenCalled();
  });

  it('fails one photograph, not the request, on a refusal, a missing answer, broken JSON or an error', async () => {
    h.fake.replies(session, editor, { data: [photo(A), photo(B), photo(C), photo(D)], error: null });
    h.beta.mockImplementation(async (req: { messages: { content: { source?: { url: string } }[] }[] }) => {
      const url = req.messages[0].content[0].source!.url;
      if (url.includes(A)) return { content: [], stop_reason: 'refusal', usage: { input_tokens: 10, output_tokens: 0 } };
      if (url.includes(B)) return { content: [{ type: 'thinking', thinking: '' }], stop_reason: 'max_tokens', usage: { input_tokens: 10, output_tokens: 4000 } };
      if (url.includes(C)) return { content: [{ type: 'text', text: '{"kind": "inter' }], stop_reason: 'end_turn', usage: { input_tokens: 10, output_tokens: 5 } };
      throw new Error('overloaded');
    });
    const res = await call({ photo_ids: [A, B, C, D], write: false });
    expect(res.status).toBe(200);
    const out = await res.json();
    expect(out.labels).toEqual([]);
    expect(out.failed.map((f: { id: string }) => f.id)).toEqual([A, B, C, D]);
    expect(out.failed[0].error).toBe('no answer (refusal)');
    expect(out.failed[1].error).toBe('no answer (max_tokens)');
    expect(out.failed[3].error).toBe('overloaded');
    expect(out.usage).toEqual({ input_tokens: 30, output_tokens: 4005 });
  });
});

describe('labelling (write, the default)', () => {
  it('skips a photograph already labelled at this version, and labels the rest', async () => {
    h.fake.replies(
      session, editor,
      { data: [photo(A), photo(B), photo(C), photo(D)], error: null },
      {
        data: [
          // Complete at this version: skipped.
          { photo_id: A, scorer_version: 1, signals: { v: 1, kind: 'food', brand: false, wide: false, green: false, daylight: null, people: false, staged: false } },
          // A key missing: asked again.
          { photo_id: B, scorer_version: 1, signals: { v: 1, kind: 'food' } },
          // An older version: asked again.
          { photo_id: C, scorer_version: 0, signals: { kind: 'food', brand: false, wide: false, green: false, daylight: null, people: false, staged: false } },
          // A row with no signals at all: asked again.
          { photo_id: D, scorer_version: 1, signals: null },
        ],
        error: null,
      },
    );
    h.beta.mockResolvedValue(says({ ...ANSWER, unsure: true, note: ' A covered gallery. ' }));
    const res = await call({ photo_ids: [A, B, C, D] });
    const out = await res.json();
    expect(out.labelled).toEqual([A]);
    expect(out.labels.map((l: { id: string }) => l.id)).toEqual([B, C, D]);
    expect(h.beta).toHaveBeenCalledTimes(3);
    expect(h.fake.log.find((a) => a.table === 'photo_scores' && a.op === 'select')).toMatchObject({
      filters: [['scorer', 'claude-labels'], ['photo_id', [A, B, C, D]]],
    });
    const [w] = writes();
    expect(w).toMatchObject({ table: 'photo_scores', upsert: true, onConflict: 'photo_id,scorer' });
    const rows = w.payload as { photo_id: string; scorer: string; scorer_version: number; signals: Record<string, unknown> }[];
    expect(rows.map((r) => r.photo_id)).toEqual([B, C, D]);
    expect(rows[0]).toMatchObject({ scorer: 'claude-labels', scorer_version: 1 });
    expect(rows[0].signals).toMatchObject({ unsure: true, note: 'A covered gallery.', by: 'fn' });
  });

  it('calls no model and writes nothing when every photograph is labelled', async () => {
    h.fake.replies(
      session, editor,
      { data: [photo(A)], error: null },
      { data: [{ photo_id: A, scorer_version: 2, signals: { kind: 'view', brand: false, wide: true, green: true, daylight: true, people: false, staged: false } }], error: null },
    );
    const out = await (await call({ photo_ids: [A] })).json();
    expect(out.labelled).toEqual([A]);
    expect(out.labels).toEqual([]);
    expect(h.beta).not.toHaveBeenCalled();
    expect(writes()).toEqual([]);
  });

  it('reads no labels when nothing it was given is stored', async () => {
    h.fake.replies(session, editor, { data: null, error: null });
    const out = await (await call({ photo_ids: [A] })).json();
    expect(out.missing).toEqual([A]);
    expect(h.fake.log.filter((a) => a.table === 'photo_scores')).toEqual([]);
  });

  it('fails the request when the write fails', async () => {
    h.fake.replies(session, editor, { data: [photo(A)], error: null }, { data: null, error: null }, { data: null, error: { message: 'denied' } });
    h.beta.mockResolvedValue(says(ANSWER));
    const res = await call({ photo_ids: [A] });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'denied' });
  });
});

describe('the definitions', () => {
  it('turn an answer into the row the skill writes', () => {
    expect(toSignals({ ...ANSWER, kind: 'view', daylight: 'yes' } as never, { by: 'skill' })).toEqual({
      v: VERSION, kind: 'view', brand: true, wide: true, green: false, daylight: true, people: false, staged: false, by: 'skill',
    });
  });

  it('ask for every kind and attribute, each answer required', () => {
    expect(SCHEMA.properties.kind.enum).toEqual([...KINDS]);
    expect(SCHEMA.required).toEqual(['kind', 'unsure', ...ATTRS, 'note']);
    for (const k of KINDS) expect(DEFINITIONS).toContain(`- ${k}:`);
    for (const a of ATTRS) expect(DEFINITIONS).toContain(`- ${a}:`);
  });

  // The skill writes its rows with write.py: if its kinds, attributes or
  // version drifted from these, the two halves of one scorer would be
  // answering different questions.
  it('are the ones the skill writes with', () => {
    const py = readFileSync(new URL('../../../.claude/skills/photo-labels/write.py', import.meta.url), 'utf8');
    const tuple = (name: string) => [...py.match(new RegExp(`^${name} = \\((.*)\\)$`, 'm'))![1].matchAll(/'(\w+)'/g)].map((m) => m[1]);
    expect(tuple('KINDS')).toEqual([...KINDS]);
    expect(tuple('ATTRS')).toEqual([...ATTRS]);
    expect(Number(py.match(/^VERSION = (\d+)$/m)![1])).toBe(VERSION);
  });
});
