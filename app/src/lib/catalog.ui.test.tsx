// @vitest-environment jsdom
//
// The catalog provider's two recovery nets, exercised from the outside.
//
// What is pinned: that coming back to the foreground refreshes the
// session *before* it refreshes the catalog, so a read never goes out
// with a token that lapsed while the phone was in a pocket; and that a
// read which failed on an old token is asked again the moment a new one
// lands — that one, and not a read that failed for a reason a token
// cannot cure. The data hooks are stood in for, because what is under
// test is the wiring between AppState, auth and `reload`, not the reads.
//
// And the heart: that a tap moves it — and the tally beside it — before
// the server has answered, that a refused write falls back to the
// server's own answer, and that a double tap is one write, not two racing.

import React from 'react';
import { AppState } from 'react-native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '../uitest/render';

type F = {
  loading: boolean; loaded: boolean; error: string | null; data: unknown[];
  loadedAt: number | null; fromCache: boolean; reload: () => void;
};
const fetch = (over: Partial<F> = {}): F => ({
  loading: false, loaded: true, error: null, data: [], loadedAt: Date.now(), fromCache: false,
  reload: vi.fn(), ...over,
});

const world = vi.hoisted(() => ({
  places: null as unknown as F,
  collections: null as unknown as F,
  authCb: null as null | ((event: string) => void),
  appStateCb: null as null | ((s: string) => void),
  sessionResolved: 0,
  me: 'u1' as string | null,
  // `Auth.userId`: the reader before the session is read. Undefined is
  // "not known yet", which the places query waits on.
  userId: undefined as string | null | undefined,
  askedAs: [] as (string | null | undefined)[],
  likesFor: [] as (string | null | undefined)[],
  likeCounts: null as unknown as F,
  myLikes: null as unknown as F,
}));
const writes = vi.hoisted(() => ({
  like: vi.fn(async (_id: string, _me: string) => true),
  unlike: vi.fn(async (_id: string, _me: string) => true),
}));
const auth = vi.hoisted(() => ({
  getSession: vi.fn(async () => { world.sessionResolved += 1; return { data: { session: null } }; }),
  onAuthStateChange: vi.fn((cb: (event: string) => void) => {
    world.authCb = cb;
    return { data: { subscription: { unsubscribe: () => {} } } };
  }),
}));

vi.mock('./auth', () => ({
  useAuth: () => ({ session: world.me ? { user: { id: world.me } } : null, userId: world.userId }),
}));
vi.mock('./supabase', () => ({ supabase: { auth } }));
vi.mock('./data', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  usePlacesQuery: (me: string | null | undefined) => { world.askedAs.push(me); return world.places; },
  useCollectionsQuery: () => world.collections,
  useCuratorAvatarsQuery: () => fetch({ data: {} as unknown as unknown[] }),
  useCategoryTermsQuery: () => fetch({ data: {} as unknown as unknown[] }),
  useLikeCountsQuery: () => world.likeCounts,
  useMyLikesQuery: (me: string | null | undefined) => { world.likesFor.push(me); return world.myLikes; },
  likeCollection: writes.like,
  unlikeCollection: writes.unlike,
}));

import { CatalogProvider, useLikes } from './catalog';

const OLD = Date.now() - 10 * 60 * 1000;

beforeEach(() => {
  world.places = fetch();
  world.collections = fetch();
  world.authCb = null;
  world.appStateCb = null;
  world.sessionResolved = 0;
  world.me = 'u1';
  world.userId = undefined;
  world.askedAs = [];
  world.likesFor = [];
  // Counted a second ago, so a tap made now is newer than the tally and
  // shows in it — the rule `countsNow` keeps.
  world.likeCounts = fetch({ data: { 'hue-noodles': 3 } as unknown as unknown[], loadedAt: Date.now() - 1000 });
  world.myLikes = fetch({ data: [] });
  writes.like.mockReset().mockResolvedValue(true);
  writes.unlike.mockReset().mockResolvedValue(true);
  auth.getSession.mockClear();
  vi.spyOn(AppState, 'addEventListener').mockImplementation((_type, fn) => {
    world.appStateCb = fn as (s: string) => void;
    return { remove: () => {} } as unknown as ReturnType<typeof AppState.addEventListener>;
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const mount = () => render(<CatalogProvider><></></CatalogProvider>);
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

// ── who the catalog is asked for ──
//
// The session can be a network round trip away at launch. The catalog
// used to be asked for as a guest in that gap and again as the reader
// when it landed — two fetches, and a cache key that changed under the
// first paint. It is asked for as `Auth.userId` now, which is the reader
// the last launch ended on until the session says otherwise.
describe('who the catalog is asked for', () => {
  it('the reader the last launch remembered, while the session is still being read', () => {
    world.me = null;
    world.userId = 'u1';
    mount();
    expect(world.askedAs.at(-1)).toBe('u1');
    expect(world.likesFor.at(-1)).toBe('u1');
  });

  it('nobody yet — not a guest — while neither is known', () => {
    world.me = null;
    world.userId = undefined;
    mount();
    expect(world.askedAs.at(-1)).toBeUndefined();
  });

  it('the session’s reader, whoever was remembered', () => {
    world.me = 'u2';
    world.userId = 'u1';
    mount();
    expect(world.askedAs.at(-1)).toBe('u2');
  });
});

describe('coming back to the foreground', () => {
  it('refreshes the session before it refreshes a stale catalog', async () => {
    world.places = fetch({ loadedAt: OLD });
    world.collections = fetch({ loadedAt: OLD });
    mount();
    act(() => { world.appStateCb!('active'); });
    // Synchronously after the event: the session is being asked for and
    // no read has gone out yet.
    expect(auth.getSession).toHaveBeenCalledOnce();
    expect(world.places.reload).not.toHaveBeenCalled();
    await flush();
    expect(world.places.reload).toHaveBeenCalledOnce();
    expect(world.collections.reload).toHaveBeenCalledOnce();
  });

  it('leaves a fresh catalog alone, and one already loading', async () => {
    world.places = fetch({ loadedAt: Date.now() });
    world.collections = fetch({ loadedAt: OLD, loading: true });
    mount();
    act(() => { world.appStateCb!('active'); });
    await flush();
    expect(world.places.reload).not.toHaveBeenCalled();
    expect(world.collections.reload).not.toHaveBeenCalled();
  });

  it('does nothing on the way to the background', async () => {
    world.places = fetch({ loadedAt: OLD });
    mount();
    act(() => { world.appStateCb!('background'); });
    await flush();
    expect(auth.getSession).not.toHaveBeenCalled();
    expect(world.places.reload).not.toHaveBeenCalled();
  });
});

describe('when a new token lands', () => {
  it('asks again for a read that failed on the old one, and only that', () => {
    world.places = fetch({ error: 'JWT expired' });
    world.collections = fetch({ error: 'Network request failed' });
    mount();
    act(() => { world.authCb!('TOKEN_REFRESHED'); });
    expect(world.places.reload).toHaveBeenCalledOnce();
    expect(world.collections.reload).not.toHaveBeenCalled();
  });

  it('does not pile onto a retry already in flight', () => {
    world.places = fetch({ error: 'JWT expired', loading: true });
    mount();
    act(() => { world.authCb!('TOKEN_REFRESHED'); });
    expect(world.places.reload).not.toHaveBeenCalled();
  });

  it('ignores every other auth event', () => {
    world.places = fetch({ error: 'JWT expired' });
    mount();
    act(() => { world.authCb!('SIGNED_IN'); world.authCb!('USER_UPDATED'); });
    expect(world.places.reload).not.toHaveBeenCalled();
  });
});

describe('the heart', () => {
  const list = { id: 'c1', slug: 'hue-noodles' };
  let seen: ReturnType<typeof useLikes>;
  const Reader = () => { seen = useLikes(); return null; };
  const mountReader = () => render(<CatalogProvider><Reader /></CatalogProvider>);

  it('moves the heart and the tally at once, before the server answers', async () => {
    let answer: (ok: boolean) => void = () => {};
    writes.like.mockImplementation(() => new Promise<boolean>((r) => { answer = r; }));
    mountReader();
    let done: Promise<void> = Promise.resolve();
    act(() => { done = seen.toggleLike(list); });
    expect(writes.like).toHaveBeenCalledWith('c1', 'u1');
    expect(seen.myLikes).toContain('c1');
    expect(seen.likes['hue-noodles']).toBe(4);
    // Nothing is asked again until the write has landed.
    expect(world.likeCounts.reload).not.toHaveBeenCalled();
    await act(async () => { answer(true); await done; });
    // Both at once: a count refetched without your own set is a filled
    // heart beside a number that has not moved.
    expect(world.likeCounts.reload).toHaveBeenCalledOnce();
    expect(world.myLikes.reload).toHaveBeenCalledOnce();
  });

  it('takes back a like that is already there', async () => {
    world.myLikes = fetch({ data: ['c1'] });
    mountReader();
    await act(async () => { await seen.toggleLike(list); });
    expect(writes.unlike).toHaveBeenCalledWith('c1', 'u1');
    expect(writes.like).not.toHaveBeenCalled();
    expect(seen.myLikes).not.toContain('c1');
    expect(seen.likes['hue-noodles']).toBe(2);
  });

  it('falls back to the server’s answer when the write is refused', async () => {
    writes.like.mockResolvedValue(false);
    mountReader();
    await act(async () => { await seen.toggleLike(list); });
    // The server still says not liked, and with the tap dropped that is
    // what shows — rather than a heart the database does not hold.
    expect(seen.myLikes).not.toContain('c1');
    expect(seen.likes['hue-noodles']).toBe(3);
    expect(world.myLikes.reload).toHaveBeenCalledOnce();
  });

  it('sends one write for a double tap', async () => {
    let answer: (ok: boolean) => void = () => {};
    writes.like.mockImplementation(() => new Promise<boolean>((r) => { answer = r; }));
    mountReader();
    let first: Promise<void> = Promise.resolve();
    act(() => { first = seen.toggleLike(list); });
    await act(async () => { await seen.toggleLike(list); });
    expect(writes.like).toHaveBeenCalledOnce();
    expect(writes.unlike).not.toHaveBeenCalled();
    await act(async () => { answer(true); await first; });
    // And the id is free again once the write has landed.
    await act(async () => { await seen.toggleLike(list); });
    expect(writes.unlike).toHaveBeenCalledOnce();
  });

  it('does nothing for a guest, who has no likes of their own', async () => {
    world.me = null;
    mountReader();
    await act(async () => { await seen.toggleLike(list); });
    expect(writes.like).not.toHaveBeenCalled();
    expect(seen.myLikes).toEqual([]);
  });
});
