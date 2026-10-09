// The `prune-photos` Edge Function, as deployed.
//
// It deletes files from a public bucket with the service role, and a file
// it takes cannot be put back — no row keeps a copy, and the bucket has no
// versioning. So the tests that matter are the ones that keep it from
// taking too much: who may call it at all; that `cities/` — the heroes,
// which two naive counts on 6 Oct mistook for orphans — is refused even
// when the list names it; that a row written after the SQL's select keeps
// its file; and that a dry run removes nothing. The count and the error
// paths come after.
//
// Loaded unchanged, as `deleteAccount.fn.test.ts` loads its function:
// `Deno` captures the handler and the environment, and the `npm:` client is
// `lib/testing`'s — with `like` added, below, because the re-check asks it.

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { fakeSupabase, Reply } from './testing';

const h = vi.hoisted(() => ({
  fake: null as unknown as ReturnType<typeof fakeSupabase>,
  handler: null as unknown as (req: Request) => Promise<Response>,
  env: {} as Record<string, string | undefined>,
  made: [] as unknown[][],
}));

vi.mock('npm:@supabase/supabase-js@2', async () => {
  const { fakeSupabase } = await import('./testing');
  h.fake = fakeSupabase();
  // `like` is the re-check's `photo_uri like '%/place-photos/<path>'`, and
  // nothing in the app asks it, so the shared fake has no such verb. Added
  // here, as `fetchPlace.fn.test.ts` adds it, recorded with `~~` —
  // Postgres's own marker — so the suffix the function matches on stays
  // assertable without widening every other test's fake.
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
  return { createClient: (...a: unknown[]) => { h.made.push(a); return client; } };
});

beforeAll(async () => {
  vi.stubGlobal('Deno', {
    serve: (fn: (req: Request) => Promise<Response>) => { h.handler = fn; },
    env: { get: (k: string) => h.env[k] },
  });
  const fn = '../../../supabase/functions/prune-photos/index.ts';
  await import(/* @vite-ignore */ fn);
});

beforeEach(() => {
  h.fake.reset();
  h.made.length = 0;
  h.env = { SUPABASE_URL: 'https://p.test', SUPABASE_SERVICE_ROLE_KEY: 'service' };
});

type Init = { method?: string; token?: string; ops?: string };
const call = (body?: unknown, init: Init = {}) => {
  const headers: Record<string, string> = {};
  if (init.token) headers.Authorization = `Bearer ${init.token}`;
  if (init.ops) headers['x-ops-token'] = init.ops;
  return h.handler(new Request('https://p.test/functions/v1/prune-photos', {
    method: init.method ?? 'POST',
    headers,
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  }));
};

// The two doors `_shared/gate.ts` opens. The ops token is how `run.sql`
// calls; the editor is the desk.
const LATER = new Date(Date.now() + 3_600_000).toISOString();
const opsRow = (token = 'tok', expires_at = LATER): Reply => ({ data: { token, expires_at }, error: null });
const viaOps = (body: unknown) => { h.fake.queue.unshift(opsRow()); return call(body, { ops: 'tok' }); };

const none: Reply = { data: [], error: null };
const one: Reply = { data: [{ id: 1 }], error: null };
/** The three re-check replies for one path, in the order the function
 *  builds its `Promise.all`: storage_path, photo_uri, hero_photo_path. */
const free = (): Reply[] => [none, none, none];

const removes = () => h.fake.log.filter((a) => a.op === 'storage' && a.fn === 'remove');
const rechecks = () => h.fake.log.filter((a) => a.table === 'place_photos' || a.table === 'cities');

describe('who may call it', () => {
  it('answers the preflight and refuses anything but POST, asking nothing', async () => {
    const pre = await call(undefined, { method: 'OPTIONS' });
    expect(pre.status).toBe(200);
    expect(pre.headers.get('Access-Control-Allow-Headers')).toContain('x-ops-token');
    expect((await call(undefined, { method: 'GET' })).status).toBe(405);
    expect(h.fake.log).toEqual([]);
  });

  it('acts with the service role from the environment', async () => {
    h.fake.replies(opsRow(), ...free(), { data: [], error: null });
    await call({ paths: ['a/1.jpg'] }, { ops: 'tok' });
    expect(h.made[0]).toEqual(['https://p.test', 'service', { auth: { persistSession: false } }]);
  });

  it('lets the database in with the live token named for this job', async () => {
    h.fake.replies(opsRow(), ...free(), { data: [], error: null });
    const res = await call({ paths: ['a/1.jpg'] }, { ops: 'tok' });
    expect(res.status).toBe(200);
    expect(h.fake.log[0]).toMatchObject({ table: 'ops_tokens', filters: [['name', 'prune-photos']], maybe: true });
  });

  // Each of these must stop before the first re-check and, above all,
  // before Storage: a 403 that still removed would pass a status check.
  it.each([
    ['a token that does not match', opsRow('other')],
    ['a token that has expired', opsRow('tok', new Date(Date.now() - 1000).toISOString())],
    ['no token row at all', { data: null, error: null } as Reply],
  ])('refuses %s and removes nothing', async (_, row) => {
    h.fake.replies(row, ...free(), { data: [], error: null });
    const res = await call({ paths: ['a/1.jpg'] }, { ops: 'tok' });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'not allowed' });
    expect(rechecks()).toEqual([]);
    expect(removes()).toEqual([]);
  });

  it('lets an editor in, looked up by the lower-cased email', async () => {
    h.fake.replies({ data: { user: { email: 'Desk@Crew.TEST' } } }, { data: { email: 'desk@crew.test' } },
      ...free(), { data: [], error: null });
    const res = await call({ paths: ['a/1.jpg'] }, { token: 'jwt' });
    expect(res.status).toBe(200);
    expect(h.fake.log[0]).toMatchObject({ op: 'auth', fn: 'getUser', payload: 'jwt' });
    expect(h.fake.log[1]).toMatchObject({ table: 'editors', filters: [['email', 'desk@crew.test']] });
    expect(removes()).toHaveLength(1);
  });

  it('refuses a signed-in reader who is not on the list', async () => {
    h.fake.replies({ data: { user: { email: 'reader@crew.test' } } }, { data: null }, ...free());
    const res = await call({ paths: ['a/1.jpg'] }, { token: 'jwt' });
    expect(res.status).toBe(403);
    expect(removes()).toEqual([]);
  });

  it('refuses a caller with neither door, without asking the editors list', async () => {
    h.fake.replies({ data: { user: null } }, ...free());
    const res = await call({ paths: ['a/1.jpg'] });
    expect(res.status).toBe(403);
    expect(h.fake.log[0]).toMatchObject({ fn: 'getUser', payload: '' });
    expect(h.fake.log.filter((a) => a.table === 'editors')).toEqual([]);
    expect(removes()).toEqual([]);
  });
});

describe('what it will be asked to remove', () => {
  it.each([
    ['no body', undefined],
    ['a body that is not JSON', '{paths:'],
    ['no paths', {}],
    ['paths that are not a list', { paths: 'a/1.jpg' }],
    ['an empty list', { paths: [] }],
    ['a list with no strings in it', { paths: [1, null, { p: 'a/1.jpg' }] }],
  ])('answers 400 to %s, before any re-check', async (_, body) => {
    const res = await viaOps(body);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'paths required' });
    expect(rechecks()).toEqual([]);
    expect(removes()).toEqual([]);
  });

  it('drops what is not a string and acts on the rest', async () => {
    h.fake.replies(...free(), { data: [], error: null });
    const res = await viaOps({ paths: [7, 'a/1.jpg', null] });
    expect(await res.json()).toMatchObject({ removed: 1 });
    expect(removes()[0].payload).toEqual(['a/1.jpg']);
  });

  // Fifty is the cap the request's time was sized to; `run.sql` sends
  // forty. Fifty-one is refused whole, not trimmed — a trimmed list would
  // answer `removed` for a run the caller thinks covered every path.
  it('takes fifty and refuses fifty-one whole', async () => {
    const paths = (n: number) => Array.from({ length: n }, (_, i) => `a/${i}.jpg`);
    const big = await viaOps({ paths: paths(51) });
    expect(big.status).toBe(400);
    expect(await big.json()).toEqual({ error: 'at most 50 paths' });
    expect(rechecks()).toEqual([]);

    h.fake.reset();
    h.fake.replies(...paths(50).flatMap(free), { data: [], error: null });
    const ok = await viaOps({ paths: paths(50) });
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ removed: 50 });
  });
});

describe('what it will not take', () => {
  // The heroes. `cities.hero_photo_path` would keep them on the re-check
  // too, but only while the row says so; the folder rule holds even for a
  // hero whose row is being edited. So the re-check is answered "free"
  // here, and the file must still stay.
  it('refuses the cities/ folder outright, without asking the tables', async () => {
    h.fake.replies(...free(), { data: [], error: null });
    const res = await viaOps({ paths: ['cities/hanoi.jpg'] });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ removed: 0, kept: [{ path: 'cities/hanoi.jpg', why: 'refused' }], dry: false });
    expect(rechecks()).toEqual([]);
    expect(removes()).toEqual([]);
  });

  it.each([
    ['an absolute path', '/hanoi/1.jpg'],
    ['a climb out of the folder', 'hanoi/../cities/hanoi.jpg'],
  ])('refuses %s the same way', async (_, path) => {
    const res = await viaOps({ paths: [path] });
    expect((await res.json()).kept).toEqual([{ path, why: 'refused' }]);
    expect(removes()).toEqual([]);
  });

  // The race the re-check exists for: the SQL picked the path, and before
  // the call landed a row was written that names it. Each of the three
  // ways a row can name a file keeps it, and says which one did.
  it.each([
    ['place_photos.storage_path', [one, none, none]],
    ['place_photos.photo_uri', [none, one, none]],
    ['cities.hero_photo_path', [none, none, one]],
  ])('keeps a file %s names, written since the list was made', async (why, replies) => {
    h.fake.replies(...(replies as Reply[]), ...free(), { data: [], error: null });
    const res = await viaOps({ paths: ['hanoi/named.jpg', 'hanoi/orphan.jpg'] });
    expect(await res.json()).toEqual({ removed: 1, kept: [{ path: 'hanoi/named.jpg', why }], dry: false });
    expect(removes()[0].payload).toEqual(['hanoi/orphan.jpg']);
  });

  it('names the first table that holds it when more than one does', async () => {
    h.fake.replies(one, one, one);
    const res = await viaOps({ paths: ['hanoi/1.jpg'] });
    expect((await res.json()).kept).toEqual([{ path: 'hanoi/1.jpg', why: 'place_photos.storage_path' }]);
  });

  // What the re-check asks is the safety, so its shape is pinned: the
  // exact column, the public URL's tail in the bucket the function
  // removes from, and the heroes' column.
  it('asks each table the question that would find the row', async () => {
    h.fake.replies(...free(), { data: [], error: null });
    await viaOps({ paths: ['hanoi/1.jpg'] });
    expect(rechecks().map((a) => [a.table, a.filters, a.limit])).toEqual([
      ['place_photos', [['storage_path', 'hanoi/1.jpg']], 1],
      ['place_photos', [['photo_uri~~', '%/place-photos/hanoi/1.jpg']], 1],
      ['cities', [['hero_photo_path', 'hanoi/1.jpg']], 1],
    ]);
    expect(removes()[0].table).toBe('place-photos');
  });

  it('reads a re-check that answers no rows at all as not holding the file', async () => {
    h.fake.replies({ data: null, error: null }, { data: null, error: null }, { data: null, error: null },
      { data: [], error: null });
    const res = await viaOps({ paths: ['hanoi/1.jpg'] });
    expect(await res.json()).toMatchObject({ removed: 1, kept: [] });
  });

  // A re-check that failed is a re-check that did not answer, and a file
  // nobody vouched for is not removed. The whole call stops — including
  // the paths already cleared — rather than removing on half an answer.
  it.each([0, 1, 2])('stops, removing nothing, when re-check %i fails', async (at) => {
    const replies = free();
    replies[at] = { data: null, error: { message: `down ${at}` } };
    h.fake.replies(...free(), ...replies, { data: [], error: null });
    const res = await viaOps({ paths: ['hanoi/ok.jpg', 'hanoi/2.jpg'] });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: `down ${at}` });
    expect(removes()).toEqual([]);
  });
});

describe('the run', () => {
  it('removes what nobody holds and counts it', async () => {
    h.fake.replies(...free(), ...free(), { data: [], error: null });
    const res = await viaOps({ paths: ['a/1.jpg', 'b/2.jpg', 'cities/x.jpg'] });
    expect(res.status).toBe(200);
    const out = await res.json();
    expect(out).toEqual({ removed: 2, kept: [{ path: 'cities/x.jpg', why: 'refused' }], dry: false });
    expect('would_remove' in out).toBe(false);
    expect(removes()).toEqual([expect.objectContaining({ payload: ['a/1.jpg', 'b/2.jpg'] })]);
  });

  it('answers what would go on a dry run, and takes nothing', async () => {
    h.fake.replies(one, none, none, ...free(), { data: [], error: null });
    const res = await viaOps({ paths: ['a/held.jpg', 'a/1.jpg'], dry: true });
    expect(await res.json()).toEqual({
      removed: 0, would_remove: ['a/1.jpg'],
      kept: [{ path: 'a/held.jpg', why: 'place_photos.storage_path' }], dry: true,
    });
    expect(removes()).toEqual([]);
  });

  // `dry` has to be the boolean. Anything else is the real run — which is
  // the dangerous direction, and why it is pinned: `"dry": "true"` from a
  // hand-written body removes.
  it('treats a dry that is not `true` itself as the real run', async () => {
    h.fake.replies(...free(), { data: [], error: null });
    const res = await viaOps({ paths: ['a/1.jpg'], dry: 'true' });
    expect(await res.json()).toMatchObject({ removed: 1, dry: false });
    expect(removes()).toHaveLength(1);
  });

  it('does not call Storage when everything was kept', async () => {
    h.fake.replies(one, none, none);
    const res = await viaOps({ paths: ['a/held.jpg'] });
    expect(await res.json()).toMatchObject({ removed: 0 });
    expect(removes()).toEqual([]);
  });

  it('reports a Storage refusal with what it meant to take and what it kept', async () => {
    h.fake.replies(...free(), { data: null, error: { message: 'storage down' } });
    const res = await viaOps({ paths: ['a/1.jpg', 'cities/x.jpg'] });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      error: 'storage down', kept: [{ path: 'cities/x.jpg', why: 'refused' }], would_remove: ['a/1.jpg'],
    });
  });
});
