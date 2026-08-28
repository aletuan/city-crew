// @vitest-environment jsdom
//
// The crew provider's promises, rendered.
//
// Three of them lived only as prose in crew.tsx and nothing held them:
// the question is held until auth decides who is asking; the launch
// snapshot paints first and the network wins; and — the one #381 added
// after the flicker — a recount that comes back identical looks nothing
// up again. The last one is the reason this file exists: the Crew screen
// recounts on every visit now, and the day the fingerprint guard falls
// out, the avatar rows go back to settling in front of the reader with
// no red test to say so.

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, screen, waitFor } from '../uitest/render';
import { cacheKey, packCache } from './data/cache';
import type { FriendProfile } from './data';
import type { FriendshipRow } from './friends';

const world = vi.hoisted(() => ({
  ready: true,
  session: { user: { id: 'u1' } } as { user: { id: string } } | null,
  edges: [] as unknown[],
}));
// A copy per call, the way a network answer is a fresh array every time.
const fetchFriendships = vi.hoisted(() => vi.fn(async () => [...world.edges]));
const fetchMyBlocks = vi.hoisted(() => vi.fn(async () => [] as string[]));
const fetchProfilesById = vi.hoisted(() => vi.fn(async (ids: string[]) => Object.fromEntries(
  ids.map((id) => [id, { id, handle: id, full_name: id, avatar_url: '' }]),
)));
const fetchMutualSaves = vi.hoisted(() => vi.fn(async (others: string[]) => Object.fromEntries(
  others.map((id) => [id, 2]),
)));

vi.mock('./auth', () => ({ useAuth: () => ({ ready: world.ready, session: world.session }) }));
// The fetch hooks stay real on purpose: these tests exercise the actual
// usePersistedFetch machinery — the cache envelope, the fresh-answer-wins
// rule — with only the network swapped out.
vi.mock('./data', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  fetchFriendships,
  fetchMyBlocks,
  fetchProfilesById,
  fetchMutualSaves,
}));

import { CrewProvider, useCrew } from './crew';

const edge = (
  requester: string,
  addressee: string,
  status: 'pending' | 'accepted' = 'accepted',
  at = '2026-08-28T00:00:00Z',
): FriendshipRow => ({ requester, addressee, status, created_at: at });

/** A consumer, because `useCrew` is the whole surface under test. */
function Probe() {
  const { ships, people, mutual, absorb } = useCrew();
  return (
    <>
      <span data-testid="edges">{String(ships.data.length)}</span>
      <span data-testid="cache">{String(ships.fromCache)}</span>
      <span data-testid="faces">{Object.keys(people).sort().join(',')}</span>
      <span data-testid="mutual">{String(mutual.f1 ?? '')}</span>
      <button type="button" onClick={() => ships.reload()}>recount</button>
      <button
        type="button"
        onClick={() => absorb({ s9: { id: 's9', handle: 's9', full_name: 'Suggested', avatar_url: '' } as FriendProfile })}
      >
        absorb
      </button>
    </>
  );
}

const mount = () => render(<CrewProvider><Probe /></CrewProvider>);
const recount = () => fireEvent.click(screen.getByText('recount'));

beforeEach(() => {
  world.ready = true;
  world.session = { user: { id: 'u1' } };
  world.edges = [edge('u1', 'f1')];
  fetchFriendships.mockClear();
  fetchMyBlocks.mockClear();
  fetchProfilesById.mockClear();
  fetchMutualSaves.mockClear();
});

describe('who is asking', () => {
  // The trap crew.tsx documents: "no session yet" resolving instantly to
  // an empty crew would stamp loadedAt and lock the snapshot out on the
  // one launch it exists for. Held means the network is never even asked.
  it('holds the question until auth has decided', async () => {
    world.ready = false;
    mount();
    await waitFor(() => expect(screen.getByTestId('edges').textContent).toBe('0'));
    expect(fetchFriendships).not.toHaveBeenCalled();
  });

  it('signing out takes the crew with it', async () => {
    const view = mount();
    await waitFor(() => expect(screen.getByTestId('faces').textContent).toBe('f1'));
    world.session = null;
    world.edges = [];
    view.rerender(<CrewProvider><Probe /></CrewProvider>);
    await waitFor(() => expect(screen.getByTestId('faces').textContent).toBe(''));
    await waitFor(() => expect(screen.getByTestId('edges').textContent).toBe('0'));
  });
});

describe('the launch snapshot', () => {
  it('paints the last session first, then lets the network win', async () => {
    // Its own account, so the shared in-memory storage of the suite can
    // never hand this test another test's stash.
    world.session = { user: { id: 'u2' } };
    world.edges = [edge('u2', 'f1'), edge('u2', 'f2')];
    await AsyncStorage.setItem(
      cacheKey('friendships', 'all', 'u2'),
      packCache([edge('u2', 'old-friend')], Date.now()),
    );
    // The network held open, so the snapshot's paint is observable
    // instead of a race the fetch happens to win.
    let free!: (rows: FriendshipRow[]) => void;
    fetchFriendships.mockImplementationOnce(() => new Promise((res) => { free = res; }));

    mount();
    await waitFor(() => expect(screen.getByTestId('cache').textContent).toBe('true'));
    expect(screen.getByTestId('edges').textContent).toBe('1');

    free(world.edges as FriendshipRow[]);
    await waitFor(() => expect(screen.getByTestId('edges').textContent).toBe('2'));
    expect(screen.getByTestId('cache').textContent).toBe('false');
    // Faces were looked up once, for the fresh answer — the hydrated pass
    // is skipped, exactly as the effect's comment promises.
    expect(fetchProfilesById).toHaveBeenCalledTimes(1);
  });
});

describe('the recount', () => {
  // The #381 pin. The Crew screen asks again on every visit; an answer
  // that comes back identical must cost nothing downstream — no faces
  // lookup, no mutual-saves RPC, no rows settling in front of the reader.
  it('an identical answer looks nothing up again', async () => {
    mount();
    // The baseline is the lookup itself, not the faces row. This is u1,
    // whose stash an earlier test persisted, so 'f1' can paint from the
    // snapshot before the network answer has landed — CI once read the
    // call count at exactly that moment and found 0. Waiting on the call
    // is also self-diagnosing: a mount that genuinely never looks up
    // fails here as "never reached 1", not two lines downstream.
    await waitFor(() => expect(fetchProfilesById).toHaveBeenCalledTimes(1), { timeout: 5000 });
    await waitFor(() => expect(fetchMutualSaves).toHaveBeenCalledTimes(1), { timeout: 5000 });

    recount();
    await waitFor(() => expect(fetchFriendships).toHaveBeenCalledTimes(2));
    // calledTimes(2) counts the ask, not the answer. Await the answer's
    // own promise, then let a polled pass flush its commit and effects —
    // a wrongful lookup fires inside that effect, so it is visible to
    // the pins below rather than landing just after them.
    await fetchFriendships.mock.results[1]!.value;
    await waitFor(() => expect(screen.getByTestId('edges').textContent).toBe('1'));
    expect(fetchProfilesById).toHaveBeenCalledTimes(1);
    expect(fetchMutualSaves).toHaveBeenCalledTimes(1);
  });

  it('a changed crew brings fresh faces', async () => {
    mount();
    // The same baseline discipline as above, so the "2" below can only
    // ever mean "one more than the mount's".
    await waitFor(() => expect(fetchProfilesById).toHaveBeenCalledTimes(1), { timeout: 5000 });

    world.edges = [edge('u1', 'f1'), edge('u1', 'f2')];
    recount();
    await waitFor(() => expect(screen.getByTestId('faces').textContent).toBe('f1,f2'));
    expect(fetchProfilesById).toHaveBeenCalledTimes(2);
    expect(fetchProfilesById.mock.calls[1][0]).toContain('f2');
  });
});

describe('absorb', () => {
  // A screen that fetched profiles for its own reasons hands them in, so
  // the next screen already has the face — merged, not looked up.
  it('hands a face to the next screen without a lookup', async () => {
    // Its own account: the faces snapshot persists across the suite's
    // shared in-memory storage, and absorb merges over whatever a stash
    // from an earlier test painted — an account nobody else used is what
    // makes "exactly f1, then s9 joins" assertable.
    world.session = { user: { id: 'u4' } };
    world.edges = [edge('u4', 'f1')];
    mount();
    await waitFor(() => expect(screen.getByTestId('faces').textContent).toBe('f1'));
    fireEvent.click(screen.getByText('absorb'));
    await waitFor(() => expect(screen.getByTestId('faces').textContent).toBe('f1,s9'));
    expect(fetchProfilesById).toHaveBeenCalledTimes(1);
  });
});
