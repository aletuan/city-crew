// The social half of the data layer: friendships, the faces behind them,
// blocks and reports.
//
// None of these had a test before `data.ts` became a directory — they were
// the largest untested stretch of the file. What is worth pinning is the
// shape of each question, because almost every rule here is enforced in
// Postgres and invisible at the call site: which of these fail loudly and
// which answer empty, which read is case-insensitive, and which call is a
// Postgres function rather than a table at all.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ fake: null as ReturnType<typeof import('../testing').fakeSupabase> | null }));
vi.mock('../supabase', async () => {
  const { fakeSupabase } = await import('../testing');
  h.fake = fakeSupabase();
  return { supabase: h.fake.client };
});

import {
  acceptFriendRequest, blockUser, fetchApplause, fetchCuratorAvatars, fetchFriendships,
  fetchMutualSaves, fetchMyBlocks, fetchProfilesById, fetchSuggestedFriends, profileByHandle,
  removeFriendship, searchHandles, sendFriendRequest, submitReport, unblockUser,
} from './people';

const fake = () => h.fake!;
beforeEach(() => fake().reset());

const profile = (id: string, handle: string) => ({
  id, handle, full_name: 'Minh Anh', avatar_url: `http://x/${id}.jpg`,
});

describe('fetchFriendships', () => {
  // RLS scopes the read to edges the caller is on, so this asks for no
  // filter at all. A `where` here would be a second, weaker copy of a rule
  // Postgres already enforces — and the one that could drift.
  it('takes no filter, because RLS is the filter', async () => {
    fake().replies({ data: [{ requester: 'a', addressee: 'b', status: 'pending' }] });
    expect(await fetchFriendships()).toHaveLength(1);

    const [q] = fake().log;
    expect(q.table).toBe('friendships');
    expect(q.filters).toEqual([]);
  });

  it('answers empty rather than null when there are no edges', async () => {
    fake().replies({ data: null });
    expect(await fetchFriendships()).toEqual([]);
  });

  it('throws when the read failed', async () => {
    fake().replies({ error: { message: 'timeout' } });
    await expect(fetchFriendships()).rejects.toThrow('timeout');
  });
});

describe('fetchProfilesById', () => {
  it('keys the profiles it found by id', async () => {
    fake().replies({ data: [profile('u1', 'anh'), profile('u2', 'binh')] });
    const out = await fetchProfilesById(['u1', 'u2']);
    expect(Object.keys(out)).toEqual(['u1', 'u2']);
    expect(fake().log[0].filters).toEqual([['id', ['u1', 'u2']]]);
  });

  it('asks nothing at all for an empty list', async () => {
    expect(await fetchProfilesById([])).toEqual({});
    expect(fake().log).toEqual([]);
  });

  it('answers empty when the table returns nothing', async () => {
    fake().replies({ data: null });
    expect(await fetchProfilesById(['u1'])).toEqual({});
  });

  it('throws when the read failed', async () => {
    fake().replies({ error: { message: 'timeout' } });
    await expect(fetchProfilesById(['u1'])).rejects.toThrow('timeout');
  });
});

describe('profileByHandle', () => {
  // The stored value is lowercase and the typed one may not be, so the
  // match is case-insensitive — the same reason auth's availability check
  // uses `ilike`. An `eq` here would tell somebody typing @Anh that the
  // handle is free.
  it('matches case-insensitively', async () => {
    fake().replies({ data: profile('u1', 'anh') });
    expect(await profileByHandle('Anh')).toMatchObject({ id: 'u1' });
    expect(fake().log[0].filters).toEqual([['handle~~*', 'Anh']]);
  });

  it('asks the forgiving question, because no such handle is an answer', async () => {
    fake().replies({ data: null });
    expect(await profileByHandle('nobody')).toBeNull();
    expect(fake().log[0].maybe).toBe(true);
  });

  it('throws when the lookup failed', async () => {
    fake().replies({ error: { message: 'timeout' } });
    await expect(profileByHandle('anh')).rejects.toThrow('timeout');
  });
});

describe('fetchCuratorAvatars', () => {
  // Normalised on both sides: editorial rows were seeded with the `@` that
  // `curator_handle` carries, and `profiles.handle` never has one.
  it('folds the handles before asking and again before keying', async () => {
    fake().replies({ data: [{ handle: 'Anh', avatar_url: 'http://x/a.jpg' }] });
    expect(await fetchCuratorAvatars(['@Anh'])).toEqual({ anh: 'http://x/a.jpg' });
    expect(fake().log[0].filters).toEqual([['handle', ['anh']]]);
  });

  it('asks once for a handle that appears twice on the shelf', async () => {
    fake().replies({ data: [] });
    await fetchCuratorAvatars(['@anh', 'anh', '@ANH']);
    expect(fake().log[0].filters).toEqual([['handle', ['anh']]]);
  });

  it('asks nothing when nothing survives the fold', async () => {
    expect(await fetchCuratorAvatars(['@', ''])).toEqual({});
    expect(fake().log).toEqual([]);
  });

  it('leaves out a profile with no picture rather than keying an empty one', async () => {
    fake().replies({ data: [{ handle: 'anh', avatar_url: '' }] });
    expect(await fetchCuratorAvatars(['anh'])).toEqual({});
  });

  // A missing face is the normal case — every editorial handle lives in
  // `reserved_handles` with no profile behind it — so failure cannot be
  // allowed to be an error.
  it('answers an empty map when the read failed', async () => {
    fake().replies({ error: { message: 'timeout' } });
    expect(await fetchCuratorAvatars(['anh'])).toEqual({});
  });

  it('answers an empty map when there is no data', async () => {
    fake().replies({ data: null });
    expect(await fetchCuratorAvatars(['anh'])).toEqual({});
  });
});

describe('sendFriendRequest', () => {
  it('writes the pair and lets the insert policy hold the rules', async () => {
    fake().replies({ error: null });
    await sendFriendRequest('me', 'them');

    const [q] = fake().log;
    expect(q).toMatchObject({ table: 'friendships', op: 'insert' });
    // No `status`: the column defaults to pending, and a client that sent
    // its own could send 'accepted'.
    expect(q.payload).toEqual({ requester: 'me', addressee: 'them' });
  });

  it('surfaces a refusal — the daily cap arrives this way', async () => {
    fake().replies({ error: { message: 'new row violates row-level security policy' } });
    await expect(sendFriendRequest('me', 'them')).rejects.toThrow('row-level security');
  });
});

describe('acceptFriendRequest', () => {
  it('flips the row the other person opened, not one of its own', async () => {
    fake().replies({ error: null });
    await acceptFriendRequest('them', 'me');

    const [q] = fake().log;
    expect(q).toMatchObject({ table: 'friendships', op: 'update' });
    expect(q.payload).toMatchObject({ status: 'accepted' });
    // Both ends named, and in this order: the accepter must be the
    // addressee, so a swapped pair matches no row rather than the wrong one.
    expect(q.filters).toEqual([['requester', 'them'], ['addressee', 'me']]);
  });

  it('stamps when it was answered', async () => {
    fake().replies({ error: null });
    await acceptFriendRequest('them', 'me');
    const { responded_at: at } = fake().log[0].payload as { responded_at: string };
    expect(Number.isNaN(Date.parse(at))).toBe(false);
  });

  it('throws when the update was refused', async () => {
    fake().replies({ error: { message: 'not yours' } });
    await expect(acceptFriendRequest('them', 'me')).rejects.toThrow('not yours');
  });
});

describe('removeFriendship', () => {
  // Decline, cancel and unfriend are all this one delete. The edge is
  // stored once per pair in whichever direction it was opened, so both
  // orderings have to be named or half the calls would find nothing.
  it('deletes the edge whichever way round it was opened', async () => {
    fake().replies({ error: null });
    await removeFriendship('a', 'b');

    const [q] = fake().log;
    expect(q).toMatchObject({ table: 'friendships', op: 'delete' });
    expect(q.or).toBe('and(requester.eq.a,addressee.eq.b),and(requester.eq.b,addressee.eq.a)');
  });

  it('throws when the delete was refused', async () => {
    fake().replies({ error: { message: 'not yours' } });
    await expect(removeFriendship('a', 'b')).rejects.toThrow('not yours');
  });
});

describe('fetchSuggestedFriends', () => {
  it('asks the Postgres function by name', async () => {
    fake().replies({ data: [{ id: 'u2', overlap: 3 }] });
    expect(await fetchSuggestedFriends()).toHaveLength(1);

    const [q] = fake().log;
    expect(q).toMatchObject({ op: 'rpc', fn: 'suggested_friends' });
    // No arguments: who you already know and who is blocked are questions
    // the function answers from the session, not from anything sent here.
    expect(q.payload).toBeUndefined();
  });

  // An empty introductions shelf is a fine screen; an error one is not.
  it('answers empty when the call failed', async () => {
    fake().replies({ error: { message: 'function does not exist' } });
    expect(await fetchSuggestedFriends()).toEqual([]);
  });

  it('answers empty when it returned nothing', async () => {
    fake().replies({ data: null });
    expect(await fetchSuggestedFriends()).toEqual([]);
  });
});

describe('fetchMutualSaves', () => {
  it('keys the counts by the other person', async () => {
    fake().replies({ data: [{ other: 'u2', mutual: 4 }, { other: 'u3', mutual: 1 }] });
    expect(await fetchMutualSaves(['u2', 'u3'])).toEqual({ u2: 4, u3: 1 });
    expect(fake().log[0]).toMatchObject({ op: 'rpc', fn: 'mutual_saves_counts' });
    expect(fake().log[0].payload).toEqual({ others: ['u2', 'u3'] });
  });

  it('asks nothing at all for an empty list', async () => {
    expect(await fetchMutualSaves([])).toEqual({});
    expect(fake().log).toEqual([]);
  });

  it('answers empty when the call failed', async () => {
    fake().replies({ error: { message: 'timeout' } });
    expect(await fetchMutualSaves(['u2'])).toEqual({});
  });

  it('answers empty when it returned nothing', async () => {
    fake().replies({ data: null });
    expect(await fetchMutualSaves(['u2'])).toEqual({});
  });
});

describe('submitReport', () => {
  it('files the words and lets the insert policy hold the rules', async () => {
    fake().replies({ error: null });
    await submitReport({
      reporter: 'me', kind: 'collection', targetId: 'c-1', reason: 'spam', note: '  junk  ',
    });

    const [q] = fake().log;
    expect(q).toMatchObject({ table: 'reports', op: 'insert' });
    expect(q.payload).toEqual({
      reporter: 'me', kind: 'collection', target_id: 'c-1', reason: 'spam', note: 'junk',
    });
  });

  // `cleanNote` is what decides an empty note is no note. Pinned here
  // because the column is nullable and a blank string would read, to the
  // desk, as somebody who typed something.
  it('files no note rather than an empty one', async () => {
    fake().replies({ error: null });
    await submitReport({ reporter: 'me', kind: 'profile', targetId: 'u2', reason: 'offensive', note: '   ' });
    expect((fake().log[0].payload as { note: string | null }).note).toBeNull();
  });

  it('surfaces a refusal — the day’s cap arrives this way', async () => {
    fake().replies({ error: { message: 'new row violates row-level security policy' } });
    await expect(submitReport({
      reporter: 'me', kind: 'profile', targetId: 'u2', reason: 'offensive',
    })).rejects.toThrow('row-level security');
  });
});

describe('fetchMyBlocks', () => {
  it('reads the ids this person has blocked', async () => {
    fake().replies({ data: [{ blocked: 'u2' }, { blocked: 'u3' }] });
    expect(await fetchMyBlocks()).toEqual(['u2', 'u3']);
    expect(fake().log[0].table).toBe('blocks');
  });

  // Failure is an empty list on purpose. This gates a screen, and a throw
  // here would take the whole Crew tab down over a list that is almost
  // always empty.
  it('answers empty when the read failed', async () => {
    fake().replies({ error: { message: 'timeout' } });
    expect(await fetchMyBlocks()).toEqual([]);
  });

  it('answers empty when there is no data', async () => {
    fake().replies({ data: null });
    expect(await fetchMyBlocks()).toEqual([]);
  });
});

describe('blockUser', () => {
  // One act on the server: the row in and any friendship edge out. Two
  // calls from here could half-apply, leaving somebody blocked and still
  // befriended.
  it('is a single Postgres function, not a row write', async () => {
    fake().replies({ error: null });
    await blockUser('u2');

    const [q] = fake().log;
    expect(q).toMatchObject({ op: 'rpc', fn: 'block_user' });
    expect(q.payload).toEqual({ target: 'u2' });
    expect(fake().log).toHaveLength(1);
  });

  it('throws when the call was refused', async () => {
    fake().replies({ error: { message: 'cannot block yourself' } });
    await expect(blockUser('me')).rejects.toThrow('cannot block yourself');
  });
});

describe('unblockUser', () => {
  it('deletes the blocker’s own row, both ends named', async () => {
    fake().replies({ error: null });
    await unblockUser('me', 'u2');

    const [q] = fake().log;
    expect(q).toMatchObject({ table: 'blocks', op: 'delete' });
    expect(q.filters).toEqual([['blocker', 'me'], ['blocked', 'u2']]);
  });

  it('throws when the delete was refused', async () => {
    fake().replies({ error: { message: 'not yours' } });
    await expect(unblockUser('me', 'u2')).rejects.toThrow('not yours');
  });
});

describe('searchHandles', () => {
  // Prefix only, never substring: "an" finds @anh and @anna and does not
  // drag in every handle with those letters somewhere inside.
  it('anchors the pattern at the start', async () => {
    fake().replies({ data: [profile('u1', 'anh')] });
    expect(await searchHandles('an')).toHaveLength(1);
    expect(fake().log[0].filters).toEqual([['handle~~*', 'an%']]);
  });

  it('caps the suggestions and orders them', async () => {
    fake().replies({ data: [] });
    await searchHandles('an');
    expect(fake().log[0].limit).toBe(8);
    expect(fake().log[0].order).toEqual(['handle']);
  });

  it('answers empty when the read failed', async () => {
    fake().replies({ error: { message: 'timeout' } });
    expect(await searchHandles('an')).toEqual([]);
  });

  it('answers empty when there is no data', async () => {
    fake().replies({ data: null });
    expect(await searchHandles('an')).toEqual([]);
  });
});

describe('fetchApplause', () => {
  it('asks the Postgres function for likes since an instant', async () => {
    fake().replies({ data: [{ collection: 'c-1', liker: 'u2' }] });
    expect(await fetchApplause('2026-08-01T00:00:00Z')).toHaveLength(1);

    const [q] = fake().log;
    expect(q).toMatchObject({ op: 'rpc', fn: 'likes_on_mine' });
    expect(q.payload).toEqual({ since: '2026-08-01T00:00:00Z' });
  });

  it('answers empty when the call failed', async () => {
    fake().replies({ error: { message: 'timeout' } });
    expect(await fetchApplause('2026-08-01T00:00:00Z')).toEqual([]);
  });

  it('answers empty when it returned nothing', async () => {
    fake().replies({ data: null });
    expect(await fetchApplause('2026-08-01T00:00:00Z')).toEqual([]);
  });
});
