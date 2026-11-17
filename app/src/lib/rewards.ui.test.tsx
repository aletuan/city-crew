// @vitest-environment jsdom
//
// The one copy of the reader's badges, and when it speaks — see the
// header of `rewards.tsx`. The rules themselves are `badges.test.ts`;
// what is held here is the waiting: nothing is said, and nothing written
// down, until every source has answered for the account signed in.

import React, { useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, waitFor } from '../uitest/render';

type Src = { data: unknown[]; loading: boolean; loaded: boolean; error: string | null };
const src = (data: unknown[] = []): Src => ({ data, loading: false, loaded: true, error: null });

const state = vi.hoisted(() => ({
  me: 'me' as string | null,
  authReady: true,
  lists: null as unknown as Src,
  checkins: null as unknown as Src,
  ships: null as unknown as Src,
  trips: null as unknown as Src,
  submitted: [] as unknown[],
  likes: [] as unknown[],
  copies: [] as unknown[],
  failLikes: false,
  /** How long the copies take to come back, for a count that is late. */
  slowCopies: 0,
  asked: { submitted: [] as string[], likes: [] as string[], copies: [] as string[] },
}));

vi.mock('./auth', () => ({
  useSession: () => ({ ready: state.authReady, session: state.me ? { user: { id: state.me } } : null }),
}));
vi.mock('./save', () => ({ useMyLists: () => state.lists }));
vi.mock('./checkins', () => ({ useMyCheckins: () => state.checkins }));
vi.mock('./crew', () => ({ useCrew: () => ({ ships: state.ships }) }));
vi.mock('./mytrips', () => ({ useMyTrips: () => state.trips }));
vi.mock('./data', async () => ({
  useFetch: (await import('./data/fetch')).useFetch,
  fetchApplause: async (since: string) => {
    state.asked.likes.push(since);
    if (state.failLikes) throw new Error('offline');
    return state.likes;
  },
  fetchCopies: async (since: string) => {
    state.asked.copies.push(since);
    if (state.slowCopies) await new Promise((r) => setTimeout(r, state.slowCopies));
    return state.copies;
  },
}));
vi.mock('./data/export', () => ({
  fetchMySubmittedPlaces: async (me: string) => { state.asked.submitted.push(me); return state.submitted; },
}));

import { RewardsProvider, toldKey, useRewards, type Rewards } from './rewards';

const list = (slugs: string[], pub = false) => ({ is_public: pub, members: slugs.map((slug) => ({ slug })), collection_places: [] });
const places = (n: number) => Array.from({ length: n }, (_, i) => `p${i}`);

let got: Rewards;
function Probe() {
  const r = useRewards();
  useEffect(() => { got = r; });
  return null;
}
const draw = () => render(<RewardsProvider><Probe /></RewardsProvider>);
/** Let the fetches and the stored read land. */
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });
const stored = async (me = 'me') => {
  const raw = await AsyncStorage.getItem(toldKey(me)!);
  return raw ? JSON.parse(raw) : null;
};

beforeEach(async () => {
  state.me = 'me';
  state.authReady = true;
  state.lists = src();
  state.checkins = src();
  state.ships = src();
  state.trips = src();
  state.submitted = [];
  state.likes = [];
  state.copies = [];
  state.failLikes = false;
  state.slowCopies = 0;
  state.asked = { submitted: [], likes: [], copies: [] };
  await AsyncStorage.removeItem(toldKey('me')!);
  await AsyncStorage.removeItem(toldKey('you')!);
  vi.mocked(AsyncStorage.setItem).mockClear();
});

describe('with no provider above', () => {
  it('holds nothing and does nothing, so a screen drawn alone still draws', () => {
    render(<Probe />);
    expect(got).toMatchObject({ earned: [], unseen: [], notice: null, wanted: false });
    got.dismiss(); got.want(); got.opened(); got.closed();
  });
});

describe('what it counts', () => {
  it('works the badges out from the shared copies and the three counts', async () => {
    state.lists = src([list(['a', 'b'], true)]);
    state.checkins = src([{ place_slug: 'a', city_id: 'hn' }]);
    state.ships = src([{ requester: 'me', addressee: 'x', status: 'accepted', created_at: '2026-01-01' }]);
    state.trips = src([{ owner_id: 'me' }, { owner_id: 'x' }]);
    state.submitted = [{}];
    state.likes = [{}, {}, {}, {}, {}];
    state.copies = [{}];
    draw();
    await settle();
    expect(got.facts).toEqual({
      saved: 2, publicLists: 1, checkins: 1, cities: 1, friends: 1, trips: 1, submitted: 1, likes: 5, copies: 1,
    });
    expect(got.earned).toEqual([
      'firstFind', 'curator', 'beenThere', 'goodCompany', 'onTheRoad', 'contributor', 'wellLiked', 'trendsetter',
    ]);
  });

  // The two functions take a window, and a badge is about all of it; the
  // places are asked for as this account.
  it('asks for everything ever, as the reader', async () => {
    draw();
    await settle();
    expect(state.asked).toEqual({ submitted: ['me'], likes: ['1970-01-01T00:00:00Z'], copies: ['1970-01-01T00:00:00Z'] });
  });

  it('reads a count that could not be asked as none, and keeps the rest', async () => {
    state.failLikes = true;
    state.copies = [{}];
    draw();
    await settle();
    expect(got.facts).toMatchObject({ likes: 0, copies: 1 });
    expect(got.earned).toEqual(['trendsetter']);
  });

  it('asks nothing and holds nothing signed out', async () => {
    state.me = null;
    state.lists = src([list(['a'])]);
    draw();
    await settle();
    expect(state.asked.likes).toEqual([]);
    expect(got).toMatchObject({ earned: [], unseen: [], notice: null });
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });

  // Auth has not said who is asking yet: nobody, for now.
  it('holds nothing until auth has decided who is asking', async () => {
    state.authReady = false;
    state.lists = src([list(['a'])]);
    draw();
    await settle();
    expect(got.earned).toEqual([]);
    expect(state.asked.likes).toEqual([]);
  });
});

describe('a phone meeting the account for the first time', () => {
  it('says how many badges it holds, once, and writes them down', async () => {
    state.lists = src([list(places(12), true)]);
    state.checkins = src([{ place_slug: 'a', city_id: 'hn' }]);
    draw();
    await settle();
    expect(got.notice).toEqual({ kind: 'badges', count: 3 });
    expect(await stored()).toEqual({ badges: ['firstFind', 'curator', 'beenThere'], seen: [], level: 3 });
    // None seen yet: the dot is up.
    expect(got.unseen).toEqual(['firstFind', 'curator', 'beenThere']);
  });

  it('says nothing to a new account, and still starts its record', async () => {
    draw();
    await settle();
    expect(got.notice).toBeNull();
    expect(await stored()).toEqual({ badges: [], seen: [], level: 1 });
  });
});

describe('after that', () => {
  const remember = (told: object) => AsyncStorage.setItem(toldKey('me')!, JSON.stringify(told));

  it('names a badge earned since', async () => {
    await remember({ badges: ['firstFind'], seen: ['firstFind'], level: 1 });
    state.lists = src([list(['a'])]);
    const view = draw();
    await settle();
    expect(got.notice).toBeNull();
    // A first check-in, while the app is open.
    state.checkins = src([{ place_slug: 'a', city_id: 'hn' }]);
    view.rerender(<RewardsProvider><Probe /></RewardsProvider>);
    await settle();
    expect(got.notice).toEqual({ kind: 'badge', id: 'beenThere' });
    expect(got.unseen).toEqual(['beenThere']);
    expect((await stored()).badges).toEqual(['firstFind', 'beenThere']);
  });

  it('says a level reached, and writes it down so it is said once', async () => {
    await remember({ badges: ['firstFind'], seen: ['firstFind'], level: 1 });
    state.lists = src([list(places(5))]);
    draw();
    await settle();
    expect(got.notice).toEqual({ kind: 'level', level: 2 });
    expect((await stored()).level).toBe(2);
  });

  it('says nothing, and writes nothing, when nothing has changed', async () => {
    await remember({ badges: ['firstFind'], seen: ['firstFind'], level: 1 });
    state.lists = src([list(['a'])]);
    vi.mocked(AsyncStorage.setItem).mockClear();
    draw();
    await settle();
    expect(got.notice).toBeNull();
    expect(got.unseen).toEqual([]);
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });

  it('takes the banner down when told it has gone', async () => {
    state.lists = src([list(['a'])]);
    draw();
    await settle();
    expect(got.notice).not.toBeNull();
    act(() => got.dismiss());
    expect(got.notice).toBeNull();
  });
});

// A count still on its way reads as zero. Compared against, it would
// write "holds none" and then announce each badge as it loaded.
describe('waiting for every source', () => {
  it.each([
    ['still being asked', { loading: true }],
    ['never answered', { loaded: false }],
    ['failed', { error: 'offline' }],
  ])('says and writes nothing while the lists are %s', async (_what, over) => {
    state.lists = { ...src([list(['a'])]), ...over };
    draw();
    await settle();
    expect(got.notice).toBeNull();
    expect(await stored()).toBeNull();
  });

  it.each(['checkins', 'ships', 'trips'] as const)('waits for %s too', async (which) => {
    state.lists = src([list(['a'])]);
    state[which] = { ...src(), loading: true };
    const view = draw();
    await settle();
    expect(got.notice).toBeNull();
    expect(await stored()).toBeNull();
    // And speaks once it has answered.
    state[which] = src();
    view.rerender(<RewardsProvider><Probe /></RewardsProvider>);
    await settle();
    expect(got.notice).toEqual({ kind: 'badges', count: 1 });
  });

  // The three counts are a source like the others: a badge they earn
  // is counted with the rest, not announced a moment after them.
  it('waits for the three counts too', async () => {
    state.lists = src([list(['a'])]);
    state.copies = [{}];
    state.slowCopies = 30;
    draw();
    await settle();
    expect(got.notice).toBeNull();
    expect(await stored()).toBeNull();
    await act(async () => { await new Promise((r) => setTimeout(r, 40)); });
    expect(got.notice).toEqual({ kind: 'badges', count: 2 });
    expect(await stored()).toMatchObject({ badges: ['firstFind', 'trendsetter'] });
  });

  // Everything has answered but the phone's own memory: until it has,
  // this looks like a phone that was never told anything — and would
  // say "you hold 2 badges" again and write over what it knew.
  it('waits for the phone to read what it remembers, and marks nothing new meanwhile', async () => {
    const knew = { badges: ['firstFind', 'curator'], seen: ['firstFind', 'curator'], level: 1 };
    state.lists = src([list(['a'], true)]);
    vi.mocked(AsyncStorage.getItem).mockImplementationOnce(
      () => new Promise((r) => { setTimeout(() => r(JSON.stringify(knew)), 30); }),
    );
    draw();
    await settle();
    expect(got.earned).toEqual(['firstFind', 'curator']);
    expect(got.notice).toBeNull();
    expect(got.unseen).toEqual([]);
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
    await act(async () => { await new Promise((r) => setTimeout(r, 40)); });
    // It knew both, and had seen both: nothing to say, nothing to write.
    expect(got.notice).toBeNull();
    expect(got.unseen).toEqual([]);
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });

  // A plain fetch keeps its last answer while the next is out; the
  // record being read afresh for the new account is what holds it back.
  it('does not read one account with the last account’s counts', async () => {
    state.copies = [{}];
    const view = draw();
    await settle();
    expect(await stored('me')).toMatchObject({ badges: ['trendsetter'] });
    // Somebody else signs in; their copies have not been fetched yet.
    state.me = 'you';
    state.copies = [];
    view.rerender(<RewardsProvider><Probe /></RewardsProvider>);
    // Before their own counts land, nothing is written for them.
    expect(await stored('you')).toBeNull();
    await settle();
    expect(await stored('you')).toEqual({ badges: [], seen: [], level: 1 });
    // And the first account's banner did not stay up for them.
    expect(got.notice).toBeNull();
  });
});

describe('the sheet', () => {
  it('is wanted when the banner is pressed, until it opens', async () => {
    draw();
    await settle();
    act(() => got.want());
    expect(got.wanted).toBe(true);
    act(() => got.opened());
    expect(got.wanted).toBe(false);
  });

  it('asks the three counts again as it opens', async () => {
    draw();
    await settle();
    state.copies = [{}];
    act(() => got.opened());
    await settle();
    expect(state.asked.copies).toHaveLength(2);
    expect(got.earned).toEqual(['trendsetter']);
  });

  // The dot stays while the sheet is open — that is when the reader is
  // looking for which is new — and goes when it closes.
  it('marks everything held as seen when it closes, and not before', async () => {
    state.lists = src([list(['a'], true)]);
    draw();
    await settle();
    expect(got.unseen).toEqual(['firstFind', 'curator']);
    act(() => got.opened());
    await settle();
    expect(got.unseen).toEqual(['firstFind', 'curator']);
    act(() => got.closed());
    expect(got.unseen).toEqual([]);
    await waitFor(async () => expect((await stored()).seen).toEqual(['firstFind', 'curator']));
  });

  it('writes nothing on closing when there was nothing new to see', async () => {
    state.lists = src([list(['a'])]);
    draw();
    await settle();
    act(() => got.closed());
    await settle();
    vi.mocked(AsyncStorage.setItem).mockClear();
    act(() => got.closed());
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });

  // Closed before the phone has read what it remembers: nothing to mark.
  it('does nothing on closing before anything is known', () => {
    state.lists = { ...src(), loading: true };
    draw();
    act(() => got.closed());
    expect(got.unseen).toEqual([]);
  });
});
