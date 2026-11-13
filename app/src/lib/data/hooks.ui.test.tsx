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
import { type Fetch, forgetSharedFetches } from './fetch';

const q = vi.hoisted(() => ({
  fetchPlaces: vi.fn(),
  fetchMyCollections: vi.fn(),
  fetchSharedWithMe: vi.fn(),
  fetchMyLikes: vi.fn(),
  fetchPreferences: vi.fn(),
  fetchMyListShares: vi.fn(),
  fetchLikeCounts: vi.fn(),
  fetchApplause: vi.fn(),
  fetchCopies: vi.fn(),
}));
// The count, as a plain function rather than a `vi.fn`: a spy attaches
// its own handler to every promise it returns, to record how it settled,
// and so would quietly catch the refusal the hook is meant to catch.
const views = vi.hoisted(() => ({ counted: [] as string[], refuse: false }));
vi.mock('../city', () => {
  const m = { useCity: () => ({ city: { id: 'hcmc' } }) };
  const all = () => (m as { useCity: () => object }).useCity();
  return { ...m, useCurrentCity: all, useCityList: all };
});
vi.mock('./places', () => ({
  fetchPlaces: q.fetchPlaces, fetchCategoryTerms: vi.fn(), fetchPlaceBySlug: vi.fn(),
}));
vi.mock('./collections', () => ({
  fetchMyCollections: q.fetchMyCollections, fetchMyLikes: q.fetchMyLikes, fetchSharedWithMe: q.fetchSharedWithMe,
  fetchCollections: vi.fn(), fetchLikeCounts: q.fetchLikeCounts,
}));
vi.mock('./preferences', async () => ({
  fetchPreferences: q.fetchPreferences,
  NO_PREFERENCES: { categories: [], budget_vnd: null, history_on: true },
}));
vi.mock('./people', () => ({
  fetchCuratorAvatars: vi.fn(), profileByHandle: vi.fn(), fetchApplause: q.fetchApplause, fetchCopies: q.fetchCopies,
}));
vi.mock('./shares', () => ({ fetchMyListShares: q.fetchMyListShares }));
vi.mock('./stats', () => ({
  recordCollectionView: (id: string) => {
    views.counted.push(id);
    return views.refuse ? Promise.reject(new Error('offline')) : Promise.resolve();
  },
}));

import {
  type ListActivityQuery, useCountView, useLikeCountsQuery, useListActivityQuery, useMyCollections, usePrefetchListActivity, useMyLikesQuery, useMyListShares, useMyPreferences, usePlacesQuery, useSharedWithMe,
} from './hooks';

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
  for (const kind of ['places', 'mine', 'shared', 'likes', 'prefs']) {
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

  // Under a key of their own, beside `mine`: one account's lists and the
  // lists friends gave it are two answers, and one must never be read as
  // the other.
  it('opens with the lists shared with them from the last launch, under their own key', async () => {
    await AsyncStorage.setItem(cacheKey('shared', 'all', 'u1'), packCache([list('from-lan')], Date.now()));
    await AsyncStorage.setItem(cacheKey('mine', 'all', 'u1'), packCache([list('my-own')], Date.now()));
    const net = held<unknown[]>();
    q.fetchSharedWithMe.mockReturnValue(net.promise);
    render(<Probe name="shared" use={() => useSharedWithMe('u1')} />);
    await waitFor(() => expect(seen.shared.data).toEqual([list('from-lan')]));
    expect(q.fetchSharedWithMe).toHaveBeenCalledWith('u1');
    await act(async () => { net.answer([list('from-minh')]); });
    expect(seen.shared.data).toEqual([list('from-minh')]);
    expect(await AsyncStorage.getItem(cacheKey('shared', 'all', 'u1'))).toContain('from-minh');
  });

  // The owner's shares, under a key of their own: a shared list drawn as
  // Private for a round trip and Friends after it is a lock opening on a
  // list the owner already shared.
  it('opens with the shares on their lists from the last launch, under their own key', async () => {
    const row = (user_id: string) => ({ collection_id: 'c1', user_id, created_at: 'x' });
    await AsyncStorage.setItem(cacheKey('shares', 'all', 'u1'), packCache([row('lan')], Date.now()));
    const net = held<unknown[]>();
    q.fetchMyListShares.mockReturnValue(net.promise);
    render(<Probe name="shares" use={() => useMyListShares('u1')} />);
    await waitFor(() => expect(seen.shares.data).toEqual([row('lan')]));
    expect(q.fetchMyListShares).toHaveBeenCalledWith('u1');
    await act(async () => { net.answer([row('minh')]); });
    expect(seen.shares.data).toEqual([row('minh')]);
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
      <Probe name="shared" use={() => useSharedWithMe(null)} />
      <Probe name="shares" use={() => useMyListShares(null)} />
    </>);
    await waitFor(() => expect(seen.prefs?.loaded).toBe(true));
    await waitFor(() => expect(seen.shared?.loaded).toBe(true));
    expect(seen.shared.data).toEqual([]);
    expect(q.fetchSharedWithMe).not.toHaveBeenCalled();
    await waitFor(() => expect(seen.shares?.loaded).toBe(true));
    expect(seen.shares.data).toEqual([]);
    expect(q.fetchMyListShares).not.toHaveBeenCalled();
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

// The like counts (13 Nov 2026): your own lists and the ones shared with
// you are counted for you alone, so the counts are a question per reader.
// Fetched once for the app's life, a launch that asked before the session
// landed kept a private list's kept likes blank until a tap refetched.
describe('the like counts, per reader', () => {
  function Counts({ me }: { me: string | null | undefined }) {
    const f = useLikeCountsQuery(me);
    useEffect(() => { seen.counts = f as Fetch<unknown>; });
    return null;
  }
  const tally = (n: number) => ({ shown: { mine: n }, ranked: { mine: n } });

  it('asks again when the reader changes, and not on a render that changes nothing', async () => {
    q.fetchLikeCounts.mockResolvedValueOnce(tally(0)).mockResolvedValueOnce(tally(3)).mockResolvedValueOnce(tally(0));
    const view = render(<Counts me={null} />);
    await waitFor(() => expect(seen.counts.data).toEqual(tally(0)));
    view.rerender(<Counts me="u1" />);
    await waitFor(() => expect(seen.counts.data).toEqual(tally(3)));
    view.rerender(<Counts me="u1" />);
    await act(async () => {});
    expect(q.fetchLikeCounts).toHaveBeenCalledTimes(2);
    // Signed out again: asked again, and the reader's count goes with them.
    view.rerender(<Counts me={null} />);
    await waitFor(() => expect(seen.counts.data).toEqual(tally(0)));
    expect(q.fetchLikeCounts).toHaveBeenCalledTimes(3);
  });
});

// The owner's activity (13 Nov 2026): every like and copy on their lists,
// all time, asked once and kept for every list's activity page — and
// asked ahead from the collection page, so the tap opens on the answer.
// `useSharedFetch`'s own rules are `fetch.ui.test`'s; these pin what this
// hook asks, under which keys, and that its two halves stay apart.
describe('the owner’s activity, kept and shared', () => {
  const EPOCH = '1970-01-01T00:00:00.000Z';
  const likeRow = (h: string) => ({ collection_id: 'c1', liked_at: '2026-11-13T10:00:00Z', liker_handle: h, liker_name: null });
  const copyRow = (h: string) => ({ collection_id: 'c1', copied_at: '2026-11-13T09:00:00Z', copier_handle: h, copier_name: null });
  const got: { q?: ListActivityQuery; frames: string[] } = { frames: [] };
  /** Every render's halves and whether both are settled, so a test can
   *  say what the very first one drew — written from render, not an
   *  effect, because the first frame is the point. */
  const record = (a: ListActivityQuery) => {
    got.q = a;
    got.frames.push(`${a.likes.data.map((l) => l.liker_handle).join(',')}/${a.copies.data.map((c) => c.copier_handle).join(',')}|${a.likes.loaded && a.copies.loaded}`);
  };
  function Activity({ owner }: { owner: string | null }) {
    record(useListActivityQuery(owner));
    return null;
  }
  function Prefetch({ owner }: { owner: string | null }) {
    usePrefetchListActivity(owner);
    return null;
  }

  beforeEach(async () => {
    forgetSharedFetches();
    got.q = undefined;
    got.frames = [];
    for (const who of ['u1', 'u2']) {
      await AsyncStorage.removeItem(cacheKey('likesonmine', 'all', who));
      await AsyncStorage.removeItem(cacheKey('copiesofmine', 'all', who));
    }
  });

  it('asks both functions from the epoch, once each, and keeps each answer under the owner', async () => {
    q.fetchApplause.mockResolvedValue([likeRow('lan')]);
    q.fetchCopies.mockResolvedValue([copyRow('minh')]);
    render(<Activity owner="u1" />);
    await waitFor(() => expect(got.q!.likes.data).toEqual([likeRow('lan')]));
    await waitFor(() => expect(got.q!.copies.data).toEqual([copyRow('minh')]));
    expect(q.fetchApplause).toHaveBeenCalledExactlyOnceWith(EPOCH);
    expect(q.fetchCopies).toHaveBeenCalledExactlyOnceWith(EPOCH);
    await waitFor(async () => {
      expect(JSON.parse((await AsyncStorage.getItem(cacheKey('likesonmine', 'all', 'u1')))!).data).toEqual([likeRow('lan')]);
      expect(JSON.parse((await AsyncStorage.getItem(cacheKey('copiesofmine', 'all', 'u1')))!).data).toEqual([copyRow('minh')]);
    });
  });

  it('on a miss, settles only once both halves have answered', async () => {
    const likes = held<unknown[]>();
    q.fetchApplause.mockReturnValue(likes.promise);
    q.fetchCopies.mockResolvedValue([copyRow('minh')]);
    render(<Activity owner="u1" />);
    await waitFor(() => expect(got.q!.copies.loaded).toBe(true));
    expect(got.q!.likes.loaded).toBe(false);
    await act(async () => { likes.answer([likeRow('lan')]); });
    expect(got.frames.at(-1)).toBe('lan/minh|true');
  });

  it('on a hit, draws the kept answer on the first render and refreshes it behind', async () => {
    q.fetchApplause.mockResolvedValueOnce([likeRow('lan')]);
    q.fetchCopies.mockResolvedValueOnce([copyRow('minh')]);
    const first = render(<Activity owner="u1" />);
    await waitFor(() => expect(got.frames.at(-1)).toBe('lan/minh|true'));
    first.unmount();
    got.frames = [];

    const likes = held<unknown[]>();
    q.fetchApplause.mockReturnValueOnce(likes.promise);
    q.fetchCopies.mockResolvedValueOnce([copyRow('minh')]);
    render(<Activity owner="u1" />);
    expect(got.frames[0]).toBe('lan/minh|true');
    // The refresh is out, behind the rows.
    expect(got.q!.likes.loading).toBe(true);
    await act(async () => { likes.answer([likeRow('lan'), likeRow('an')]); });
    expect(got.frames.at(-1)).toBe('lan,an/minh|true');
    expect(q.fetchApplause).toHaveBeenCalledTimes(2);
  });

  it('opens a launch on the phone’s answer for this owner, and never another owner’s', async () => {
    await AsyncStorage.setItem(cacheKey('likesonmine', 'all', 'u2'), packCache([likeRow('theirs')], Date.now()));
    await AsyncStorage.setItem(cacheKey('likesonmine', 'all', 'u1'), packCache([likeRow('kept')], Date.now()));
    await AsyncStorage.setItem(cacheKey('copiesofmine', 'all', 'u1'), packCache([], Date.now()));
    q.fetchApplause.mockReturnValue(new Promise(() => {}));
    q.fetchCopies.mockReturnValue(new Promise(() => {}));
    render(<Activity owner="u1" />);
    await waitFor(() => expect(got.frames.at(-1)).toBe('kept/|true'));
    expect(got.q!.likes.fromCache).toBe(true);
  });

  it('keeps one half when the other fails, and says which failed', async () => {
    q.fetchApplause.mockRejectedValue(new Error('offline'));
    q.fetchCopies.mockResolvedValue([copyRow('minh')]);
    render(<Activity owner="u1" />);
    await waitFor(() => expect(got.q!.likes.error).toBe('offline'));
    await waitFor(() => expect(got.q!.copies.data).toEqual([copyRow('minh')]));
    expect(got.q!.copies.error).toBeNull();
  });

  it('asks both halves again on reload', async () => {
    q.fetchApplause.mockResolvedValue([]);
    q.fetchCopies.mockResolvedValue([]);
    render(<Activity owner="u1" />);
    await waitFor(() => expect(got.frames.at(-1)).toBe('/|true'));
    await act(async () => { got.q!.reload(); });
    expect(q.fetchApplause).toHaveBeenCalledTimes(2);
    expect(q.fetchCopies).toHaveBeenCalledTimes(2);
  });

  it('asks nothing with no owner', async () => {
    render(<Activity owner={null} />);
    await act(async () => {});
    expect(q.fetchApplause).not.toHaveBeenCalled();
    expect(q.fetchCopies).not.toHaveBeenCalled();
    expect(got.frames.at(-1)).toBe('/|true');
  });

  it('keeps each owner’s answer apart', async () => {
    q.fetchApplause.mockResolvedValueOnce([likeRow('ones')]).mockResolvedValueOnce([likeRow('twos')]);
    q.fetchCopies.mockResolvedValue([]);
    const view = render(<Activity owner="u1" />);
    await waitFor(() => expect(got.frames.at(-1)).toBe('ones/|true'));
    view.rerender(<Activity owner="u2" />);
    await waitFor(() => expect(got.frames.at(-1)).toBe('twos/|true'));
  });

  describe('asked ahead', () => {
    it('asks both from the epoch for the owner, and the page that opens after draws them at once', async () => {
      q.fetchApplause.mockResolvedValue([likeRow('lan')]);
      q.fetchCopies.mockResolvedValue([copyRow('minh')]);
      const page = render(<Prefetch owner="u1" />);
      await act(async () => {});
      expect(q.fetchApplause).toHaveBeenCalledExactlyOnceWith(EPOCH);
      expect(q.fetchCopies).toHaveBeenCalledExactlyOnceWith(EPOCH);
      page.unmount();
      render(<Activity owner="u1" />);
      expect(got.frames[0]).toBe('lan/minh|true');
    });

    it('is joined by the page when the tap beats the answer', async () => {
      const likes = held<unknown[]>();
      const copies = held<unknown[]>();
      q.fetchApplause.mockReturnValue(likes.promise);
      q.fetchCopies.mockReturnValue(copies.promise);
      render(<><Prefetch owner="u1" /><Activity owner="u1" /></>);
      expect(q.fetchApplause).toHaveBeenCalledTimes(1);
      expect(q.fetchCopies).toHaveBeenCalledTimes(1);
      await act(async () => { likes.answer([likeRow('lan')]); copies.answer([]); });
      expect(got.frames.at(-1)).toBe('lan/|true');
    });

    it('asks nothing for nobody, and asks when the owner becomes known', async () => {
      q.fetchApplause.mockResolvedValue([]);
      q.fetchCopies.mockResolvedValue([]);
      const view = render(<Prefetch owner={null} />);
      await act(async () => {});
      expect(q.fetchApplause).not.toHaveBeenCalled();
      view.rerender(<Prefetch owner="u1" />);
      await act(async () => {});
      expect(q.fetchApplause).toHaveBeenCalledTimes(1);
      expect(q.fetchCopies).toHaveBeenCalledTimes(1);
    });
  });
});

// One open of a list's page, one count (owner, 13 Nov 2026): per mount,
// once the list's id is known, and never a word to the reader if the
// count fails.
describe('an open of a list, counted', () => {
  beforeEach(() => { views.counted = []; views.refuse = false; });
  function Page({ id, tick }: { id: string | null | undefined; tick?: number }) {
    useCountView(id);
    void tick;
    return null;
  }

  it('counts the list once for the mount, whatever re-renders after', async () => {
    const view = render(<Page id="c1" tick={0} />);
    view.rerender(<Page id="c1" tick={1} />);
    view.rerender(<Page id="c1" tick={2} />);
    await act(async () => {});
    expect(views.counted).toEqual(['c1']);
  });

  it('waits for the id, and counts when it arrives', async () => {
    const view = render(<Page id={undefined} />);
    view.rerender(<Page id={null} />);
    await act(async () => {});
    expect(views.counted).toEqual([]);
    view.rerender(<Page id="c1" />);
    await act(async () => {});
    expect(views.counted).toEqual(['c1']);
  });

  it('counts another list opened on the same page, and a new mount again', async () => {
    const view = render(<Page id="c1" />);
    view.rerender(<Page id="c2" />);
    view.unmount();
    render(<Page id="c2" />);
    await act(async () => {});
    expect(views.counted).toEqual(['c1', 'c2', 'c2']);
  });

  // React's development build runs a mount's effects twice; the open is
  // still one open.
  it('counts once under React’s double effect', async () => {
    render(<React.StrictMode><Page id="c1" /></React.StrictMode>);
    await act(async () => {});
    expect(views.counted).toEqual(['c1']);
  });

  it('says nothing when the count is refused', async () => {
    views.refuse = true;
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    try {
      render(<Page id="c1" />);
      await act(async () => {});
      await new Promise((r) => setTimeout(r, 10));
      expect(views.counted).toEqual(['c1']);
      expect(unhandled).not.toHaveBeenCalled();
    } finally {
      process.off('unhandledRejection', unhandled);
    }
  });
});
