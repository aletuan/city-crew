// The `prune-checkin-photos` Edge Function, as deployed.
//
// It deletes files with the service role, and a file it takes is gone.
// So, first: who may call it; that a path not of the bucket's own shape
// is never taken, whatever the database hands over; that a row written
// since keeps its file; that a dry run takes nothing. Then the count, the
// bucket's size, and the error paths.
//
// Loaded unchanged, as `deleteAccount.fn.test.ts` loads its function.

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { fakeSupabase } from './testing';

const h = vi.hoisted(() => ({
  fake: null as unknown as ReturnType<typeof fakeSupabase>,
  handler: null as unknown as (req: Request) => Promise<Response>,
}));

vi.mock('npm:@supabase/supabase-js@2', async () => {
  const { fakeSupabase } = await import('./testing');
  h.fake = fakeSupabase();
  return { createClient: () => h.fake.client };
});

beforeAll(async () => {
  vi.stubGlobal('Deno', {
    serve: (fn: (req: Request) => Promise<Response>) => { h.handler = fn; },
    env: { get: (k: string) => ({ SUPABASE_URL: 'https://p.test', SUPABASE_SERVICE_ROLE_KEY: 'service' } as Record<string, string>)[k] },
  });
  const fn = '../../../supabase/functions/prune-checkin-photos/index.ts';
  await import(/* @vite-ignore */ fn);
});

beforeEach(() => h.fake.reset());

const TOKEN = { data: { token: 'ops', expires_at: '2999-01-01T00:00:00Z' }, error: null };
const A = '11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222/33333333-3333-4333-8333-333333333333.jpg';
const B = '11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222/44444444-4444-4444-8444-444444444444.jpg';
const USAGE = { data: [{ files: 10, bytes: 1500000, accounts: 2 }], error: null };
const call = (body?: unknown, init: { method?: string; ops?: string; raw?: string } = {}) =>
  h.handler(new Request('https://p.test/functions/v1/prune-checkin-photos', {
    method: init.method ?? 'POST',
    headers: init.ops ? { 'x-ops-token': init.ops } : {},
    body: init.method === 'OPTIONS' || init.method === 'GET' ? undefined : (init.raw ?? (body === undefined ? undefined : JSON.stringify(body))),
  }));
const storage = () => h.fake.log.filter((a) => a.op === 'storage');

describe('prune-checkin-photos', () => {
  it('answers the preflight, with the ops header allowed, and refuses anything but POST', async () => {
    const pre = await call(undefined, { method: 'OPTIONS' });
    expect(pre.status).toBe(200);
    expect(pre.headers.get('Access-Control-Allow-Headers')).toContain('x-ops-token');
    expect((await call(undefined, { method: 'GET' })).status).toBe(405);
    expect(h.fake.log).toEqual([]);
  });

  it('refuses a caller with no door, and touches nothing', async () => {
    h.fake.replies({ data: null, error: null });
    const res = await call({}, { ops: 'wrong' });
    expect(res.status).toBe(403);
    expect(h.fake.log[0]).toMatchObject({ table: 'ops_tokens', filters: [['name', 'prune-checkin-photos']] });
    expect(h.fake.log.some((a) => a.op === 'rpc' || a.op === 'storage')).toBe(false);
  });

  it('takes the orphans the database names, asked about again, and reports the bucket', async () => {
    h.fake.replies(TOKEN, { data: [{ name: A }, { name: B }], error: null }, { data: null, error: null }, { data: null, error: null }, { data: {}, error: null }, USAGE);
    const res = await call({}, { ops: 'ops' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ removed: 2, kept: [], usage: { files: 10, bytes: 1500000, accounts: 2 }, dry: false });
    expect(h.fake.log[1]).toMatchObject({ op: 'rpc', fn: 'checkin_photo_orphans', payload: { p_limit: 100 } });
    expect(h.fake.log[2]).toMatchObject({ table: 'checkin_photos', filters: [['path', A]] });
    expect(storage()).toEqual([expect.objectContaining({ table: 'checkin-photos', fn: 'remove', payload: [A, B] })]);
  });

  it('keeps a file a row has come to name since the database looked', async () => {
    h.fake.replies(TOKEN, { data: [{ name: A }, { name: B }], error: null }, { data: { id: 'x' }, error: null }, { data: null, error: null }, { data: {}, error: null }, USAGE);
    const out = await (await call({}, { ops: 'ops' })).json();
    expect(out.kept).toEqual([{ path: A, why: 'row' }]);
    expect(storage()[0].payload).toEqual([B]);
  });

  it('never takes a path not of the bucket’s own shape, whatever it is handed', async () => {
    const odd = ['../avatars/u/avatar.jpg', 'u1/avatar.jpg', `${A}.png`, `/${A}`];
    h.fake.replies(TOKEN, { data: odd.map((name) => ({ name })), error: null }, USAGE);
    const out = await (await call({}, { ops: 'ops' })).json();
    expect(out.kept).toEqual(odd.map((path) => ({ path, why: 'shape' })));
    expect(out.removed).toBe(0);
    expect(storage()).toEqual([]);
  });

  it('takes nothing on a dry run, and says what it would take', async () => {
    h.fake.replies(TOKEN, { data: [{ name: A }], error: null }, { data: null, error: null }, USAGE);
    const out = await (await call({ dry: true, limit: 5 }, { ops: 'ops' })).json();
    expect(out).toMatchObject({ removed: 0, would_remove: [A], dry: true });
    expect(h.fake.log[1].payload).toEqual({ p_limit: 5 });
    expect(storage()).toEqual([]);
  });

  it('runs with no body, and with nothing to take asks Storage nothing', async () => {
    h.fake.replies(TOKEN, { data: null, error: null }, { data: null, error: null });
    const out = await (await call(undefined, { ops: 'ops', raw: '' })).json();
    expect(out).toEqual({ removed: 0, kept: [], usage: null, dry: false });
    expect(storage()).toEqual([]);
  });

  it('says so when a step fails, and removes nothing after a failed check', async () => {
    h.fake.replies(TOKEN, { data: null, error: { message: 'find failed' } });
    expect((await call({}, { ops: 'ops' })).status).toBe(500);

    h.fake.reset();
    h.fake.replies(TOKEN, { data: [{ name: A }], error: null }, { data: null, error: { message: 'check failed' } });
    expect((await call({}, { ops: 'ops' })).status).toBe(500);
    expect(storage()).toEqual([]);

    h.fake.reset();
    h.fake.replies(TOKEN, { data: [{ name: A }], error: null }, { data: null, error: null }, { data: null, error: { message: 'storage down' } });
    const res = await call({}, { ops: 'ops' });
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ error: 'storage down', would_remove: [A] });

    h.fake.reset();
    h.fake.replies(TOKEN, { data: [], error: null }, { data: null, error: { message: 'usage failed' } });
    expect((await call({}, { ops: 'ops' })).status).toBe(500);
  });
});
