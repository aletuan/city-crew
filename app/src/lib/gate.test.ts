// The batch jobs' gate lives in `supabase/functions/_shared/`, because
// that is where it runs, and is tested from here for the reason
// `classify.test.ts` gives: this is where the test runner is, and the
// module needs nothing of Deno — a `Request`, which Node has, and a
// client, which `lib/testing` stands in for.
//
// What is worth pinning is the shape of the two doors. The ops token is
// checked against one row by name, and it decides alone: a request that
// carries one is never also tried as a session. A session is checked
// twice — that the token belongs to somebody, and that the somebody is
// on the editors list — and the email is lowercased before the lookup,
// because the list is lowercase and GoTrue returns what was typed.

import { beforeEach, describe, expect, it } from 'vitest';
import { fakeSupabase } from './testing';
import { opsOrEditor } from '../../../supabase/functions/_shared/gate';

let fake: ReturnType<typeof fakeSupabase>;
beforeEach(() => { fake = fakeSupabase(); });

const request = (headers: Record<string, string>) =>
  new Request('https://x.example/functions/v1/shrink-photos', { method: 'POST', headers });

const soon = () => new Date(Date.now() + 60 * 60 * 1000).toISOString();
const ago = () => new Date(Date.now() - 60 * 1000).toISOString();

describe('the job token', () => {
  it('opens for the row named after the job, while it lives', async () => {
    fake.replies({ data: { token: 's3cret', expires_at: soon() } });
    const ok = await opsOrEditor(fake.client, request({ 'x-ops-token': 's3cret' }), 'shrink-photos');
    expect(ok).toBe(true);
    expect(fake.log).toHaveLength(1);
    expect(fake.log[0]).toMatchObject({
      table: 'ops_tokens', op: 'select', filters: [['name', 'shrink-photos']], maybe: true,
    });
  });

  it('refuses a token that matches nothing', async () => {
    fake.replies({ data: null });
    expect(await opsOrEditor(fake.client, request({ 'x-ops-token': 's3cret' }), 'shrink-photos')).toBe(false);
  });

  it('refuses a token that is not the row\'s', async () => {
    fake.replies({ data: { token: 's3cret', expires_at: soon() } });
    expect(await opsOrEditor(fake.client, request({ 'x-ops-token': 'guess' }), 'shrink-photos')).toBe(false);
  });

  // A token past its date is a token that was deleted a little late.
  it('refuses a token past its expiry', async () => {
    fake.replies({ data: { token: 's3cret', expires_at: ago() } });
    expect(await opsOrEditor(fake.client, request({ 'x-ops-token': 's3cret' }), 'shrink-photos')).toBe(false);
  });

  // One door at a time. A request carrying a token is judged on the
  // token, and a bad one is not rescued by a session riding alongside.
  it('decides alone, even with a session in the same request', async () => {
    fake.replies({ data: null });
    const ok = await opsOrEditor(
      fake.client,
      request({ 'x-ops-token': 'guess', Authorization: 'Bearer editor-jwt' }),
      'shrink-photos',
    );
    expect(ok).toBe(false);
    expect(fake.log.map((c) => c.op)).toEqual(['select']);
  });
});

describe('the editor\'s session', () => {
  it('opens for a session whose email is on the list', async () => {
    fake.replies(
      { data: { user: { id: 'u-1', email: 'Anh@Example.com' } } },
      { data: { email: 'anh@example.com' } },
    );
    const ok = await opsOrEditor(fake.client, request({ Authorization: 'Bearer editor-jwt' }), 'shrink-photos');
    expect(ok).toBe(true);
    expect(fake.log[0]).toMatchObject({ op: 'auth', fn: 'getUser', payload: 'editor-jwt' });
    // Lowercased before the lookup: the list is lowercase and GoTrue
    // returns the email as it was typed.
    expect(fake.log[1]).toMatchObject({
      table: 'editors', op: 'select', filters: [['email', 'anh@example.com']], maybe: true,
    });
  });

  it('refuses a session that belongs to nobody, without asking the list', async () => {
    fake.replies({ data: { user: null } });
    expect(await opsOrEditor(fake.client, request({ Authorization: 'Bearer stale' }), 'shrink-photos')).toBe(false);
    expect(fake.log).toHaveLength(1);
  });

  it('refuses a session whose email is not on the list', async () => {
    fake.replies(
      { data: { user: { id: 'u-2', email: 'reader@example.com' } } },
      { data: null },
    );
    expect(await opsOrEditor(fake.client, request({ Authorization: 'Bearer reader-jwt' }), 'shrink-photos')).toBe(false);
  });

  // No header at all is a session of nothing, and GoTrue is asked about
  // nothing rather than the gate guessing.
  it('asks about an empty token when there is no header', async () => {
    fake.replies({ data: { user: null } });
    expect(await opsOrEditor(fake.client, request({}), 'shrink-photos')).toBe(false);
    expect(fake.log[0]).toMatchObject({ op: 'auth', payload: '' });
  });
});
