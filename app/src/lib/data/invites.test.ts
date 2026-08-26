// The statements in `lib/data/invites.ts`, pressed against the fake
// Supabase client rather than a database.
//
// What is worth pinning here is not "did it call Supabase" — it is the
// shape of what was sent, and in this module that means one thing above
// all: which conditions are DELIBERATELY ABSENT. Every read and the answer
// write are scoped by a policy, and a `where` here that repeated the policy
// would be the copy that drifts. The policies themselves are asserted for
// real against a live client in supabase/tests/trip_invites_test.sql; these
// assert that the client does not quietly grow a second, weaker copy.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ fake: null as ReturnType<typeof import('../testing').fakeSupabase> | null }));
vi.mock('../supabase', async () => {
  const { fakeSupabase } = await import('../testing');
  h.fake = fakeSupabase();
  return { supabase: h.fake.client };
});

import {
  answerInvite, fetchCrewCounts, fetchInvites, sendInvites, withdrawInvites,
} from './invites';

const fake = () => h.fake!;
beforeEach(() => fake().reset());

describe('fetchInvites', () => {
  it('reads both sides in one query', async () => {
    fake().replies({ data: [{ trip_id: 't1', invitee_id: 'me', status: 'pending' }] });
    const out = await fetchInvites();
    expect(out).toHaveLength(1);
    expect(fake().log).toHaveLength(1);
    expect(fake().log[0]).toMatchObject({ table: 'trip_invites', op: 'select' });
  });

  // The select policy already returns the rows where the caller is the
  // invitee plus the rows on trips they own. Filtering to one of those here
  // would hide the other half — the crew of a trip you planned — and would
  // need a second query to get it back.
  it('does not filter to one side of the invitation', async () => {
    fake().replies({ data: [] });
    await fetchInvites();
    expect(fake().log[0].filters).toEqual([]);
  });

  it('carries the refusal up rather than answering with an empty list', async () => {
    fake().replies({ error: { message: 'permission denied' } });
    await expect(fetchInvites()).rejects.toThrow('permission denied');
  });

  it('answers with a list when the table is empty', async () => {
    fake().replies({ data: null });
    expect(await fetchInvites()).toEqual([]);
  });
});

describe('sendInvites', () => {
  it('asks everybody in one statement', async () => {
    fake().replies({ data: null });
    expect(await sendInvites('t1', 'owner', ['a', 'b'])).toBe(2);
    expect(fake().log).toHaveLength(1);
    expect(fake().log[0]).toMatchObject({ table: 'trip_invites', op: 'insert' });
    expect(fake().log[0].payload).toEqual([
      { trip_id: 't1', invitee_id: 'a', inviter_id: 'owner' },
      { trip_id: 't1', invitee_id: 'b', inviter_id: 'owner' },
    ]);
  });

  // The insert policy requires 'pending' and the column defaults to it.
  // Sending it would be a second copy of a rule the server holds — and the
  // one that could later be edited to say something else.
  it('leaves the status to the column default', async () => {
    fake().replies({ data: null });
    await sendInvites('t1', 'owner', ['a']);
    expect((fake().log[0].payload as Record<string, unknown>[])[0]).not.toHaveProperty('status');
  });

  it('says nothing to the network when nothing was ticked', async () => {
    expect(await sendInvites('t1', 'owner', [])).toBe(0);
    expect(fake().log).toHaveLength(0);
  });

  it('surfaces the policy refusing a stranger', async () => {
    fake().replies({ error: { message: 'new row violates row-level security policy' } });
    await expect(sendInvites('t1', 'owner', ['stranger']))
      .rejects.toThrow(/row-level security/);
  });
});

describe('withdrawInvites', () => {
  it('removes the named rows on that trip only', async () => {
    fake().replies({ data: null });
    await withdrawInvites('t1', ['a', 'b']);
    expect(fake().log[0]).toMatchObject({ table: 'trip_invites', op: 'delete' });
    expect(fake().log[0].filters).toEqual([['trip_id', 't1'], ['invitee_id', ['a', 'b']]]);
  });

  it('says nothing to the network when nothing was unticked', async () => {
    await withdrawInvites('t1', []);
    expect(fake().log).toHaveLength(0);
  });

  // The delete policy only reaches unanswered rows. The client does not
  // repeat that condition — `diffSelection` never proposes an answered row,
  // and if it ever did the server would refuse rather than the client
  // silently widening.
  it('carries a refusal up', async () => {
    fake().replies({ error: { message: 'permission denied' } });
    await expect(withdrawInvites('t1', ['a'])).rejects.toThrow('permission denied');
  });

  it('does not carry its own copy of the unanswered rule', async () => {
    fake().replies({ data: null });
    await withdrawInvites('t1', ['a']);
    expect(fake().log[0].filters.map(([k]) => k)).not.toContain('status');
  });
});

describe('answerInvite', () => {
  it('writes the answer and when it was given', async () => {
    fake().replies({ data: null });
    await answerInvite('t1', 'accepted');
    const [q] = fake().log;
    expect(q).toMatchObject({ table: 'trip_invites', op: 'update' });
    expect(q.payload).toMatchObject({ status: 'accepted' });
    expect(typeof (q.payload as { responded_at: string }).responded_at).toBe('string');
  });

  it('carries a refusal the same way', async () => {
    fake().replies({ data: null });
    await answerInvite('t1', 'declined');
    expect(fake().log[0].payload).toMatchObject({ status: 'declined' });
  });

  it('carries a refusal up rather than reporting the answer as given', async () => {
    fake().replies({ error: { message: 'permission denied' } });
    await expect(answerInvite('t1', 'accepted')).rejects.toThrow('permission denied');
  });

  // The update policy pins the row to the caller and to the unanswered
  // state. Naming the invitee here would be the drifting copy; a second
  // answer reaches no rows rather than failing, which is what the screen
  // wants — the invitation is simply no longer waiting.
  it('names the trip and leaves the rest to the policy', async () => {
    fake().replies({ data: null });
    await answerInvite('t1', 'accepted');
    expect(fake().log[0].filters).toEqual([['trip_id', 't1']]);
  });
});

describe('fetchCrewCounts', () => {
  it('asks the function rather than the table', async () => {
    fake().replies({ data: [{ trip_id: 't1', accepted: 2, pending: 1 }] });
    const out = await fetchCrewCounts(['t1']);
    expect(fake().log[0]).toMatchObject({ op: 'rpc', fn: 'trip_crew_counts' });
    expect(out.t1).toEqual({ trip_id: 't1', accepted: 2, pending: 1 });
  });

  it('says nothing to the network for an empty list', async () => {
    expect(await fetchCrewCounts([])).toEqual({});
    expect(fake().log).toHaveLength(0);
  });

  it('carries a refusal up', async () => {
    fake().replies({ error: { message: 'function does not exist' } });
    await expect(fetchCrewCounts(['t1'])).rejects.toThrow('function does not exist');
  });

  it('treats a null answer as no counts rather than crashing', async () => {
    fake().replies({ data: null });
    expect(await fetchCrewCounts(['t1'])).toEqual({});
  });

  // A trip the caller is on neither side of comes back with no row at all,
  // not a zero — a zero would confirm it exists. The map simply has no key
  // for it, and the screen draws the sentence without a number.
  it('leaves a trip it was told nothing about out of the map', async () => {
    fake().replies({ data: [] });
    expect(await fetchCrewCounts(['t1'])).toEqual({});
  });
});
