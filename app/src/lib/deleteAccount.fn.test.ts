// The `delete-account` Edge Function, as deployed.
//
// It is the one irreversible thing the app can do to a person, and the only
// check that stands in front of it is identity: the account deleted must be
// the one the token proves, never one named in the body. That line had no
// test. Neither had the order around it — the avatar goes first, because
// after the account nothing owns the file, and a failure there must not be
// what stops somebody leaving.
//
// The file is loaded unchanged. It calls `Deno.serve` when imported and
// reaches its client through an `npm:` specifier, neither of which Node
// has, so both are stood in for: `Deno` captures the handler it is given,
// and the specifier resolves to `lib/testing`'s client, which writes down
// every call. What is asserted is the handler's answers and that log.

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { fakeSupabase } from './testing';

const h = vi.hoisted(() => ({
  fake: null as unknown as ReturnType<typeof fakeSupabase>,
  created: [] as unknown[][],
  handler: null as unknown as (req: Request) => Promise<Response>,
}));

vi.mock('npm:@supabase/supabase-js@2', async () => {
  const { fakeSupabase } = await import('./testing');
  h.fake = fakeSupabase();
  return {
    createClient: (...args: unknown[]) => { h.created.push(args); return h.fake.client; },
  };
});

const ENV: Record<string, string> = {
  SUPABASE_URL: 'https://project.test',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
};

beforeAll(async () => {
  vi.stubGlobal('Deno', {
    serve: (fn: (req: Request) => Promise<Response>) => { h.handler = fn; },
    env: { get: (k: string) => ENV[k] },
  });
  // A computed path, so the typecheck does not follow it into a file
  // written against Deno's globals. Vitest resolves it all the same.
  const fn = '../../../supabase/functions/delete-account/index.ts';
  await import(/* @vite-ignore */ fn);
});

beforeEach(() => {
  h.fake.reset();
  h.created.length = 0;
});

const call = (init: { method?: string; token?: string; body?: unknown } = {}) =>
  h.handler(new Request('https://project.test/functions/v1/delete-account', {
    method: init.method ?? 'POST',
    headers: init.token ? { Authorization: `Bearer ${init.token}` } : {},
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  }));

const signedIn = (id: string) => ({ data: { user: { id, email: `${id}@crew.test` } }, error: null });
const fns = () => h.fake.log.map((a) => a.fn);

describe('delete-account', () => {
  it('answers the browser’s preflight and asks nothing', async () => {
    const res = await call({ method: 'OPTIONS' });
    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Methods')).toBe('POST, OPTIONS');
    expect(h.fake.log).toEqual([]);
  });

  it('refuses anything but POST', async () => {
    const res = await call({ method: 'GET' });
    expect(res.status).toBe(405);
    expect(h.fake.log).toEqual([]);
  });

  it('deletes nothing without a session', async () => {
    h.fake.replies({ data: { user: null }, error: null });
    const res = await call();
    expect(res.status).toBe(401);
    expect(h.fake.log[0]).toMatchObject({ fn: 'getUser', payload: '' });
    expect(fns()).not.toContain('admin.deleteUser');
    expect(h.fake.log.filter((a) => a.op === 'storage')).toEqual([]);
  });

  it('deletes nothing for a token GoTrue does not recognise', async () => {
    h.fake.replies({ data: { user: null }, error: { message: 'invalid JWT' } });
    const res = await call({ token: 'forged' });
    expect(res.status).toBe(401);
    expect(h.fake.log[0]).toMatchObject({ fn: 'getUser', payload: 'forged' });
    expect(fns()).not.toContain('admin.deleteUser');
  });

  it('deletes the account the token proves, whatever the body names', async () => {
    h.fake.replies(signedIn('u1'), { data: {} }, { data: {}, error: null });
    const res = await call({ token: 'jwt-u1', body: { user_id: 'someone-else' } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(h.fake.log.find((a) => a.fn === 'admin.deleteUser')?.payload).toBe('u1');
  });

  it('holds the service role, which is what deleting an auth user takes', async () => {
    h.fake.replies(signedIn('u1'), { data: {} }, { data: {}, error: null });
    await call({ token: 'jwt-u1' });
    expect(h.created).toEqual([['https://project.test', 'service-role-key']]);
  });

  it('removes the avatar first, while something still owns it', async () => {
    h.fake.replies(signedIn('u1'), { data: {} }, { data: {}, error: null });
    await call({ token: 'jwt-u1' });
    expect(fns()).toEqual(['getUser', 'remove', 'admin.deleteUser']);
    expect(h.fake.log[1]).toMatchObject({ table: 'avatars', op: 'storage', payload: ['u1/avatar.jpg'] });
  });

  it('still deletes the account when removing the avatar throws', async () => {
    h.fake.replies(signedIn('u1'), { throws: new Error('storage down') }, { data: {}, error: null });
    const res = await call({ token: 'jwt-u1' });
    expect(res.status).toBe(200);
    expect(fns()).toContain('admin.deleteUser');
  });

  it('still deletes the account when there was no avatar to remove', async () => {
    h.fake.replies(signedIn('u1'), { data: null, error: { message: 'Object not found' } }, { data: {}, error: null });
    const res = await call({ token: 'jwt-u1' });
    expect(res.status).toBe(200);
    expect(fns()).toContain('admin.deleteUser');
  });

  it('reports a deletion the auth server refused, rather than claiming it happened', async () => {
    h.fake.replies(signedIn('u1'), { data: {} }, { data: null, error: { message: 'Database error deleting user' } });
    const res = await call({ token: 'jwt-u1' });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Database error deleting user' });
  });
});
