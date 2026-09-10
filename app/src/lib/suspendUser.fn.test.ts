// The `suspend-user` Edge Function, as deployed.
//
// It holds the service role and bans accounts, so everything that matters
// about it is who gets through the door: a session, whose email is on the
// editors list — checked here because a service-role client has no RLS
// standing over it — and then a target that is somebody else. None of it
// had a test.
//
// Loaded unchanged, the way `deleteAccount.fn.test.ts` loads its function:
// `Deno` is stood in for to capture the handler, and the `npm:` client
// resolves to `lib/testing`'s, which writes down every call.

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
    env: { get: () => 'unused' },
  });
  const fn = '../../../supabase/functions/suspend-user/index.ts';
  await import(/* @vite-ignore */ fn);
});

beforeEach(() => { h.fake.reset(); });

const call = (init: { method?: string; token?: string; body?: string | object } = {}) =>
  h.handler(new Request('https://project.test/functions/v1/suspend-user', {
    method: init.method ?? 'POST',
    headers: init.token ? { Authorization: `Bearer ${init.token}` } : {},
    body: init.body === undefined ? undefined
      : typeof init.body === 'string' ? init.body : JSON.stringify(init.body),
  }));

const session = (id: string, email: string) => ({ data: { user: { id, email } }, error: null });
const editor = { data: { email: 'desk@crew.test' } };
const notEditor = { data: null };
const bans = () => h.fake.log.filter((a) => a.fn === 'admin.updateUserById');

describe('who gets through the door', () => {
  it('answers the preflight and refuses anything but POST, asking nothing', async () => {
    expect((await call({ method: 'OPTIONS' })).status).toBe(200);
    expect((await call({ method: 'GET' })).status).toBe(405);
    expect(h.fake.log).toEqual([]);
  });

  it('refuses without a session, before looking anybody up', async () => {
    h.fake.replies({ data: { user: null } });
    const res = await call({ body: { user_id: 'target' } });
    expect(res.status).toBe(401);
    expect(h.fake.log.filter((a) => a.table === 'editors')).toEqual([]);
    expect(bans()).toEqual([]);
  });

  it('refuses a session with no email, which cannot be on the list', async () => {
    h.fake.replies({ data: { user: { id: 'u1', email: null } } });
    expect((await call({ token: 't', body: { user_id: 'target' } })).status).toBe(401);
    expect(bans()).toEqual([]);
  });

  it('refuses a signed-in reader who is not an editor, and bans nobody', async () => {
    h.fake.replies(session('u1', 'reader@crew.test'), notEditor);
    const res = await call({ token: 'jwt', body: { user_id: 'target' } });
    expect(res.status).toBe(403);
    expect(bans()).toEqual([]);
  });

  it('looks the editor up by the lower-cased email, since GoTrue returns what was typed', async () => {
    h.fake.replies(session('ed', 'Desk@Crew.TEST'), editor, { data: {} });
    await call({ token: 'jwt', body: { user_id: 'target' } });
    expect(h.fake.log.find((a) => a.table === 'editors')).toMatchObject({
      op: 'select', filters: [['email', 'desk@crew.test']], maybe: true,
    });
  });
});

describe('what an editor may do', () => {
  it('needs a target', async () => {
    h.fake.replies(session('ed', 'desk@crew.test'), editor);
    const res = await call({ token: 'jwt', body: {} });
    expect(res.status).toBe(400);
    expect(bans()).toEqual([]);
  });

  it('reads a body that is not JSON as naming nobody', async () => {
    h.fake.replies(session('ed', 'desk@crew.test'), editor);
    const res = await call({ token: 'jwt', body: '{not json' });
    expect(res.status).toBe(400);
    expect(bans()).toEqual([]);
  });

  it('will not let the desk suspend itself', async () => {
    h.fake.replies(session('ed', 'desk@crew.test'), editor);
    const res = await call({ token: 'jwt', body: { user_id: 'ed' } });
    expect(res.status).toBe(400);
    expect(bans()).toEqual([]);
  });

  it('suspends by default, for as long as the API allows', async () => {
    h.fake.replies(session('ed', 'desk@crew.test'), editor, { data: {} });
    const res = await call({ token: 'jwt', body: { user_id: 'target' } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, suspended: true });
    expect(bans()[0].payload).toEqual({ id: 'target', attrs: { ban_duration: '876000h' } });
  });

  it('lifts a suspension only when told to in so many words', async () => {
    h.fake.replies(session('ed', 'desk@crew.test'), editor, { data: {} });
    const res = await call({ token: 'jwt', body: { user_id: 'target', suspend: false } });
    expect(await res.json()).toEqual({ ok: true, suspended: false });
    expect(bans()[0].payload).toEqual({ id: 'target', attrs: { ban_duration: 'none' } });
  });

  it('treats anything short of `false` as a suspension, not a lift', async () => {
    h.fake.replies(session('ed', 'desk@crew.test'), editor, { data: {} });
    await call({ token: 'jwt', body: { user_id: 'target', suspend: 'false' } });
    expect(bans()[0].payload).toEqual({ id: 'target', attrs: { ban_duration: '876000h' } });
  });

  it('reports a ban the auth server refused', async () => {
    h.fake.replies(session('ed', 'desk@crew.test'), editor, { error: { message: 'User not found' } });
    const res = await call({ token: 'jwt', body: { user_id: 'ghost' } });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'User not found' });
  });
});
