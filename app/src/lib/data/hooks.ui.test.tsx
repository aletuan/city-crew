// @vitest-environment jsdom
//
// The launch, as the reader's own queries see it.
//
// Two things used to make a cold start look like it loaded twice. The
// catalog was asked for as a guest while the session was still being
// read and again as the reader once it landed — two ~900 KB fetches,
// and a key change between them that put the hydrated list back to
// skeletons. And the reader's own answers — their lists, their likes,
// their preferences — were not remembered at all, so the list the cache
// had drawn re-sorted itself a round trip later as their taste arrived,
// and bookmarks filled in one by one.
//
// The queries are stood in for; what is under test is which question each
// hook asks, when, and under which key its answer is kept.

import React, { useEffect } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, render, waitFor } from '../../uitest/render';
import { cacheKey, packCache } from './cache';
import type { Fetch } from './fetch';

const q = vi.hoisted(() => ({
  fetchPlaces: vi.fn(),
  fetchMyCollections: vi.fn(),
  fetchMyLikes: vi.fn(),
  fetchPreferences: vi.fn(),
}));
vi.mock('../city', () => ({ useCity: () => ({ city: { id: 'hcmc' } }) }));
vi.mock('./places', () => ({
  fetchPlaces: q.fetchPlaces, fetchCategoryTerms: vi.fn(), fetchPlaceBySlug: vi.fn(),
}));
vi.mock('./collections', () => ({
  fetchMyCollections: q.fetchMyCollections, fetchMyLikes: q.fetchMyLikes,
  fetchCollections: vi.fn(), fetchLikeCounts: vi.fn(),
}));
vi.mock('./preferences', async () => ({
  fetchPreferences: q.fetchPreferences,
  NO_PREFERENCES: { categories: [], budget_vnd: null, history_on: true },
}));
vi.mock('./people', () => ({ fetchCuratorAvatars: vi.fn(), profileByHandle: vi.fn() }));

import { useMyCollections, useMyLikesQuery, useMyPreferences, usePlacesQuery } from './hooks';

/** A request the test answers when it chooses — or never. */
function held<T>() {
  let answer!: (v: T) => void;
  const promise = new Promise<T>((r) => { answer = r; });
  return { promise, answer };
}

// What each hook last handed back, written from an effect so the probes
// stay pure components.
const seen: Record<string, Fetch<unknown>> = {};
function Probe<T>({ name, use }: { name: string; use: () => Fetch<T> }) {
  const f = use();
  useEffect(() => { seen[name] = f as Fetch<unknown>; });
  return null;
}

const place = (slug: string) => ({ slug });
const list = (slug: string) => ({ slug, collection_places: [] });

beforeEach(async () => {
  for (const f of Object.values(q)) f.mockReset();
  for (const k of Object.keys(seen)) delete seen[k];
  for (const kind of ['places', 'mine', 'likes', 'prefs']) {
    for (const who of [null, 'u1', 'u2']) {
      await AsyncStorage.removeItem(cacheKey(kind, kind === 'places' ? 'hcmc' : 'all', who));
    }
  }
  vi.mocked(AsyncStorage.getItem).mockClear();
  vi.mocked(AsyncStorage.setItem).mockClear();
});

describe('the catalog, before and after the reader is known', () => {
  function Places({ me }: { me: string | null | undefined }) {
    const f = usePlacesQuery(me);
    useEffect(() => { seen.places = f as Fetch<unknown>; });
    return null;
  }

  it('asks nothing, and reads no cache, while the reader is unknown', async () => {
    render(<Places me={undefined} />);
    await act(async () => {});
    expect(q.fetchPlaces).not.toHaveBeenCalled();
    expect(AsyncStorage.getItem).not.toHaveBeenCalled();
    expect(seen.places.loaded).toBe(false);
  });

  // The launch this fixes: unknown, then the remembered reader, then the
  // session agreeing with it. One question, asked once.
  it('asks once, as the reader, when the session agrees with the one remembered', async () => {
    q.fetchPlaces.mockResolvedValue([place('cong-caphe')]);
    const view = render(<Places me={undefined} />);
    view.rerender(<Places me="u1" />);
    await waitFor(() => expect(seen.places.data).toEqual([place('cong-caphe')]));
    view.rerender(<Places me="u1" />);
    await act(async () => {});
    expect(q.fetchPlaces).toHaveBeenCalledOnce();
    expect(q.fetchPlaces).toHaveBeenCalledWith('hcmc', 'u1');
  });

  it('asks as a guest once it is known there is nobody', async () => {
    q.fetchPlaces.mockResolvedValue([]);
    render(<Places me={null} />);
    await waitFor(() => expect(q.fetchPlaces).toHaveBeenCalledWith('hcmc', null));
  });

  it('opens on the reader’s own cached catalog, not the guest’s', async () => {
    await AsyncStorage.setItem(cacheKey('places', 'hcmc', null), packCache([place('guest-view')], Date.now()));
    await AsyncStorage.setItem(cacheKey('places', 'hcmc', 'u1'), packCache([place('with-mine')], Date.now()));
    q.fetchPlaces.mockReturnValue(held().promise);
    const view = render(<Places me={undefined} />);
    view.rerender(<Places me="u1" />);
    await waitFor(() => expect(seen.places.data).toEqual([place('with-mine')]));
    expect(seen.places.fromCache).toBe(true);
  });
});

describe('the reader’s own answers, remembered per account', () => {
  it('opens with their lists from the last launch, then the network’s', async () => {
    await AsyncStorage.setItem(cacheKey('mine', 'all', 'u1'), packCache([list('weekend')], Date.now()));
    const net = held<unknown[]>();
    q.fetchMyCollections.mockReturnValue(net.promise);
    render(<Probe name="mine" use={() => useMyCollections('u1')} />);
    await waitFor(() => expect(seen.mine.data).toEqual([list('weekend')]));
    expect(seen.mine.fromCache).toBe(true);
    await act(async () => { net.answer([list('weekend'), list('near-work')]); });
    expect(seen.mine.data).toEqual([list('weekend'), list('near-work')]);
    expect(await AsyncStorage.getItem(cacheKey('mine', 'all', 'u1'))).toContain('near-work');
  });

  it('opens with their likes from the last launch', async () => {
    await AsyncStorage.setItem(cacheKey('likes', 'all', 'u1'), packCache(['c-1', 'c-2'], Date.now()));
    q.fetchMyLikes.mockReturnValue(held().promise);
    render(<Probe name="likes" use={() => useMyLikesQuery('u1')} />);
    await waitFor(() => expect(seen.likes.data).toEqual(['c-1', 'c-2']));
    expect(q.fetchMyLikes).toHaveBeenCalledWith('u1');
  });

  it('never opens on another account’s answers', async () => {
    await AsyncStorage.setItem(cacheKey('mine', 'all', 'u2'), packCache([list('theirs')], Date.now()));
    await AsyncStorage.setItem(cacheKey('likes', 'all', 'u2'), packCache(['theirs'], Date.now()));
    q.fetchMyCollections.mockReturnValue(held().promise);
    q.fetchMyLikes.mockReturnValue(held().promise);
    render(<>
      <Probe name="mine" use={() => useMyCollections('u1')} />
      <Probe name="likes" use={() => useMyLikesQuery('u1')} />
    </>);
    await act(async () => {});
    expect(seen.mine.data).toEqual([]);
    expect(seen.likes.data).toEqual([]);
  });

  // Signed out there is no key, so nothing is read and nothing written:
  // an empty answer is not an answer worth keeping, and a guest's key
  // would be one every guest on the device shared.
  it('keeps nothing for nobody', async () => {
    render(<>
      <Probe name="mine" use={() => useMyCollections(null)} />
      <Probe name="likes" use={() => useMyLikesQuery(null)} />
      <Probe name="prefs" use={() => useMyPreferences(null)} />
    </>);
    await waitFor(() => expect(seen.prefs?.loaded).toBe(true));
    expect(seen.mine.data).toEqual([]);
    expect(seen.likes.data).toEqual([]);
    expect(seen.prefs.data).toEqual({ categories: [], budget_vnd: null, history_on: true });
    expect(AsyncStorage.getItem).not.toHaveBeenCalled();
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
    expect(q.fetchMyCollections).not.toHaveBeenCalled();
  });
});

describe('preferences, which are one row rather than a list', () => {
  const prefs = { categories: ['cafes'], budget_vnd: null, history_on: false };

  it('opens with the stored row, handed back as the row and not as a list', async () => {
    await AsyncStorage.setItem(cacheKey('prefs', 'all', 'u1'), packCache([prefs], Date.now()));
    q.fetchPreferences.mockReturnValue(held().promise);
    render(<Probe name="prefs" use={() => useMyPreferences('u1')} />);
    await waitFor(() => expect(seen.prefs.data).toEqual(prefs));
    expect(seen.prefs.fromCache).toBe(true);
    expect(q.fetchPreferences).toHaveBeenCalledWith('u1');
  });

  it('keeps what the network said as a list of one, which is what the cache reads back', async () => {
    q.fetchPreferences.mockResolvedValue(prefs);
    render(<Probe name="prefs" use={() => useMyPreferences('u1')} />);
    await waitFor(() => expect(seen.prefs.data).toEqual(prefs));
    await waitFor(() => expect(AsyncStorage.setItem).toHaveBeenCalled());
    const stored = JSON.parse((await AsyncStorage.getItem(cacheKey('prefs', 'all', 'u1')))!);
    expect(stored.data).toEqual([prefs]);
  });

  // A list that parsed but held no row — nothing this code writes, but the
  // cache is trusted only as far as its envelope. The screens read
  // `.categories` off whatever this returns.
  it('reads an empty stored list as the empty preferences, not as nothing', async () => {
    await AsyncStorage.setItem(cacheKey('prefs', 'all', 'u1'), packCache([], Date.now()));
    q.fetchPreferences.mockReturnValue(held().promise);
    render(<Probe name="prefs" use={() => useMyPreferences('u1')} />);
    await waitFor(() => expect(seen.prefs.fromCache).toBe(true));
    expect(seen.prefs.data).toEqual({ categories: [], budget_vnd: null, history_on: true });
  });
});
