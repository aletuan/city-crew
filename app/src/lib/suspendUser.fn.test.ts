// The `suspend-user` Edge Function, as deployed.
//
// It holds the service role and bans accounts, so everything that matters
// about it is who gets through the door: a session, whose email is on the
// editors list — checked here because a service-role client has no RLS
// standing over it — and then a target that is somebody else. None of it
// had a test. Nor did the two rules added since: no editor bans another,
// and every ban and lift is written to `moderation_log` first.
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
/** The account being acted on, as GoTrue returns it: email as typed. */
const target = { data: { user: { id: 'target', email: 'Reader@Crew.TEST' } }, error: null };
const logged = { data: { id: 7 }, error: null };
const lines = () => h.fake.log.filter((a) => a.table === 'moderation_log');

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
    h.fake.replies(session('ed', 'desk@crew.test'), editor, target, notEditor, logged, { data: {} });
    const res = await call({ token: 'jwt', body: { user_id: 'target' } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, suspended: true });
    expect(bans()[0].payload).toEqual({ id: 'target', attrs: { ban_duration: '876000h' } });
  });

  it('lifts a suspension only when told to in so many words', async () => {
    h.fake.replies(session('ed', 'desk@crew.test'), editor, target, logged, { data: {} });
    const res = await call({ token: 'jwt', body: { user_id: 'target', suspend: false } });
    expect(await res.json()).toEqual({ ok: true, suspended: false });
    expect(bans()[0].payload).toEqual({ id: 'target', attrs: { ban_duration: 'none' } });
  });

  it('treats anything short of `false` as a suspension, not a lift', async () => {
    h.fake.replies(session('ed', 'desk@crew.test'), editor, target, notEditor, logged, { data: {} });
    await call({ token: 'jwt', body: { user_id: 'target', suspend: 'false' } });
    expect(bans()[0].payload).toEqual({ id: 'target', attrs: { ban_duration: '876000h' } });
  });

  it('reports a ban the auth server refused, and takes its line back out', async () => {
    h.fake.replies(session('ed', 'desk@crew.test'), editor, target, notEditor, logged,
      { error: { message: 'ban failed' } });
    const res = await call({ token: 'jwt', body: { user_id: 'target' } });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'ban failed' });
    expect(lines().map((a) => a.op)).toEqual(['insert', 'delete']);
    expect(lines()[1].filters).toEqual([['id', 7]]);
  });
});

// Nobody could say who banned whom: the act left only its result. Every
// ban and lift is now a line in `moderation_log`, written before the act
// so an act can never go unrecorded.
describe('the record', () => {
  it('writes who, what and whom before banning', async () => {
    h.fake.replies(session('ed', 'Desk@Crew.test'), editor, target, notEditor, logged, { data: {} });
    await call({ token: 'jwt', body: { user_id: 'target' } });
    expect(lines()[0]).toMatchObject({
      op: 'insert',
      payload: {
        actor: 'ed', actor_email: 'desk@crew.test', action: 'suspend',
        target_id: 'target', detail: { target_email: 'reader@crew.test' },
      },
    });
    const order = h.fake.log.map((a) => a.fn ?? a.table);
    expect(order.indexOf('moderation_log')).toBeLessThan(order.indexOf('admin.updateUserById'));
  });

  it('records a lift as a lift', async () => {
    h.fake.replies(session('ed', 'desk@crew.test'), editor, target, logged, { data: {} });
    await call({ token: 'jwt', body: { user_id: 'target', suspend: false } });
    expect(lines()[0].payload).toMatchObject({ action: 'unsuspend' });
  });

  it('bans nobody when the line cannot be written', async () => {
    h.fake.replies(session('ed', 'desk@crew.test'), editor, target, notEditor,
      { data: null, error: { message: 'permission denied' } });
    const res = await call({ token: 'jwt', body: { user_id: 'target' } });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'could not record the action; nothing was changed' });
    expect(bans()).toEqual([]);
  });
});

describe('whom the desk may ban', () => {
  it('answers 404 for an account that does not exist, and records nothing', async () => {
    h.fake.replies(session('ed', 'desk@crew.test'), editor, { data: { user: null }, error: { message: 'User not found' } });
    const res = await call({ token: 'jwt', body: { user_id: 'ghost' } });
    expect(res.status).toBe(404);
    expect(h.fake.log.find((a) => a.fn === 'admin.getUserById')?.payload).toBe('ghost');
    expect(lines()).toEqual([]);
    expect(bans()).toEqual([]);
  });

  it('will not let one editor lock another out', async () => {
    h.fake.replies(session('ed', 'desk@crew.test'), editor, target, editor);
    const res = await call({ token: 'jwt', body: { user_id: 'target' } });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'cannot suspend an editor' });
    expect(h.fake.log.filter((a) => a.table === 'editors')[1].filters).toEqual([['email', 'reader@crew.test']]);
    expect(lines()).toEqual([]);
    expect(bans()).toEqual([]);
  });

  it('can still lift a ban on an editor, made before the rule', async () => {
    h.fake.replies(session('ed', 'desk@crew.test'), editor, target, logged, { data: {} });
    const res = await call({ token: 'jwt', body: { user_id: 'target', suspend: false } });
    expect(res.status).toBe(200);
    expect(h.fake.log.filter((a) => a.table === 'editors')).toHaveLength(1);
    expect(bans()[0].payload).toEqual({ id: 'target', attrs: { ban_duration: 'none' } });
  });
});
