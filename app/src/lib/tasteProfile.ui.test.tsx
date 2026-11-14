// @vitest-environment jsdom
//
// What the app is told about a reader, and what it is allowed to remember.
//
// How a taste is weighed is `taste.ts`'s, held at 100% in Node. What is
// left here is which signals reach it — the reader's own lists, their
// likes, the places they suggested, and, only with the history switch on,
// the places they opened and passed over — and the one thing this file
// promises the privacy policy: with the switch off, nothing is noted and
// nothing noted is read back. `tasteFrom` is stood in for so that what
// is under test is the wiring, not the maths.

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, waitFor } from '../uitest/render';
import type { Collection, Place } from './types';

const place = (slug: string, over: Partial<Place> = {}) => ({ slug, ...over } as Place);

const world = vi.hoisted(() => ({
  uid: 'me' as string | null,
  userId: undefined as string | null | undefined,
  prefs: { loaded: true, data: { history_on: false, categories: [] as string[] } },
  places: [] as unknown[],
  mine: [] as unknown[],
  collections: [] as unknown[],
  myLikes: [] as string[],
  rankLikes: {} as Record<string, number>,
  used: { data: [] as { slug: string; uses: number; views: number; liked: number }[] },
  city: { id: 'hanoi' } as { id: string } | null,
}));
const spies = vi.hoisted(() => ({
  tasteFrom: vi.fn((_signals: Record<string, unknown>) => ({ affinity: {} })),
  fetchPassedOver: vi.fn(async (_uid: string, _since: string) => ['passed-a']),
  logPlaceEvent: vi.fn(async () => {}),
  rankLists: vi.fn((lists: readonly unknown[], _o: Record<string, unknown>) => [...lists].reverse()),
  listFacts: vi.fn((_c: unknown, _members: unknown, _taste: unknown) => 'facts'),
  meanRating: vi.fn((_places: unknown, _fallback: number) => 4.2),
}));

vi.mock('./auth', () => {
  const m = {
    useAuth: () => ({ session: world.uid ? { user: { id: world.uid } } : null, userId: world.userId }),
  };
  const all = () => (m as { useAuth: () => object }).useAuth();
  return { ...m, useSession: all, useProfile: all, useAuthActions: all, useAuthEvent: () => {} };
});
vi.mock('./catalog', () => {
  const useCatalog = () => ({
    places: { data: world.places }, collections: { data: world.collections }, myLikes: world.myLikes,
    rankLikes: world.rankLikes,
  });
  return {
    useCatalog,
    usePlaces: () => useCatalog().places,
    useCollections: () => useCatalog().collections,
    useLikes: () => useCatalog(),
  };
});
vi.mock('./city', () => {
  const m = { useCity: () => ({ city: world.city }) };
  const all = () => (m as { useCity: () => object }).useCity();
  return { ...m, useCurrentCity: all, useCityList: all };
});
vi.mock('./save', () => {
  const useSave = () => ({ mine: { data: world.mine } });
  return { useSave, useMyLists: () => (useSave() as { mine?: unknown }).mine, useSaveActions: () => useSave() };
});
vi.mock('./data', () => ({
  fetchPassedOver: spies.fetchPassedOver,
  logPlaceEvent: spies.logPlaceEvent,
  useMyPreferences: () => world.prefs,
  useListUseQuery: () => world.used,
}));
vi.mock('./taste', () => ({ tasteFrom: spies.tasteFrom }));
vi.mock('./listRank', async (real) => ({
  ...(await real<typeof import('./listRank')>()),
  rankLists: spies.rankLists, listFacts: spies.listFacts, meanRating: spies.meanRating,
}));

import { RATING_MEAN } from './rank';
import { useBrowseTaste, useListRank, useNoteEvent, usePlanProfile } from './tasteProfile';

const slugs = (xs: unknown) => (xs as Place[]).map((p) => p.slug);
const lastSignals = () => spies.tasteFrom.mock.calls.at(-1)![0];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-09-28T09:00:00Z'));
  world.uid = 'me';
  world.userId = undefined;
  world.prefs = { loaded: true, data: { history_on: false, categories: [] } };
  world.places = [
    place('saved-a'), place('mine-b', { submitted_by: 'me' }), place('liked-c'), place('elsewhere'),
  ];
  world.mine = [{ slug: 'my-list', members: [place('saved-a')] }];
  world.collections = [
    { id: 'c-liked', slug: 'liked-list', members: [place('liked-c')] },
    { id: 'c-other', slug: 'other-list', members: [place('elsewhere')] },
  ];
  world.myLikes = ['c-liked'];
  world.rankLikes = { 'liked-list': 3 };
  world.used = { data: [{ slug: 'other-list', uses: 2, views: 30, liked: 4 }] };
  world.city = { id: 'hanoi' };
  for (const f of Object.values(spies)) f.mockClear();
  return () => vi.useRealTimers();
});

describe('the planner’s profile', () => {
  let seen: ReturnType<typeof usePlanProfile>;
  const Probe = () => { seen = usePlanProfile(); return null; };

  it('reads the reader’s own lists, suggestions and likes — and not a list they did not like', () => {
    render(<Probe />);
    const s = lastSignals();
    expect(slugs(s.saved)).toEqual(['saved-a']);
    expect(slugs(s.suggested)).toEqual(['mine-b']);
    expect(slugs(s.liked)).toEqual(['liked-c']);
    expect(seen.taste).toEqual({ affinity: {} });
    expect(seen.budgetVnd).toBeNull();
  });

  it('knows the remembered reader before the session is read', () => {
    world.uid = null;
    world.userId = 'me';
    render(<Probe />);
    expect(slugs(lastSignals().suggested)).toEqual(['mine-b']);
    expect(seen.taste).toEqual({ affinity: {} });
  });

  it('with the history switch off, never reads what was passed over', async () => {
    render(<Probe />);
    await act(async () => {});
    expect(spies.fetchPassedOver).not.toHaveBeenCalled();
    expect(lastSignals().passedOver).toEqual([]);
  });

  it('with it on, reads the last ninety days of it and weighs it', async () => {
    world.prefs = { loaded: true, data: { history_on: true, categories: [] } };
    render(<Probe />);
    await waitFor(() => expect(lastSignals().passedOver).toEqual(['passed-a']));
    expect(spies.fetchPassedOver).toHaveBeenCalledWith('me', '2026-06-30T09:00:00.000Z');
  });

  it('forgets it again the moment the switch goes off', async () => {
    world.prefs = { loaded: true, data: { history_on: true, categories: [] } };
    const { rerender } = render(<Probe />);
    await waitFor(() => expect(lastSignals().passedOver).toEqual(['passed-a']));
    world.prefs = { loaded: true, data: { history_on: false, categories: [] } };
    rerender(<Probe />);
    await waitFor(() => expect(lastSignals().passedOver).toEqual([]));
  });

  it('keeps going without it when the read fails', async () => {
    world.prefs = { loaded: true, data: { history_on: true, categories: [] } };
    spies.fetchPassedOver.mockRejectedValueOnce(new Error('offline'));
    render(<Probe />);
    await act(async () => {});
    expect(lastSignals().passedOver).toEqual([]);
    expect(seen.taste).not.toBeNull();
  });

  it('knows nothing about a guest', () => {
    world.uid = null;
    render(<Probe />);
    expect(seen.taste).toBeNull();
    expect(spies.tasteFrom).not.toHaveBeenCalled();
  });
});

describe('the browse taste', () => {
  let seen: Awaited<ReturnType<typeof useBrowseTaste>>;
  const Probe = () => { seen = useBrowseTaste(); return null; };

  it('leads with the kinds the reader picked, dropping any the app no longer has', () => {
    world.prefs = { loaded: true, data: { history_on: false, categories: ['cafes', 'no-such-kind', 'cafes'] } };
    render(<Probe />);
    const s = lastSignals();
    expect(s.preferred).toEqual(['cafes']);
    expect(slugs(s.saved)).toEqual(['saved-a']);
    expect(seen).toEqual({ affinity: {} });
  });

  // Browsing ranks for everyone who opens the tab; what somebody passed
  // over is the planner's to weigh, with their switch on, and not this.
  it('never reads what was passed over, even with the switch on', async () => {
    world.prefs = { loaded: true, data: { history_on: true, categories: [] } };
    render(<Probe />);
    await act(async () => {});
    expect(spies.fetchPassedOver).not.toHaveBeenCalled();
    expect(lastSignals()).not.toHaveProperty('passedOver');
  });

  it('knows nothing about a guest', () => {
    world.uid = null;
    render(<Probe />);
    expect(seen).toBeNull();
  });

  // A taste that waited for the session re-sorted a list the reader could
  // already see — the cached catalog drew in one order, and a round trip
  // later the reader's taste landed and drew it in another.
  it('knows the remembered reader before the session is read', () => {
    world.uid = null;
    world.userId = 'me';
    render(<Probe />);
    expect(seen).toEqual({ affinity: {} });
    expect(slugs(lastSignals().suggested)).toEqual(['mine-b']);
  });
});

// How a shelf is ordered is `listRank.ts`'s, held at 100% in Node and
// stood in for here. What is under test is what reaches it.
describe('the order of a public shelf', () => {
  let rank: ReturnType<typeof useListRank>;
  const Probe = () => { rank = useListRank(); return null; };
  const shelf = () => world.collections as Collection[];

  it('ranks the lists it is handed by the likes, the use, the catalog and the clock', () => {
    render(<Probe />);
    expect(rank(shelf()).map((c) => c.slug)).toEqual(['other-list', 'liked-list']);
    const [lists, o] = spies.rankLists.mock.calls.at(-1)!;
    expect(lists).toBe(world.collections);
    expect(o.likes).toBe(world.rankLikes);
    expect(o.use).toEqual({ 'other-list': { uses: 2, views: 30, liked: 4 } });
    expect(o.mean).toBe(4.2);
    expect(spies.meanRating).toHaveBeenLastCalledWith(world.places, RATING_MEAN);
    expect(o.now).toBe(new Date('2026-09-28T09:00:00Z').getTime());
  });

  it('reads each list by its places and the reader’s browsing taste', () => {
    world.prefs = { loaded: true, data: { history_on: false, categories: ['cafes'] } };
    render(<Probe />);
    rank(shelf());
    const o = spies.rankLists.mock.calls.at(-1)![1] as { factsOf: (c: unknown) => unknown };
    expect(o.factsOf(shelf()[0])).toBe('facts');
    const [c, members, taste] = spies.listFacts.mock.calls.at(-1)!;
    expect(c).toBe(shelf()[0]);
    expect(slugs(members)).toEqual(['liked-c']);
    expect(taste).toEqual({ affinity: {} });
    // The browsing taste: the stated kinds are in it.
    expect(lastSignals().preferred).toEqual(['cafes']);
  });

  it('reads a guest’s shelf with no taste at all', () => {
    world.uid = null;
    render(<Probe />);
    rank(shelf());
    (spies.rankLists.mock.calls.at(-1)![1] as { factsOf: (c: unknown) => unknown }).factsOf(shelf()[0]);
    expect(spies.listFacts.mock.calls.at(-1)![2]).toBeNull();
  });

  // The Collections tab builds its rows from the result; a new function
  // each render rebuilt them each render.
  it('is the same function until something it reads changes', () => {
    const { rerender } = render(<Probe />);
    const first = rank;
    rerender(<Probe />);
    expect(rank).toBe(first);
    world.rankLikes = { 'liked-list': 4 };
    rerender(<Probe />);
    expect(rank).not.toBe(first);
  });
});

// The privacy policy's own sentence, as code: with history off, nothing
// is noted. `logPlaceEvent` refuses on `allowed: false`; what this hook
// owes it is the right answer for `allowed`.
describe('noting what the reader does', () => {
  let note: ReturnType<typeof useNoteEvent>;
  const Probe = () => { note = useNoteEvent(); return null; };

  it('notes with the switch on, for this reader and this city', () => {
    world.prefs = { loaded: true, data: { history_on: true, categories: [] } };
    render(<Probe />);
    note('pho-10', 'open');
    expect(spies.logPlaceEvent).toHaveBeenCalledWith('me', 'pho-10', 'open', 'hanoi', true);
  });

  it('says not allowed with the switch off', () => {
    render(<Probe />);
    note('pho-10', 'open');
    expect(spies.logPlaceEvent).toHaveBeenCalledWith('me', 'pho-10', 'open', 'hanoi', false);
  });

  // Before the preferences row has arrived the switch reads as its
  // default, which is not the reader's answer. Until it is, the answer
  // is no.
  it('says not allowed while the switch has not loaded, whatever it reads', () => {
    world.prefs = { loaded: false, data: { history_on: true, categories: [] } };
    render(<Probe />);
    note('pho-10', 'save');
    expect(spies.logPlaceEvent).toHaveBeenCalledWith('me', 'pho-10', 'save', 'hanoi', false);
  });

  it('passes no city when none is chosen', () => {
    world.prefs = { loaded: true, data: { history_on: true, categories: [] } };
    world.city = null;
    render(<Probe />);
    note('pho-10', 'open');
    expect(spies.logPlaceEvent).toHaveBeenCalledWith('me', 'pho-10', 'open', null, true);
  });
});
