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
}));
const auth = vi.hoisted(() => ({
  getSession: vi.fn(async () => { world.sessionResolved += 1; return { data: { session: null } }; }),
  onAuthStateChange: vi.fn((cb: (event: string) => void) => {
    world.authCb = cb;
    return { data: { subscription: { unsubscribe: () => {} } } };
  }),
}));

vi.mock('./auth', () => ({ useAuth: () => ({ session: { user: { id: 'u1' } } }) }));
vi.mock('./supabase', () => ({ supabase: { auth } }));
vi.mock('./data', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  usePlacesQuery: () => world.places,
  useCollectionsQuery: () => world.collections,
  useCuratorAvatarsQuery: () => fetch({ data: {} as unknown as unknown[] }),
  useCategoryTermsQuery: () => fetch({ data: {} as unknown as unknown[] }),
  useLikeCountsQuery: () => fetch({ data: {} as unknown as unknown[] }),
  useMyLikesQuery: () => fetch(),
}));

import { CatalogProvider } from './catalog';

const OLD = Date.now() - 10 * 60 * 1000;

beforeEach(() => {
  world.places = fetch();
  world.collections = fetch();
  world.authCb = null;
  world.appStateCb = null;
  world.sessionResolved = 0;
  auth.getSession.mockClear();
  vi.spyOn(AppState, 'addEventListener').mockImplementation((_type, fn) => {
    world.appStateCb = fn as (s: string) => void;
    return { remove: () => {} } as unknown as ReturnType<typeof AppState.addEventListener>;
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const mount = () => render(<CatalogProvider><></></CatalogProvider>);
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

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
