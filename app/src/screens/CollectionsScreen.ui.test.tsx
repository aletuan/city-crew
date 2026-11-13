// @vitest-environment jsdom
//
// Collections, rendered.
//
// What is pinned here is what a reader sees and where a tap lands: the
// guest's sign-in card and the one shelf a guest gets, the two tabs a
// signed-in reader switches between (and the greeting that picks the
// community shelf for an empty library), the tile/list preference and its
// memory, which public lists make the shelf for the city on screen, the
// byline / padlock split between other people's lists and your own, the
// heart as a control on theirs and a tally on yours, the swipe actions and
// the delete confirmation, the in-memory search, and the loading, failed
// and empty states. The catalog, auth, city, the save provider and the two
// data-layer calls are mocked at the screen's own imports; the pure helpers
// (`membersOf`, `touchesCity`, `findCollections`, `likesWorthShowing`) run
// for real, because the filtering they do is the behaviour being pinned.

import React from 'react';
import { dropResume, takeResume } from '../lib/resume';
beforeEach(() => { dropResume(); });
import { StyleSheet } from 'react-native';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '../uitest/render';
import { useScrollToTop } from '@react-navigation/native';
import type { Collection, Place } from '../lib/data';
import type { Nav } from '../nav';
import { colors, coverScrim, mosaicScrim, onPhoto, space } from '../theme';
import { TABS_ROW_GAP } from '../components/ui';

const state = vi.hoisted(() => ({
  uid: null as string | null,
  pending: false,
  ducked: false,
  city: { id: 'hanoi' } as { id: string } | null,
  cities: [] as unknown[],
  places: [] as unknown[],
  placesLoaded: true,
  placesLoading: false,
  cols: {
    data: [] as unknown[], loaded: true, loading: false,
    error: null as string | null, loadedAt: 1 as number | null,
  },
  mine: { data: [] as unknown[], loaded: true, loading: false },
  shared: { data: [] as unknown[], loaded: true, loading: false, loadedAt: 1 as number | null },
  // The share rows on the reader's own lists (`useMyListShares`).
  myShares: [] as { collection_id: string; user_id: string; created_at: string }[],
  likes: {} as Record<string, number>,
  myLikes: [] as string[],
  // How many times the screen has rendered: the catalog hook runs once a
  // render. Read by the freeze test below.
  renders: 0,
}));
const spies = vi.hoisted(() => ({
  colsReload: vi.fn(),
  mineReload: vi.fn(),
  sharedReload: vi.fn(),
  sharedFor: vi.fn((_id: string | null | undefined) => {}),
  mySharesFor: vi.fn((_id: string | null | undefined) => {}),
  mySharesReload: vi.fn(),
  placesReload: vi.fn(),
  askToSignIn: vi.fn(),
  toggleLike: vi.fn(async () => {}),
  fetchProfilesById: vi.fn(async (_ids: string[]) => ({}) as Record<string, { avatar_url: string }>),
}));

// One `t` for every render, as the real provider's memoised value gives:
// a new one each render would rebuild everything keyed on it, which the
// app never does and the freeze test below must not be fooled by.
const i18n = vi.hoisted(() => ({ lang: 'en', setLang: () => {}, t: (en: string) => en }));
vi.mock('../lib/i18n', () => ({
  useI18n: () => i18n,
}));
vi.mock('../lib/auth', () => {
  const m = {
    // `userId` as the provider gives it: undefined while the launch has
    // read nothing (`pending`), then the session's id or null.
    useAuth: () => ({
      session: state.uid ? { user: { id: state.uid } } : null,
      userId: state.pending ? undefined : state.uid ?? null,
    }),
  };
  const all = () => (m as { useAuth: () => object }).useAuth();
  return { ...m, useSession: all, useProfile: all, useAuthActions: all, useAuthEvent: () => {} };
});
vi.mock('../lib/city', () => {
  const m = { useCity: () => ({ city: state.city, cities: state.cities }) };
  const all = () => (m as { useCity: () => object }).useCity();
  return { ...m, useCurrentCity: all, useCityList: all };
});
vi.mock('../lib/catalog', () => ({
  useCollections: () => { state.renders += 1; return { ...state.cols, reload: spies.colsReload }; },
  useLikes: () => ({ likes: state.likes, rankLikes: state.likes, myLikes: state.myLikes, toggleLike: spies.toggleLike }),
  usePlaces: () => ({ data: state.places, loading: state.placesLoading, loaded: state.placesLoaded, reload: spies.placesReload }),
}));
vi.mock('../lib/save', () => {
  const useSave = () => ({ mine: { ...state.mine, reload: spies.mineReload }, askToSignIn: spies.askToSignIn });
  return { useSave, useMyLists: () => (useSave() as { mine?: unknown }).mine, useSaveActions: () => useSave() };
});
// Only the call that leaves the device is stood in for; the rest of
// the module is the real membership and city arithmetic.
vi.mock('../lib/data', async (orig) => ({
  ...(await orig<typeof import('../lib/data')>()),
  fetchProfilesById: spies.fetchProfilesById,
  useSharedWithMe: (id: string | null | undefined) => {
    spies.sharedFor(id);
    return { ...state.shared, reload: spies.sharedReload };
  },
  useMyListShares: (id: string | null | undefined) => {
    spies.mySharesFor(id);
    return { data: state.myShares, loaded: true, loading: false, reload: spies.mySharesReload };
  },
}));
vi.mock('../components/tabBarDuck', () => ({ useDuckOnScroll: () => undefined, useTabBarDucked: () => state.ducked }));
// The dock's settle gate is the dock's own business (DockSlot's tests);
// here it offers the moment the screen says it may, so a test can open
// the box through it without waiting out the gate.
vi.mock('../components/DockSlot', async (orig) => ({
  ...(await orig<typeof import('../components/DockSlot')>()),
  useDockOffer: (eligible: boolean) => eligible,
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import CollectionsScreen from './CollectionsScreen';

const place = (slug: string, city = 'hanoi', photo?: string): Place => ({
  slug, city_id: city, name_en: `Place ${slug}`, name_vi: slug, name_ja: null,
  category: 'out', categories: [], is_featured: false, vibe_tags: [],
  place_photos: photo ? [{ photo_uri: photo, is_cover: true, is_hidden: false, sort_order: 0 }] : [],
} as unknown as Place);

const col = (slug: string, members: string[], over: Partial<Collection> = {}): Collection => ({
  id: `id-${slug}`, slug,
  title_en: `List ${slug}`, title_vi: slug, title_ja: null,
  desc_en: null, desc_vi: null, desc_ja: null,
  curator_handle: null, cover: null, is_public: true, owner_id: null,
  collection_places: members.map((m, i) => ({ sort_order: i, places: { slug: m } })),
  ...over,
} as unknown as Collection);

type NavSpy = Nav & { navigate: ReturnType<typeof vi.fn>; parentNavigate: ReturnType<typeof vi.fn> };
const nav = (): NavSpy => {
  const parentNavigate = vi.fn();
  return {
    navigate: vi.fn(), goBack: vi.fn(), replace: vi.fn(), popToTop: vi.fn(),
    addListener: vi.fn(() => () => {}),
    getParent: () => ({ navigate: parentNavigate }),
    parentNavigate,
  } as unknown as NavSpy;
};

const show = (params?: { tab?: 'community'; at?: number }) => {
  const navigation = nav();
  const utils = render(<CollectionsScreen navigation={navigation} route={{ params }} />);
  return { navigation, ...utils };
};

/** The SectionList's own props, reached through the committed fiber tree —
 *  a pull gesture does not exist in jsdom (same approach as Explore). */
const listProps = (): { onRefresh: () => void; refreshing: boolean; onScroll: (e: unknown) => void } => {
  type Fiber = { child: Fiber | null; sibling: Fiber | null; memoizedProps: Record<string, unknown> | null };
  const host = document.body.firstElementChild as unknown as Record<string, { stateNode: { current: Fiber } }>;
  const key = Object.keys(host).find((k) => k.startsWith('__reactContainer'))!;
  const stack: Fiber[] = [host[key].stateNode.current];
  while (stack.length) {
    const f = stack.pop()!;
    const p = f.memoizedProps;
    if (p && typeof p === 'object' && 'sections' in p && 'onRefresh' in p) return p as never;
    if (f.sibling) stack.push(f.sibling);
    if (f.child) stack.push(f.child);
  }
  throw new Error('no SectionList in the committed tree');
};

const icons = (name: string) => document.querySelectorAll(`[data-icon="${name}"]`).length;

beforeEach(async () => {
  vi.clearAllMocks();
  spies.fetchProfilesById.mockImplementation(async () => ({}));
  await AsyncStorage.removeItem('citycrew.collections.view');
  await AsyncStorage.removeItem('citycrew.collections.community.view');
  state.uid = null;
  state.pending = false;
  state.ducked = false;
  state.city = { id: 'hanoi' };
  state.cities = [];
  state.places = [place('a', 'hanoi', 'https://img/a.jpg'), place('b'), place('s', 'saigon')];
  state.placesLoaded = true;
  state.placesLoading = false;
  state.cols = { data: [], loaded: true, loading: false, error: null, loadedAt: 1 };
  state.mine = { data: [], loaded: true, loading: false };
  state.shared = { data: [], loaded: true, loading: false, loadedAt: 1 };
  state.myShares = [];
  state.likes = {};
  state.myLikes = [];
});

// An answer in the filter sheet by its word: each carries its figure
// after it, "Cafés (2)", which the accessible name runs together.
const word = (w: string) => ({ name: new RegExp(`^${w} ?(\\(\\d+\\))?$`) });
type Layout = { __reactLayoutHandler: (e: unknown) => void };
const lay = (id: string, layout: { y: number; height: number }) => act(() => {
  (screen.getByTestId(id) as unknown as Layout).__reactLayoutHandler({ nativeEvent: { layout: { x: 0, width: 390, ...layout } } });
});
const scrollTo = (y: number) => act(() => {
  listProps().onScroll({ nativeEvent: {
    contentOffset: { x: 0, y }, contentSize: { width: 390, height: 3000 }, layoutMeasurement: { width: 390, height: 844 },
  } });
});
// The header as a phone lays it out: the tabs 120 down, the whole 260.
const laidOut = () => {
  lay('collections-tabs', { y: 120, height: 44 });
  lay('collections-top', { y: 0, height: 260 });
};
// The box is not on the page at rest (owner, 7 Nov 2026), and nothing
// beside the title opens it: the dock does, once the reader has scrolled
// into the shelf with the bar away. Opened, the list goes back to the
// top, as `toTop` takes it on a phone, with the kinds under the box.
const openBox = () => {
  if (screen.queryByPlaceholderText('Name, place, city, user')) return;
  const ducked = state.ducked;
  state.ducked = true;
  laidOut();
  scrollTo(400);
  fireEvent.click(screen.getByTestId('collections-dock').firstElementChild as HTMLElement);
  scrollTo(0);
  state.ducked = ducked;
};
const pickKind = (label: string) => fireEvent.click(within(screen.getByTestId('collections-kinds')).getByRole('button', word(label)));

describe('CollectionsScreen — as a guest', () => {
  it('leads with the sign-in card, which jumps to the Profile stack', () => {
    const { navigation } = show();
    expect(screen.getByText('Start a collection')).toBeTruthy();
    // No tabs for a guest: there is no library to switch to.
    expect(screen.queryByRole('tab')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Sign in to build your own collections' }));
    expect(navigation.parentNavigate).toHaveBeenCalledWith('Profile', { screen: 'SignIn', initial: false });
    const pending = takeResume(Date.now());
    expect(pending?.tab).toBe('Collections');
    expect(pending?.kind).toBe('collection');
    expect(navigation.navigate).not.toHaveBeenCalled();
    pending?.run?.();
    expect(navigation.navigate).toHaveBeenCalledWith('CollectionForm');
  });

  // One row since 17 Oct 2026: the words and the chip side by side, no
  // icon well, so the first row of lists is not pushed half a screen down.
  it('keeps the sign-in banner to one row: words, then the chip', () => {
    show();
    const banner = screen.getByRole('button', { name: 'Sign in to build your own collections' });
    const row = banner.querySelector('[data-icon="arrow-forward"]')!.parentElement!.parentElement!;
    expect(getComputedStyle(row).flexDirection).toBe('row');
    expect(row.textContent).toBe('Start a collectionSign in to create and sort.Sign in');
    expect(banner.querySelector('[data-icon="bookmark"]')).toBeNull();
  });

  // Every city, as Yours is (owner, 15 Oct 2026): a list made in another
  // city is on the shelf; one with nothing in it is still not.
  it('shows every public list with places, whatever its city, and not an empty one', () => {
    state.cols.data = [
      col('here', ['a']),
      col('elsewhere', ['s']),
      col('hollow', []),
    ];
    show();
    expect(screen.getByText('List here')).toBeTruthy();
    expect(screen.getByText('List elsewhere')).toBeTruthy();
    expect(screen.queryByText('List hollow')).toBeNull();
  });

  it('without a city, any list with members makes the shelf and an empty one still does not', () => {
    state.city = null;
    state.cols.data = [col('elsewhere', ['s']), col('hollow', [])];
    show();
    expect(screen.getByText('List elsewhere')).toBeTruthy();
    expect(screen.queryByText('List hollow')).toBeNull();
  });

  it('holds skeletons (and no list) while the collections are still loading', () => {
    state.cols.loaded = false;
    state.cols.data = [col('here', ['a'])];
    show();
    expect(screen.queryByText('List here')).toBeNull();
    // The guest card still leads the loading state.
    expect(screen.getByText('Start a collection')).toBeTruthy();
  });

  it('holds while the places catalog has not loaded, even if lists are in', () => {
    state.placesLoaded = false;
    state.cols.data = [col('here', ['a'])];
    show();
    expect(screen.queryByText('List here')).toBeNull();
  });

  // With a shelf in hand the failure is a banner and the shelf stays —
  // a refresh that failed must not make the tab forget what it knew.
  it('keeps the shelf and says the refresh failed above it', () => {
    state.cols.error = 'Network request failed';
    state.cols.data = [col('here', ['a'])];
    show();
    expect(screen.getByTestId('collections-load-banner')).toBeTruthy();
    expect(screen.getByText(/You’re offline/)).toBeTruthy();
    expect(screen.getByText('List here')).toBeTruthy();
    expect(screen.queryByText(/network down|Network request failed/)).toBeNull();
  });

  // Nothing in hand: the failure is the body, named, with the one control
  // that can change anything.
  it('says the load failed in its own words, with a way to try again, when there is nothing to show', () => {
    state.cols.error = 'JWT expired';
    state.cols.data = [];
    show();
    expect(screen.getByTestId('collections-load-fail')).toBeTruthy();
    expect(screen.queryByText(/JWT/)).toBeNull();
    // An expired token retries itself; the button is for the others.
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
    state.cols.error = 'something odd';
    show();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(spies.colsReload).toHaveBeenCalled();
  });

  it('an empty shelf points a guest at Explore, not at creating', () => {
    const { navigation } = show();
    expect(screen.getByText('No public lists yet')).toBeTruthy();
    expect(screen.queryByText('Create a collection')).toBeNull();
    fireEvent.click(screen.getByText('Explore places'));
    expect(navigation.parentNavigate).toHaveBeenCalledWith('Explore');
  });

  it('a tile is a button named by its title, and opens its collection by slug', () => {
    state.cols.data = [col('here', ['a'])];
    const { navigation } = show();
    fireEvent.click(screen.getByRole('button', { name: 'List here' }));
    expect(navigation.navigate).toHaveBeenCalledWith('CollectionDetail', { slug: 'here' });
  });

  it('lays the cover scrim the Explore shelf wears under a tile’s words', async () => {
    await AsyncStorage.setItem('citycrew.collections.community.view', 'tile');
    state.cols.data = [col('here', ['a'])];
    show();
    await act(async () => {});
    const scrim = screen.getByTestId('collection-card-scrim');
    expect(scrim.getAttribute('colors')).toBe(coverScrim.colors.join(','));
    expect(scrim.getAttribute('locations')).toBe(coverScrim.locations.join(','));
  });

  it("a guest's heart asks them to sign in and writes nothing", async () => {
    await AsyncStorage.setItem('citycrew.collections.community.view', 'tile');
    state.cols.data = [col('here', ['a'])];
    show();
    await act(async () => {});
    fireEvent.click(screen.getByRole('button', { name: 'Like this collection' }));
    expect(spies.askToSignIn).toHaveBeenCalledTimes(1);
    // A heart raises the heart sheet, not the bookmark one.
    expect(spies.askToSignIn).toHaveBeenCalledWith('like');
    expect(spies.toggleLike).not.toHaveBeenCalled();
  });

  it("community tiles wear the curator's handle and face, not a place count", async () => {
    await AsyncStorage.setItem('citycrew.collections.community.view', 'tile');
    state.cols.data = [
      col('here', ['a'], { curator_handle: 'Minh', owner_id: 'o1' }),
      col('there', ['b'], { owner_id: 'o1' }),
    ];
    spies.fetchProfilesById.mockImplementation(async () => ({ o1: { avatar_url: 'https://face/o1.jpg' } }));
    show();
    await act(async () => {});
    expect(screen.getByText('@minh')).toBeTruthy();
    // One batched lookup, each owner once.
    expect(spies.fetchProfilesById).toHaveBeenCalledWith(['o1']);
    await waitFor(() => expect(document.querySelector('img[src="https://face/o1.jpg"]')).toBeTruthy());
    expect(screen.queryByText('1 place')).toBeNull();
  });

  it('asks for no faces when no list has an owner', () => {
    state.cols.data = [col('here', ['a'])];
    show();
    expect(spies.fetchProfilesById).not.toHaveBeenCalled();
  });

  it("a tile's photo is the chosen cover, else the first place's cover", () => {
    state.cols.data = [
      col('picked', ['b'], { cover: { photo_uri: 'https://img/picked.jpg' } }),
      col('fallback', ['a']),
    ];
    show();
    expect(document.querySelector('img[src="https://img/picked.jpg"]')).toBeTruthy();
    expect(document.querySelector('img[src="https://img/a.jpg"]')).toBeTruthy();
  });

  it('a private list wears no heart — nobody may like it', () => {
    state.cols.data = [col('shut', ['a'], { is_public: false })];
    show();
    expect(screen.getByText('List shut')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /like this collection/i })).toBeNull();
  });
});

describe('CollectionsScreen — signed in', () => {
  beforeEach(() => { state.uid = 'u1'; });

  it('reloads your library on the first focus', () => {
    show();
    expect(spies.mineReload).toHaveBeenCalled();
  });

  it('opens on Yours with your lists, the padlock/globe and the count', () => {
    state.mine.data = [
      col('mine1', ['a', 'b'], { is_public: false, owner_id: 'u1' }),
      col('mine2', ['a'], { is_public: true, owner_id: 'u1' }),
    ];
    state.cols.data = [col('theirs', ['a'])];
    show();
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Yours', 'Community']);
    expect(screen.getByText('List mine1')).toBeTruthy();
    expect(screen.queryByText('List theirs')).toBeNull();
    // The pin and the figure on the tile (owner, 2 Nov 2026), the word
    // only in what is heard.
    expect(screen.getByLabelText('2 places').textContent).toBe('2');
    expect(screen.getByLabelText('2 places').querySelector('[data-icon="location-outline"]')).toBeTruthy();
    expect(screen.getByLabelText('1 place').textContent).toBe('1');
    expect(screen.queryByText(/places?$/)).toBeNull();
    // Only the exception is marked (owner, 2 Nov 2026): the private tile
    // wears a padlock in its top corner, the public one nothing — the only
    // globe left is the Community tab's own.
    expect(screen.getAllByTestId('collection-tile-lock')).toHaveLength(1);
    expect(icons('lock-closed')).toBe(1);
    expect(icons('lock-closed-outline')).toBe(0);
    expect(icons('globe-outline')).toBe(1);
    // Signed in, the guest card is gone.
    expect(screen.queryByText('Start a collection')).toBeNull();
  });

  // A curator may like their own list (owner, 17 Oct 2026), so your own
  // public tile wears the same heart as everybody else's.
  it('your own public tile wears the pressable heart, and it likes', () => {
    state.mine.data = [col('mine1', ['a'], { owner_id: 'u1' })];
    state.likes = { mine1: 4 };
    show();
    expect(screen.getByText('4')).toBeTruthy();
    const heart = screen.getByRole('button', { name: 'Like this collection' });
    expect(heart.querySelector('[data-icon="heart-outline"]')!.getAttribute('data-size')).toBe('15');
    fireEvent.click(heart);
    expect(spies.toggleLike).toHaveBeenCalledWith(expect.objectContaining({ slug: 'mine1' }));
  });

  // At any count — and never on a private list.
  it('your own public tile offers the heart before anybody has liked it', () => {
    state.mine.data = [
      col('mine1', ['a'], { owner_id: 'u1' }),
      col('shut', ['a'], { owner_id: 'u1', is_public: false }),
    ];
    state.likes = {};
    show();
    const hearts = screen.getAllByRole('button', { name: 'Like this collection' });
    expect(hearts).toHaveLength(1);
    expect(screen.queryByText(/likes?$/)).toBeNull();
    fireEvent.click(hearts[0]);
    expect(spies.toggleLike).toHaveBeenCalledWith(expect.objectContaining({ slug: 'mine1' }));
  });

  // The same list sits at the same height on both tabs: the meta row is
  // as tall as a face whether it leads with one or with a bare count.
  it('holds the tile\u2019s meta row at the avatar\u2019s height on either tab', () => {
    state.mine.data = [col('mine1', ['a'], { owner_id: 'u1', is_public: false })];
    show();
    const foot = screen.getByTestId('collection-tile-foot');
    expect(getComputedStyle(foot).minHeight).toBe('18px');
    expect(foot.querySelector('[data-icon^="lock-closed"]')).toBeNull();
  });

  // The padlock sits in the top-right corner, in a 24pt disc of the card
  // ground ("New" wears the same, top-left), and only on a private list.
  it('marks a private tile with a padlock in its top corner, and a public one with nothing', () => {
    state.mine.data = [
      col('shut', ['a'], { owner_id: 'u1', is_public: false }),
      col('open', ['a'], { owner_id: 'u1', is_public: true }),
    ];
    show();
    const lock = screen.getByTestId('collection-tile-lock');
    const st = getComputedStyle(lock);
    expect([st.position, st.top, st.right, st.width, st.height, st.borderTopLeftRadius])
      .toEqual(['absolute', '10px', '10px', '24px', '24px', '12px']);
    expect(st.backgroundColor).toBe(String(colors.surfaceCard).replace(/,(?=\S)/g, ', '));
    expect(lock.querySelector('[data-icon="lock-closed"]')!.getAttribute('data-size')).toBe('12');
    expect(screen.getByRole('button', { name: 'List shut, Private' }).contains(lock)).toBe(true);
    const open = screen.getByRole('button', { name: 'List open, Public' });
    expect(open.querySelector('[data-testid="collection-tile-lock"]')).toBeNull();
    expect(open.querySelector('[data-icon="globe-outline"]')).toBeNull();
  });

  it('an own tile with nothing in it says so in words, and is named by its title', () => {
    state.mine.data = [col('fresh', [], { owner_id: 'u1' })];
    show();
    expect(screen.getByText('No places yet')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'List fresh, Public' })).toBeTruthy();
  });

  // The Trips screen's pill, in the header, on Yours once there is a
  // list: the dashed row at the foot was found only by scrolling past
  // every list to reach it.
  it('the New pill in the header starts a new one, on Yours and on Community', () => {
    state.mine.data = [col('mine1', ['a'], { owner_id: 'u1' })];
    const { navigation } = show();
    // The dashed row is gone; the pill carries its id for the smoke flows.
    expect(screen.queryByText('New collection')).toBeNull();
    fireEvent.click(screen.getByTestId('collection-new'));
    expect(navigation.navigate).toHaveBeenCalledWith('CollectionForm');
    // Community keeps it too: the pill never added to their lists, it
    // starts one of yours (owner, 16 Oct 2026).
    fireEvent.click(screen.getByRole('tab', { name: /Community/ }));
    fireEvent.click(screen.getByTestId('collection-new'));
    expect(navigation.navigate).toHaveBeenCalledTimes(2);
  });

  // The header is the same on both tabs (owner, 26 Oct 2026): an empty
  // Yours that dropped the pill drew its title and tabs higher than
  // Community's.
  it('keeps the pill on an empty library too, beside its own card', () => {
    show();
    expect(screen.getByTestId('collection-new')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: /Yours/ }));
    expect(screen.getByRole('button', { name: 'New collection' })).toBeTruthy();
    expect(screen.getByText('Create your first collection')).toBeTruthy();
  });

  // No 🔍 beside the title, for a guest or anyone — the dock is the way to
  // the box (owner, 7 Nov 2026) — and under it the tab's sentence, back the
  // same day, which a search no longer turns into an answer.
  it('draws no 🔍 beside the title, and the tab’s own sentence under it, searching or not', () => {
    for (const uid of [null, 'u1']) {
      state.uid = uid;
      state.places = [place('a', 'hanoi')];
      state.cols.data = [col('theirs', ['a'], { title_en: 'Theirs' })];
      state.mine.data = uid ? [col('mine1', ['a'], { owner_id: 'u1', title_en: 'Mine' })] : [];
      show({ tab: 'community' });
      const top = screen.getByTestId('collections-top');
      expect(screen.queryByTestId('collections-search')).toBeNull();
      expect(screen.queryByTestId('collections-filters')).toBeNull();
      expect(top.querySelector('[data-icon="search-outline"]')).toBeNull();
      expect(screen.getByTestId('collections-scope').textContent).toBe('Good corners, through the community’s eyes.');
      // Asked something, the line stays the tab's.
      openBox();
      fireEvent.change(screen.getByTestId('collections-input'), { target: { value: 'theirs' } });
      expect(screen.getByTestId('collections-scope').textContent).toBe('Good corners, through the community’s eyes.');
      if (uid) {
        fireEvent.click(screen.getByRole('tab', { name: /Yours/ }));
        expect(screen.getByTestId('collections-scope').textContent).toBe('Your own favourite places.');
      }
      cleanup();
    }
  });

  // The form goes back to whichever tab sent it; on Community a private
  // new list would be nowhere on screen.
  it('lands on Yours once a list started from Community exists, and not before', () => {
    const navigation = nav();
    const at = (n: number) => Array.from({ length: n }, (_, i) => col(`m${i}`, ['a'], { owner_id: 'u1' }));
    state.mine.data = at(1);
    // Only Community shows someone else's list: which tab is on screen.
    state.cols.data = [col('theirs', ['a'])];
    const view = () => <CollectionsScreen navigation={navigation} route={{ params: { tab: 'community' } }} />;
    const { rerender } = render(view());
    const onCommunity = () => screen.queryByText('List theirs') !== null;
    fireEvent.click(screen.getByTestId('collection-new'));
    // Back with nothing made: a re-render alone does not move the reader.
    rerender(view());
    expect(onCommunity()).toBe(true);
    // The reload lands with one more: Yours.
    state.mine.data = at(2);
    rerender(view());
    expect(onCommunity()).toBe(false);
    // Spent: a later list made elsewhere does not pull the reader again.
    fireEvent.click(screen.getByRole('tab', { name: /Community/ }));
    state.mine.data = at(3);
    rerender(view());
    expect(onCommunity()).toBe(true);
  });

  it('drops the errand when the reader picks a tab by hand, and Yours starts none', () => {
    const navigation = nav();
    const at = (n: number) => Array.from({ length: n }, (_, i) => col(`m${i}`, ['a'], { owner_id: 'u1' }));
    state.mine.data = at(1);
    // Only Community shows someone else's list: which tab is on screen.
    state.cols.data = [col('theirs', ['a'])];
    const view = () => <CollectionsScreen navigation={navigation} route={{ params: { tab: 'community' } }} />;
    const { rerender } = render(view());
    const onCommunity = () => screen.queryByText('List theirs') !== null;
    fireEvent.click(screen.getByTestId('collection-new'));
    fireEvent.click(screen.getByRole('tab', { name: /Yours/ }));
    fireEvent.click(screen.getByRole('tab', { name: /Community/ }));
    state.mine.data = at(2);
    rerender(view());
    expect(onCommunity()).toBe(true);
  });

  it('starts no errand from Yours, even if Community is on screen when the list lands', () => {
    const navigation = nav();
    const at = (n: number) => Array.from({ length: n }, (_, i) => col(`m${i}`, ['a'], { owner_id: 'u1' }));
    state.mine.data = at(1);
    // Only Community shows someone else's list: which tab is on screen.
    state.cols.data = [col('theirs', ['a'])];
    const { rerender } = render(<CollectionsScreen navigation={navigation} route={{ params: {} }} />);
    fireEvent.click(screen.getByTestId('collection-new'));
    // Explore's "See all" re-aims the switch without a tap, so no tap
    // clears anything on the way.
    rerender(<CollectionsScreen navigation={navigation} route={{ params: { tab: 'community', at: 1 } }} />);
    state.mine.data = at(2);
    rerender(<CollectionsScreen navigation={navigation} route={{ params: { tab: 'community', at: 1 } }} />);
    expect(screen.getByText('List theirs')).toBeTruthy();
  });

  // Your own published list is on Community too, as everyone sees it: the
  // two tabs answer "what do I keep" and "what does everyone see here",
  // and a list that answers both belongs on both. It used to be filtered
  // out, and on a city where the only public list was the owner's the
  // shelf read "0 collections" under a card promising it would show.
  it('shows your own published list on Community, with your byline and the same heart', async () => {
    await AsyncStorage.setItem('citycrew.collections.community.view', 'tile');
    const own = col('mine1', ['a'], { owner_id: 'u1', curator_handle: 'me', is_public: true });
    state.mine.data = [own];
    state.cols.data = [own, col('theirs', ['a'], { curator_handle: 'them' })];
    state.likes = { mine1: 2, theirs: 1 };
    show({ tab: 'community' });
    await act(async () => {});
    expect(screen.getByText('List theirs')).toBeTruthy();
    expect(screen.getByText('List mine1')).toBeTruthy();
    expect(screen.getByText('@me')).toBeTruthy();
    // Two heart controls, yours and theirs: a curator may like their own.
    expect(screen.getAllByRole('button', { name: 'Like this collection' })).toHaveLength(2);
    expect(screen.getByText('2')).toBeTruthy();
    state.likes = {};
  });

  // The shelf is every city's, so an empty one is empty everywhere and
  // names no city.
  it('says plainly the community shelf is empty, naming no city', () => {
    show({ tab: 'community' });
    expect(screen.getByText('No public lists yet')).toBeTruthy();
    expect(screen.queryByText(/hanoi/)).toBeNull();
  });

  it('an empty library greets with the community shelf', () => {
    state.cols.data = [col('theirs', ['a'])];
    show();
    // The shelf on screen is the community's, and Yours' empty card is not.
    expect(screen.getByText('List theirs')).toBeTruthy();
    expect(screen.queryByText('No collections yet')).toBeNull();
  });

  it('back on an empty Yours, the first-collection card is the one door', () => {
    const { navigation } = show();
    fireEvent.click(screen.getByRole('tab', { name: /Yours/ }));
    expect(screen.getByText('No collections yet')).toBeTruthy();
    expect(screen.getByText('Only you can see them until you choose to share.')).toBeTruthy();
    expect(screen.queryByText('New collection')).toBeNull();
    fireEvent.click(screen.getByText('Create your first collection'));
    expect(navigation.navigate).toHaveBeenCalledWith('CollectionForm');
  });

  it('an empty community shelf offers a signed-in reader to make the first list', () => {
    const { navigation } = show({ tab: 'community' });
    expect(screen.queryByText('Explore places')).toBeNull();
    fireEvent.click(screen.getByText('Create a collection'));
    expect(navigation.navigate).toHaveBeenCalledWith('CollectionForm');
  });

  it('shows nothing on Yours until your library has loaded — not the empty card', () => {
    state.mine.loaded = false;
    show();
    expect(screen.queryByText('No collections yet')).toBeNull();
    expect(screen.queryByText('New collection')).toBeNull();
    // And no greeting yet: the tab stays on Yours, so the community's
    // empty-shelf card is not what is showing either.
    expect(screen.queryByText('No public lists yet')).toBeNull();
  });

  it("the route's tab wins over a full library, and a fresh param re-aims it", () => {
    state.mine.data = [col('mine1', ['a'], { owner_id: 'u1' })];
    state.cols.data = [col('theirs', ['a'])];
    const navigation = nav();
    const { rerender } = render(<CollectionsScreen navigation={navigation} route={{ params: {} }} />);
    expect(screen.getByText('List mine1')).toBeTruthy();
    rerender(<CollectionsScreen navigation={navigation} route={{ params: { tab: 'community' } }} />);
    expect(screen.getByText('List theirs')).toBeTruthy();
    expect(screen.queryByText('List mine1')).toBeNull();
  });

  it('a second "See all" re-aims the Community tab after the reader switched away', () => {
    state.mine.data = [col('mine1', ['a'], { owner_id: 'u1' })];
    state.cols.data = [col('theirs', ['a'])];
    const navigation = nav();
    const { rerender } = render(
      <CollectionsScreen navigation={navigation} route={{ params: { tab: 'community', at: 1 } }} />,
    );
    expect(screen.getByText('List theirs')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: /Yours/ }));
    expect(screen.getByText('List mine1')).toBeTruthy();
    rerender(<CollectionsScreen navigation={navigation} route={{ params: { tab: 'community', at: 2 } }} />);
    expect(screen.getByText('List theirs')).toBeTruthy();
    expect(screen.queryByText('List mine1')).toBeNull();
  });

  // UX-09: Profile's counts land on Yours with a fresh `at`. The screen
  // is the one left behind when the reader went into a collection, still
  // scrolled to where they were; it starts again from the top.
  it('lands on Yours, from the top, when Profile\'s count sends it', () => {
    state.mine.data = [col('mine1', ['a'], { owner_id: 'u1' })];
    state.cols.data = [col('theirs', ['a'])];
    const navigation = nav();
    const { rerender } = render(
      <CollectionsScreen navigation={navigation} route={{ params: { tab: 'community' } }} />,
    );
    const scroller = screen.getByText('List theirs').closest('[class*="overflowY"]') as HTMLElement;
    scroller.scrollTop = 400;
    rerender(<CollectionsScreen navigation={navigation} route={{ params: { tab: 'yours', at: 5 } }} />);
    expect(screen.getByText('List mine1')).toBeTruthy();
    expect(screen.queryByText('List theirs')).toBeNull();
    expect(scroller.scrollTop).toBe(0);
  });

  it('switching tabs swaps the shelf', () => {
    state.mine.data = [col('mine1', ['a'], { owner_id: 'u1' })];
    state.cols.data = [col('theirs', ['a'])];
    show();
    fireEvent.click(screen.getByRole('tab', { name: /Community/ }));
    expect(screen.getByText('List theirs')).toBeTruthy();
    expect(screen.queryByText('List mine1')).toBeNull();
  });

  it("the heart on somebody else's tile writes the like by id and slug", async () => {
    await AsyncStorage.setItem('citycrew.collections.community.view', 'tile');
    state.cols.data = [col('theirs', ['a'])];
    show({ tab: 'community' });
    await act(async () => {});
    fireEvent.click(screen.getByRole('button', { name: 'Like this collection' }));
    expect(spies.toggleLike).toHaveBeenCalledWith({ id: 'id-theirs', slug: 'theirs' });
    expect(spies.askToSignIn).not.toHaveBeenCalled();
  });

  it('a liked tile offers Unlike and shows the count', async () => {
    await AsyncStorage.setItem('citycrew.collections.community.view', 'tile');
    state.cols.data = [col('theirs', ['a'])];
    state.myLikes = ['id-theirs'];
    state.likes = { theirs: 7 };
    show({ tab: 'community' });
    await act(async () => {});
    const heart = screen.getByRole('button', { name: 'Unlike this collection' });
    expect(heart.textContent).toContain('7');
    expect(heart.querySelector('[data-icon="heart"]')).toBeTruthy();
  });

  it('a list with no id has nothing to like, and tapping does nothing', () => {
    state.cols.data = [col('legacy', ['a'], { id: undefined } as Partial<Collection>)];
    show({ tab: 'community' });
    expect(screen.queryByRole('button', { name: /like this collection/i })).toBeNull();
  });

  it('pulling reloads both shelves and the places in them, and holds the spinner only for the pull', () => {
    state.mine.data = [col('mine1', ['a'], { owner_id: 'u1' })];
    show();
    spies.mineReload.mockClear();
    spies.colsReload.mockClear();
    spies.placesReload.mockClear();
    spies.sharedReload.mockClear();
    spies.mySharesReload.mockClear();
    act(() => { listProps().onRefresh(); });
    expect(spies.mySharesReload).toHaveBeenCalledTimes(1);
    expect(spies.colsReload).toHaveBeenCalledTimes(1);
    expect(spies.mineReload).toHaveBeenCalledTimes(1);
    expect(spies.sharedReload).toHaveBeenCalledTimes(1);
    expect(spies.placesReload).toHaveBeenCalledTimes(1);
    // Nothing is loading, so the spinner disarms as soon as it is armed.
    expect(listProps().refreshing).toBe(false);
  });
});

// One shape a tab (owner, 7 Nov 2026): the list view went from both.
// Yours is the grid with no switch; Community keeps the grid and Mosaic,
// Mosaic first. Edit and Delete, which the list's swipe offered, are in
// the list's own ⋯.
describe('CollectionsScreen — one shape a tab', () => {
  beforeEach(() => { state.uid = 'u1'; });

  // Who can see a list of yours is a glyph on screen, which VoiceOver
  // does not read, so the card's spoken name carries it — only on your
  // own: somebody else's list is public by being there.
  it('says in the tile’s spoken name who can see a list of yours', () => {
    state.mine.data = [
      col('mine1', ['a'], { is_public: false, owner_id: 'u1' }),
      col('mine2', ['a'], { is_public: true, owner_id: 'u1' }),
    ];
    show();
    expect(screen.getByRole('button', { name: 'List mine1, Private' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'List mine2, Public' })).toBeTruthy();
  });

  // Shared with friends (13 Nov 2026): two heads in the padlock's disc,
  // and Friends in the spoken name — the word the list's own page says.
  // A public list's shares wait, so it stays unmarked and Public.
  it('marks a private list shared with friends with two heads, and says Friends', () => {
    const at = '2026-11-13T10:00:00Z';
    state.mine.data = [
      col('lent', ['a'], { is_public: false, owner_id: 'u1' }),
      col('shut', ['a'], { is_public: false, owner_id: 'u1' }),
      col('open', ['a'], { is_public: true, owner_id: 'u1' }),
    ];
    state.myShares = [
      { collection_id: 'id-lent', user_id: 'lan', created_at: at },
      { collection_id: 'id-open', user_id: 'lan', created_at: at },
    ];
    show();
    expect(spies.mySharesFor).toHaveBeenCalledWith('u1');
    const lent = screen.getByRole('button', { name: 'List lent, Friends' });
    const mark = within(lent).getByTestId('collection-tile-shared');
    expect(mark.querySelector('[data-icon="people"]')!.getAttribute('data-size')).toBe('12');
    expect(within(lent).queryByTestId('collection-tile-lock')).toBeNull();
    // The padlock's own disc, so the two are one kind of mark.
    expect(getComputedStyle(mark).width).toBe('24px');
    expect(within(screen.getByRole('button', { name: 'List shut, Private' })).getByTestId('collection-tile-lock')).toBeTruthy();
    const open = screen.getByRole('button', { name: 'List open, Public' });
    expect(open.querySelector('[data-testid^="collection-tile-"][data-testid$="shared"]')).toBeNull();
  });

  it('reads the shares on your lists again when the tab comes back into view', () => {
    show();
    expect(spies.mySharesReload).toHaveBeenCalled();
  });

  it('draws Yours as tiles with no switch, whatever a phone remembered', async () => {
    await AsyncStorage.setItem('citycrew.collections.view', 'row');
    state.mine.data = [col('mine1', ['a'], { owner_id: 'u1' })];
    show();
    await act(async () => {});
    expect(screen.queryByTestId(/^collections-view-/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'List view' })).toBeNull();
    // The tile's count, and no swipe's Delete.
    expect(screen.getByTestId('collection-tile-count')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
  });

  it('offers Community the grid and Mosaic only, Mosaic first, and a remembered list falls back to it', async () => {
    await AsyncStorage.setItem('citycrew.collections.community.view', 'row');
    show({ tab: 'community' });
    await act(async () => {});
    expect(screen.getAllByTestId(/^collections-view-/).map((b) => b.dataset.testid)).toEqual(['collections-view-tile', 'collections-view-mosaic']);
    expect(screen.getByTestId('collections-view-mosaic').getAttribute('aria-selected')).toBe('true');
    expect(screen.queryByRole('button', { name: 'List view' })).toBeNull();
  });
});

describe('CollectionsScreen — search', () => {
  const box = () => { openBox(); return screen.getByPlaceholderText('Name, place, city, user') as HTMLInputElement; };
  const type = (v: string) => fireEvent.change(box(), { target: { value: v } });
  const open = () => fireEvent.focus(box());

  // One way in (owner, 7 Nov 2026): no box at rest and nothing beside the
  // title; the dock opens it, ready for words, with Cancel inside it
  // (15 Oct) and the kinds under it; Cancel puts it all away. No city to
  // choose — a city is typed, and Mosaic is drawn by city.
  it('keeps the box away at rest; the dock opens it with Cancel and the kinds, and Cancel puts it away', () => {
    state.places = [cafe('a'), bar('b', 'danang')];
    state.cols.data = [col('coffee', ['a'], { title_en: 'Coffee' }), col('bars', ['b'], { title_en: 'Bars' })];
    show();
    expect(screen.queryByTestId('collections-input')).toBeNull();
    expect(screen.queryByTestId('collections-kinds')).toBeNull();
    expect(screen.queryByTestId('collections-search')).toBeNull();
    openBox();
    const cancel = screen.getByTestId('collections-cancel');
    expect(box().parentElement!.contains(cancel)).toBe(true);
    expect(document.activeElement).toBe(box());
    const kinds = within(screen.getByTestId('collections-kinds'));
    expect(kinds.getAllByRole('button')).toHaveLength(3);
    ['All', 'Cafés', 'Nightlife'].forEach((k) => expect(kinds.getByRole('button', word(k))).toBeTruthy());
    // No city among them.
    expect(kinds.queryByRole('button', word('danang'))).toBeNull();
    type('cof');
    // Words that leave no bar: Nightlife says 0 and is drawn off, not hidden.
    expect(kinds.getByRole('button', word('Nightlife')).textContent).toBe('Nightlife (0)');
    expect(kinds.getByRole('button', word('Nightlife')).getAttribute('aria-disabled')).toBe('true');
    expect(kinds.getByRole('button', word('Cafés')).getAttribute('aria-disabled')).not.toBe('true');
    fireEvent.click(cancel);
    expect(screen.queryByTestId('collections-input')).toBeNull();
    expect(screen.queryByTestId('collections-cancel')).toBeNull();
    expect(screen.queryByTestId('collections-kinds')).toBeNull();
    expect(screen.queryByTestId('collections-panel')).toBeNull();
    expect(screen.getByText('Bars')).toBeTruthy();
  });

  it('filters by name, says when nothing matches, and comes back when emptied', () => {
    state.cols.data = [col('rooftops', ['a'], { title_en: 'Rooftops' }), col('coffee', ['b'], { title_en: 'Coffee' })];
    show();
    type('roof');
    expect(screen.getByText('Rooftops')).toBeTruthy();
    expect(screen.queryByText('Coffee')).toBeNull();
    type('zzz');
    expect(screen.getByText('Nothing here matches "zzz".')).toBeTruthy();
    // Under a query the empty-shelf invitation stands down.
    expect(screen.queryByText('No public lists yet')).toBeNull();
    // Emptied by the keyboard — there is no (x) — the shelf comes back.
    type('');
    expect(screen.getByText('Coffee')).toBeTruthy();
    expect(screen.queryByTestId('collections-clear')).toBeNull();
  });

  it('matches by a place inside the list, and says which place', async () => {
    await AsyncStorage.setItem('citycrew.collections.community.view', 'tile');
    state.cols.data = [col('one', ['a']), col('two', ['b'])];
    show();
    await act(async () => {});
    type('Place b');
    expect(screen.getByText('List two')).toBeTruthy();
    expect(screen.queryByText('List one')).toBeNull();
    // The one thing the card could not tell the reader: why it is here.
    expect(screen.getByText('Place b')).toBeTruthy();
    expect(screen.queryByText(/matches/)).toBeNull();
  });

  it('matches by the city the places are in, typed as words', () => {
    state.places = [place('a', 'hanoi'), place('b', 'danang')];
    state.cols.data = [col('one', ['a']), col('two', ['b'])];
    show();
    open();
    // The Community shelf is the app's city; the words reach past it only
    // through the chip — see the scope test — so here the words find the
    // list of the city on screen.
    type('hanoi');
    expect(screen.getByText('List one')).toBeTruthy();
  });

  // Cancel lets go of everything the box holds — the words and the kind
  // — since they are one tool again (7 Nov 2026).
  it('Cancel lets go of the words and the kind, and puts the box away', () => {
    state.places = [cafe('a'), bar('b')];
    state.cols.data = [col('rooftops', ['a'], { title_en: 'Rooftops' }), col('coffee', ['b'], { title_en: 'Coffee' })];
    show();
    open();
    pickKind('Nightlife');
    type('roof');
    expect(screen.queryByText('Rooftops')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByTestId('collections-input')).toBeNull();
    expect(screen.getByText('Coffee')).toBeTruthy();
    expect(screen.getByText('Rooftops')).toBeTruthy();
    expect(screen.queryByTestId('collections-kinds')).toBeNull();
  });

  // The panel is the box's: what was searched here before, and nothing
  // else — no filters, and no hint repeating the placeholder (owner, 25
  // Oct 2026). With nothing remembered it draws nothing at all.
  it('keeps the panel to the box’s own business: suggestions, or nothing', async () => {
    state.places = [cafe('a', 'hanoi'), bar('c', 'danang')];
    state.cols.data = [col('one', ['a']), col('two', ['c'])];
    show();
    open();
    expect(screen.queryByTestId('collections-panel')).toBeNull();
    expect(screen.queryByText('Type a name, a place, or a city.')).toBeNull();
    cleanup();
    await AsyncStorage.setItem('citycrew.recentCollectionSearches', JSON.stringify(['rooftops']));
    show();
    open();
    const panel = within(await screen.findByTestId('collections-panel'));
    expect(panel.getByText('rooftops')).toBeTruthy();
    expect(panel.queryByText('City')).toBeNull();
    // The kinds are their own row, outside the suggestions.
    expect(panel.queryByRole('button', word('All'))).toBeNull();
    await AsyncStorage.removeItem('citycrew.recentCollectionSearches');
  });

  // While a kind is on the box stays open, the kind in sight in its
  // row — even once the keyboard has gone with the panel.
  it('keeps the box and the kind in sight while a kind is on, and the dock puts the keyboard back', () => {
    state.places = [cafe('a', 'hanoi'), bar('c', 'danang')];
    state.cols.data = [col('one', ['a'], { title_en: 'Hanoi cafés' }), col('two', ['c'], { title_en: 'Da Nang bars' })];
    show();
    open();
    expect(screen.getByTestId('collections-kinds-all').getAttribute('aria-selected')).toBe('true');
    pickKind('Cafés');
    // A kind is an answer: the panel and the keyboard go, the box stays.
    expect(screen.queryByTestId('collections-panel')).toBeNull();
    expect(document.activeElement).not.toBe(box());
    expect(screen.getByTestId('collections-kind-cafes').getAttribute('aria-selected')).toBe('true');
    expect(screen.queryByText('Da Nang bars')).toBeNull();
    expect(screen.getByText('Hanoi cafés')).toBeTruthy();
    // The dock again, from deep in the shelf, while open: the keyboard
    // comes back to the box.
    state.ducked = true;
    scrollTo(400);
    fireEvent.click(screen.getByTestId('collections-dock').firstElementChild as HTMLElement);
    scrollTo(0);
    expect(document.activeElement).toBe(box());
    // "All" lets go of the kind; the box stays while it is asked for.
    pickKind('All');
    expect(screen.getByText('Da Nang bars')).toBeTruthy();
    expect(screen.getByTestId('collections-input')).toBeTruthy();
  });

  it('on your own tab a miss shows the honest footer, and the pill stays', () => {
    state.uid = 'u1';
    state.mine.data = [col('mine1', ['a'], { owner_id: 'u1' })];
    show();
    type('zzz');
    expect(screen.getByText('Nothing here matches "zzz".')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'New collection' })).toBeTruthy();
  });

  // Dragging the shelf is asking to read it: the panel folds, and what it
  // chose stays. React Native Web never fires a drag, so the list's own
  // handler is called, found the way CollectionDetail's tests find theirs.
  it('folds the panel when the shelf is dragged, and keeps what it chose', () => {
    state.places = [cafe('a'), bar('c')];
    state.cols.data = [col('one', ['a']), col('two', ['c'])];
    show();
    const drag = () => {
      const el = screen.getByTestId('collections-top');
      const key = Object.keys(el).find((k) => k.startsWith('__reactFiber'))!;
      type Fiber = { memoizedProps?: Record<string, unknown>; child?: Fiber; sibling?: Fiber; return?: Fiber };
      let top = (el as unknown as Record<string, Fiber>)[key];
      while (top.return) top = top.return;
      const stack: Fiber[] = [top];
      while (stack.length) {
        const fb = stack.pop()!;
        const p = fb.memoizedProps;
        if (p && typeof p.onScrollBeginDrag === 'function' && 'sections' in p) {
          act(() => { (p.onScrollBeginDrag as () => void)(); });
          return;
        }
        if (fb.sibling) stack.push(fb.sibling);
        if (fb.child) stack.push(fb.child);
      }
      throw new Error('no list');
    };
    // At rest a drag is only a drag.
    drag();
    expect(screen.queryByTestId('collections-panel')).toBeNull();
    open();
    type('one');
    drag();
    expect(screen.queryByTestId('collections-panel')).toBeNull();
    // The words are still in the box, and Cancel is still the way to let
    // them go.
    expect(box().value).toBe('one');
    expect(screen.getByTestId('collections-cancel')).toBeTruthy();
  });

  // ── the panel ──
  //
  // A chip asks about places: "Cafés" lists a collection for the cafés
  // in it and the card says how many of its places those are.
  const cafe = (slug: string, city = 'hanoi') => ({ ...place(slug, city), categories: ['cafes'] } as unknown as Place);
  const bar = (slug: string, city = 'hanoi') => ({ ...place(slug, city), categories: ['nightlife'] } as unknown as Place);

  it('offers only the kinds its lists hold, narrows by one, and counts the places it reached', async () => {
    await AsyncStorage.setItem('citycrew.collections.community.view', 'tile');
    state.places = [cafe('a'), cafe('b'), bar('c'), bar('d')];
    state.cols.data = [col('mixed', ['a', 'c', 'd'], { title_en: 'Mixed', curator_handle: 'minh' }), col('bars', ['d'], { title_en: 'Bars' })];
    show();
    await act(async () => {});
    open();
    expect(screen.queryByRole('button', word('Nature'))).toBeNull();
    pickKind('Cafés');
    expect(screen.getByText('Mixed')).toBeTruthy();
    expect(screen.queryByText('Bars')).toBeNull();
    expect(screen.getByText('1 of 3 places · Cafés')).toBeTruthy();
    // "All" lets go.
    pickKind('All');
    expect(screen.getByText('Bars')).toBeTruthy();
    expect(screen.queryByText('1 of 3 places · Cafés')).toBeNull();
  });

  // A kind the shelf holds none of is drawn off, not hidden; carried to
  // the other shelf, a kind that reaches nothing says so.
  it('says so when nothing has a place the kind asks for, in words or without', () => {
    state.uid = 'u1';
    state.places = [cafe('a', 'hanoi'), bar('c', 'danang')];
    state.mine.data = [col('m1', ['a'], { owner_id: 'u1', title_en: 'My cafés' }), col('m2', ['c'], { owner_id: 'u1', title_en: 'My bars' })];
    state.cols.data = [col('two', ['c'], { title_en: 'Bars' })];
    show();
    open();
    pickKind('Cafés');
    expect(screen.getByText('My cafés')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: 'Community' }));
    // Words: the miss names them.
    type('cafes');
    expect(screen.getByText('Nothing here matches "cafes".')).toBeTruthy();
    // The kind alone: Community has no café — and the kind is still in
    // the row, on, where this shelf would not offer it.
    type('');
    expect(screen.getByText('No collections match that choice.')).toBeTruthy();
    expect(screen.getByTestId('collections-kind-cafes').getAttribute('aria-selected')).toBe('true');
  });

  // ── no city to choose ──
  //
  // Both shelves show every city (owner, 15 Oct 2026). Since 7 Nov 2026
  // there is no city filter: a city is typed (see the city test above),
  // and Mosaic is drawn by city.
  it('shows every city on Community at rest, and narrows to one typed by name', () => {
    state.places = [place('a', 'hanoi'), place('b', 'danang'), place('c', 'danang')];
    state.cols.data = [col('hn', ['a'], { title_en: 'Hanoi list' }), col('dn', ['b', 'c'], { title_en: 'Da Nang list' })];
    show();
    expect(screen.getByText('Hanoi list')).toBeTruthy();
    expect(screen.getByText('Da Nang list')).toBeTruthy();
    type('danang');
    expect(screen.queryByText('Hanoi list')).toBeNull();
    expect(screen.getByText('Da Nang list')).toBeTruthy();
  });

  // A city typed whole is a city chosen (owner, 7 Nov 2026): "Đà Lạt" was
  // answered by a Hanoi list "… After Dark … until late" and by "Đà Nẵng
  // … run late", neither with a place in Đà Lạt.
  it('narrows to the city a whole query names, by any of its names', () => {
    state.cities = [
      { id: 'dalat', short_en: 'Da Lat', short_vi: 'Đà Lạt', short_ja: 'ダラット', name_en: 'Da Lat', name_vi: 'Đà Lạt', name_ja: 'ダラット' },
      { id: 'hanoi', short_en: 'Hanoi', short_vi: 'Hà Nội', short_ja: 'ハノイ', name_en: 'Hanoi', name_vi: 'Hà Nội', name_ja: 'ハノイ' },
      { id: 'hue', short_en: 'Hue', short_vi: 'Huế', short_ja: 'フエ', name_en: 'Hue', name_vi: 'Huế', name_ja: 'フエ' },
    ];
    state.places = [cafe('a', 'hanoi'), place('b', 'danang'), cafe('d', 'dalat')];
    state.cols.data = [
      col('hn', ['a'], { title_en: 'Hoan Kiem After Dark', desc_en: 'Open until late' }),
      col('dn', ['b'], { title_en: 'Da Nang late', desc_en: 'Places that run late' }),
      col('dl', ['d'], { title_en: 'Pine hills' }),
    ];
    show();
    // The Japanese name is on no list's words: only the city answers it.
    for (const q of ['Đà Lạt', 'da lat', 'Dalat', 'ダラット']) {
      type(q);
      expect(screen.queryByText('Hoan Kiem After Dark')).toBeNull();
      expect(screen.queryByText('Da Nang late')).toBeNull();
      expect(screen.getByText('Pine hills')).toBeTruthy();
      // The kinds count inside the city too: one list, not the Hanoi café's as well.
      expect(screen.getByTestId('collections-kinds-all').textContent).toBe('All (1)');
      expect(screen.getByTestId('collections-kind-cafes').textContent).toBe('Cafés (1)');
    }
    // A city with no list is still the question: nothing, not every list.
    type('Huế');
    expect(screen.queryByText('Pine hills')).toBeNull();
    expect(screen.queryByText('Hoan Kiem After Dark')).toBeNull();
    expect(screen.getByTestId('collections-kinds-all').textContent).toBe('All (0)');
    // One word more and it is words again, found where they land.
    type('da lat pine');
    expect(screen.getByText('Pine hills')).toBeTruthy();
    type('dark');
    expect(screen.getByText('Hoan Kiem After Dark')).toBeTruthy();
    expect(screen.queryByText('Pine hills')).toBeNull();
  });

  // With the line under the title gone, the city typed is named where the
  // answer is partial: on the tile, "1 of 2 places · Da Lat".
  it('names the typed city on a tile it reaches only in part', async () => {
    await AsyncStorage.setItem('citycrew.collections.community.view', 'tile');
    state.cities = [{ id: 'dalat', short_en: 'Da Lat', short_vi: 'Đà Lạt', short_ja: 'ダラット', name_en: 'Da Lat', name_vi: 'Đà Lạt', name_ja: 'ダラット' }];
    state.places = [place('d', 'dalat'), place('h', 'hanoi')];
    state.cols.data = [col('both', ['d', 'h'], { title_en: 'Two cities' })];
    show();
    await act(async () => {});
    type('Đà Lạt');
    expect(screen.getByText('1 of 2 places · Da Lat')).toBeTruthy();
  });

  it('shows a list from another city with no chip to reach it', () => {
    state.places = [place('b', 'danang')];
    state.cols.data = [col('dn', ['b'], { title_en: 'Da Nang list' })];
    show();
    expect(screen.getByText('Da Nang list')).toBeTruthy();
  });

  it('remembers the words when a card they found is opened', async () => {
    state.cols.data = [col('rooftops', ['a'], { title_en: 'Rooftops' })];
    show();
    type('roof');
    fireEvent.click(screen.getByText('Rooftops'));
    await waitFor(async () => {
      expect(JSON.parse((await AsyncStorage.getItem('citycrew.recentCollectionSearches')) ?? '[]')).toEqual(['roof']);
    });
    await AsyncStorage.removeItem('citycrew.recentCollectionSearches');
  });

  // ── what the box remembers ──
  it('remembers a search on return, offers it back, and clears the drawer', async () => {
    await AsyncStorage.setItem('citycrew.recentCollectionSearches', JSON.stringify(['rooftops']));
    state.cols.data = [col('rooftops', ['a'], { title_en: 'Rooftops' })];
    show();
    await waitFor(() => { open(); expect(screen.getByText('Suggestions')).toBeTruthy(); });
    fireEvent.click(screen.getByRole('button', { name: 'rooftops' }));
    expect(box().value).toBe('rooftops');
    type('coffee');
    fireEvent.keyDown(box(), { key: 'Enter' });
    await waitFor(async () => {
      expect(JSON.parse((await AsyncStorage.getItem('citycrew.recentCollectionSearches')) ?? '[]')).toEqual(['coffee', 'rooftops']);
    });
    // Offered narrowed by what is typed, never the word already in the box.
    open();
    expect(screen.queryByText('Suggestions')).toBeNull();
    type('');
    expect(screen.getByRole('button', { name: 'coffee' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Clear suggestions' }));
    expect(screen.queryByText('Suggestions')).toBeNull();
    await AsyncStorage.removeItem('citycrew.recentCollectionSearches');
  });
});

// Its tab pressed again at this root scrolls back to the top. The press
// is React Navigation's to hear; what is this screen's is the ref, and a
// ref left off the list would hand over null and scroll nothing.
// ── "New", on a list made this week (owner, 29 Oct 2026) ──
describe('the New badge', () => {
  const ago = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

  it("sits on somebody's list made this week, and is in its spoken name", async () => {
    await AsyncStorage.setItem('citycrew.collections.community.view', 'tile');
    state.cols.data = [
      col('fresh', ['a'], { created_at: ago(2) }),
      col('old', ['a'], { created_at: ago(30) }),
    ];
    show();
    await act(async () => {});
    expect(screen.getAllByTestId('new-badge')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'List fresh, New' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'List old' })).toBeTruthy();
    // The badge is inside the tile it labels.
    expect(within(screen.getByRole('button', { name: 'List fresh, New' })).getByTestId('new-badge')).toBeTruthy();
  });

  it('marks the shelf before it knows who is reading, and keeps it', async () => {
    await AsyncStorage.setItem('citycrew.collections.community.view', 'tile');
    state.pending = true;
    state.cols.data = [col('fresh', ['a'], { owner_id: 'u2', created_at: ago(2) })];
    const { rerender } = show();
    await act(async () => {});
    expect(screen.getAllByTestId('new-badge')).toHaveLength(1);
    state.pending = false;
    rerender(<CollectionsScreen navigation={nav()} route={{ params: undefined }} />);
    expect(screen.getAllByTestId('new-badge')).toHaveLength(1);
  });

  // Yours too (owner, 31 Oct 2026): the author sees their new list the
  // way everybody else does.
  it('on your own as well, on either tab', async () => {
    await AsyncStorage.setItem('citycrew.collections.community.view', 'tile');
    state.uid = 'u1';
    const own = col('mine1', ['a'], { owner_id: 'u1', is_public: true, created_at: ago(1) });
    const older = col('mine2', ['a'], { owner_id: 'u1', is_public: true, created_at: ago(30) });
    state.mine.data = [own, older];
    state.cols.data = [own, older];
    show();
    await act(async () => {});
    expect(within(screen.getByRole('button', { name: 'List mine1, New, Public' })).getByTestId('new-badge')).toBeTruthy();
    expect(screen.getAllByTestId('new-badge')).toHaveLength(1);
    cleanup();
    show({ tab: 'community' });
    await act(async () => {});
    expect(screen.getByText('List mine1')).toBeTruthy();
    expect(screen.getAllByTestId('new-badge')).toHaveLength(1);
  });
  // Community's own view, the Mosaic, marks a new list too — it did not
  // from #1257 until the owner missed it (11 Nov 2026). The three captions
  // each put it somewhere sensible: on the photograph's corner, unless
  // the caption itself holds that corner, where it heads the caption.
  it('on the Mosaic too, in the corner whichever way the caption sits', async () => {
    // new3 → caption top, new1 → bottom, new2 → below (`mosaicCaption`).
    state.cols.data = [
      col('new3', ['a'], { created_at: ago(1), curator_handle: 'c3' }),
      col('new1', ['a'], { created_at: ago(2), curator_handle: 'c1' }),
      col('new2', ['a'], { created_at: ago(3), curator_handle: 'c2' }),
      col('old', ['a'], { created_at: ago(30), curator_handle: 'c0' }),
    ];
    show({ tab: 'community' });
    await act(async () => {});
    expect(screen.getAllByTestId('new-badge')).toHaveLength(3);
    expect(screen.getByRole('button', { name: 'List new3, New, @c3' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'List old, @c0' })).toBeTruthy();
    // Caption on top: the badge heads the caption, before the title.
    const top = screen.getByTestId('collection-mosaic-scrim-new3');
    const badge = within(top).getByTestId('new-badge');
    expect(badge.compareDocumentPosition(within(top).getByText('List new3')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(getComputedStyle(badge).position).toBe('relative');
    // Caption at the foot or below: the badge is the photograph's own,
    // pinned in its corner, and not inside the caption.
    for (const slug of ['new1', 'new2']) {
      const photo = screen.getByTestId(new RegExp(`^collection-mosaic-${slug}-(bottom|below)$`));
      const mark = within(photo).getByTestId('new-badge');
      expect(getComputedStyle(mark).position).toBe('absolute');
      expect(mark.parentElement).toBe(photo);
    }
  });
});

describe('its tab, pressed again', () => {
  it('hands the scroll to the top the screen’s own list', async () => {
    show();
    const ref = vi.mocked(useScrollToTop).mock.calls.at(-1)?.[0] as { current: unknown };
    expect(ref.current).toHaveProperty('scrollToLocation');
  });
});

// ── the title goes up, the tabs pin, the dock comes (owner, 25 Oct 2026) ──
describe('scrolled', () => {
  const box = () => { openBox(); return screen.getByTestId('collections-input') as HTMLInputElement; };
  const signedIn = () => {
    state.uid = 'u1';
    state.mine.data = [col('m1', ['a'], { owner_id: 'u1', title_en: 'Mine' })];
  };

  it('scrolls the title, the box and the tabs with the shelf', () => {
    signedIn();
    show();
    // One header holds them all: the title is the list's, not the screen's.
    const top = screen.getByTestId('collections-top');
    expect(within(top).getByText('Collections')).toBeTruthy();
    expect(top.contains(box())).toBe(true);
    expect(top.contains(screen.getByTestId('collections-yours'))).toBe(true);
    expect(top.contains(screen.getByTestId('collection-new'))).toBe(true);
    expect(screen.getAllByText('Collections')).toHaveLength(1);
  });

  it('pins the tabs once they reach the top, and lets them go above it', () => {
    signedIn();
    show();
    laidOut();
    scrollTo(119);
    expect(screen.queryByTestId('collections-pinned')).toBeNull();
    scrollTo(120);
    const pinned = screen.getByTestId('collections-pinned');
    expect(within(pinned).queryByRole('heading')).toBeNull();
    expect(within(pinned).queryByRole('button', { name: 'Find a collection' })).toBeNull();
    expect(within(pinned).queryByText('New')).toBeNull();
    expect(pinned.textContent).toContain('Yours');
    expect(pinned.textContent).toContain('Community');
    expect(screen.getByTestId('collections-top').getAttribute('aria-hidden')).toBe('true');
    scrollTo(400);
    scrollTo(395); // Thumb wobble does not reveal the header.
    expect(screen.queryByTestId('collections-floating-top')).toBeNull();
    scrollTo(380);
    expect(within(pinned).getByText('Collections').textContent).toBe('Collections');
    expect(within(pinned).getByRole('button', { name: 'New collection' })).toBeTruthy();
    // Nothing beside the title in the copy either (owner, 7 Nov 2026).
    expect(within(pinned).queryByRole('button', { name: 'Find a collection' })).toBeNull();
    // The box is not open, so the copy draws none either.
    expect(screen.queryByTestId('collections-floating-input')).toBeNull();
    scrollTo(40); // Full header stays available before reaching the top.
    expect(screen.getByTestId('collections-floating-top')).toBeTruthy();
    scrollTo(0);
    expect(screen.queryByTestId('collections-pinned')).toBeNull();
    expect(screen.getByTestId('collections-top').getAttribute('aria-hidden')).not.toBe('true');
  });

  it.each([['community', 'tile'], ['community', 'mosaic'], ['yours', 'tile']] as const)('collapses and reveals %s in %s without a scroll jump', async (tab, layout) => {
    signedIn();
    state.cols.data = [col('public', ['a'])];
    if (tab === 'community') await AsyncStorage.setItem('citycrew.collections.community.view', layout);
    const { navigation } = show(tab === 'community' ? { tab } : undefined);
    if (tab === 'community') {
      await waitFor(() => expect(screen.getByRole('button', { name: layout === 'tile' ? 'Tile view' : 'Mosaic view' }).getAttribute('aria-selected')).toBe('true'));
    }
    openBox();
    laidOut();
    scrollTo(500);
    const pinned = screen.getByTestId('collections-pinned');
    expect(within(pinned).queryByRole('heading')).toBeNull();
    scrollTo(480);
    const floating = screen.getByTestId('collections-floating-top');
    const input = screen.getByTestId('collections-floating-input');
    expect(getComputedStyle(screen.getByTestId('collections-top')).height).toBe('260px');
    fireEvent.focus(input);
    expect(within(floating).getByTestId('collections-floating-cancel')).toBeTruthy();
    fireEvent.change(input, { target: { value: 'public' } });
    expect(screen.getByTestId('collections-input').getAttribute('value')).toBe('public');
    fireEvent.click(within(floating).getByRole('button', { name: 'New collection' }));
    expect(navigation.navigate).toHaveBeenCalledWith('CollectionForm');
    // Cancel puts the box away, from the copy as from the header.
    fireEvent.click(screen.getByTestId('collections-floating-cancel'));
    expect(screen.queryByTestId('collections-floating-input')).toBeNull();
    expect(screen.queryByTestId('collections-input')).toBeNull();
    expect(getComputedStyle(screen.getByTestId('collections-top')).height).toBe('260px');
    scrollTo(488); // Small reversal is ignored.
    expect(screen.getByTestId('collections-floating-top')).toBeTruthy();
    scrollTo(510);
    expect(screen.queryByTestId('collections-floating-top')).toBeNull();
    // Bottom rubber-band excursion and return cannot reveal the header.
    scrollTo(2156);
    scrollTo(2200);
    scrollTo(2156);
    expect(screen.queryByTestId('collections-floating-top')).toBeNull();
    scrollTo(2136);
    expect(screen.getByTestId('collections-floating-top')).toBeTruthy();
  });

  it('pins a guest nothing: there is no switch to keep', () => {
    show();
    laidOut();
    scrollTo(300);
    expect(screen.queryByTestId('collections-pinned')).toBeNull();
  });

  it('reveals the open box and its kind on reverse scroll', () => {
    signedIn();
    state.places = [{ ...place('a', 'hanoi'), categories: ['cafes'] }, { ...place('b', 'saigon'), categories: ['nightlife'] }];
    state.mine.data = [col('m1', ['a'], { owner_id: 'u1' }), col('m2', ['b'], { owner_id: 'u1' })];
    show();
    openBox();
    pickKind('Cafés');
    laidOut();
    scrollTo(400);
    expect(screen.queryByTestId('collections-floating-top')).toBeNull();
    scrollTo(380);
    const pinned = within(screen.getByTestId('collections-pinned'));
    expect(screen.getByTestId('collections-floating-input')).toBeTruthy();
    expect(pinned.getByRole('button', word('Cafés')).getAttribute('aria-selected')).toBe('true');
  });

  it('lends the dock once past the header with the bar away: the box, and a new list', async () => {
    signedIn();
    state.ducked = true;
    const { navigation } = show();
    laidOut();
    scrollTo(259);
    await new Promise((r) => setTimeout(r, 200));
    expect(screen.queryByTestId('collections-dock')).toBeNull();
    scrollTo(260);
    await waitFor(() => expect(screen.getByTestId('collections-dock').textContent).toBe('Find a collectionBy name or placeNew'));
    const pill = screen.getByTestId('collections-dock-new');
    expect(pill.getAttribute('aria-label')).toBe('New collection');
    // Filled in the dock, quiet in the header (owner, 26 Oct 2026).
    expect(pill.querySelector('[data-stub="LinearGradient"]')).toBeTruthy();
    expect(screen.getByTestId('collection-new').querySelector('[data-stub="LinearGradient"]')).toBeNull();
    fireEvent.click(pill);
    expect(navigation.navigate).toHaveBeenCalledWith('CollectionForm');
    // The island is the box: focused, which opens the panel, and the
    // dock steps aside for it.
    fireEvent.click(screen.getByTestId('collections-dock').firstElementChild as HTMLElement);
    expect(document.activeElement).toBe(box());
    expect(screen.getByTestId('collections-cancel')).toBeTruthy();
    await waitFor(() => expect(screen.queryByTestId('collections-dock')).toBeNull());
  });

  it('offers a guest the box alone, and nothing while the bar is up', async () => {
    state.ducked = true;
    show();
    laidOut();
    scrollTo(400);
    await waitFor(() => expect(screen.getByTestId('collections-dock')).toBeTruthy());
    expect(screen.queryByTestId('collections-dock-new')).toBeNull();
    cleanup();
    state.ducked = false;
    show();
    laidOut();
    scrollTo(400);
    await new Promise((r) => setTimeout(r, 200));
    expect(screen.queryByTestId('collections-dock')).toBeNull();
  });
});

describe('CollectionsScreen — Mosaic', () => {
  const seed = () => {
    state.cols.data = Array.from({ length: 12 }, (_, i) => col(`mosaic-${i}`, ['a'], {
      curator_handle: `curator${i}`,
      desc_en: i === 0 ? 'A morning across the city' : null,
    }));
  };

  it('opens Community in Mosaic, preserving order and navigation without tile actions or place counts', () => {
    state.uid = 'u1';
    seed();
    const { navigation } = show({ tab: 'community' });
    expect(screen.getByRole('button', { name: 'Mosaic view' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getAllByTestId('collection-mosaic-row-feature')).toHaveLength(2);
    expect(screen.getAllByTestId('collection-mosaic-row-stack')).toHaveLength(2);
    expect(screen.getAllByTestId('collection-mosaic-row-pair')).toHaveLength(2);
    expect(screen.getAllByTestId(/^collection-card-/).map(c => c.getAttribute('aria-label')))
      .toEqual(Array.from({ length: 12 }, (_, i) => `List mosaic-${i}, @curator${i}`));
    expect(screen.queryByRole('button', { name: /like this collection/i })).toBeNull();
    expect(screen.queryByTestId('collection-tile-count')).toBeNull();
    fireEvent.click(screen.getByTestId('collection-card-3'));
    expect(navigation.navigate).toHaveBeenCalledWith('CollectionDetail', { slug: 'mosaic-3' });
  });

  it('keeps each caption with its collection while searching changes its position and card size', () => {
    seed();
    show();
    const captions = screen.getAllByTestId(/^collection-mosaic-mosaic-/).map(e => e.dataset.testid);
    expect(captions.some(id => id!.endsWith('-top'))).toBe(true);
    expect(captions.some(id => id!.endsWith('-bottom'))).toBe(true);
    expect(captions.some(id => id!.endsWith('-below'))).toBe(true);
    const original = captions.find(id => id!.includes('mosaic-3-'))!;
    openBox();
    fireEvent.change(screen.getByPlaceholderText('Name, place, city, user'), { target: { value: 'List mosaic-3' } });
    expect(screen.getByTestId(original)).toBeTruthy();
    expect(screen.queryByText('List mosaic-0')).toBeNull();
    fireEvent.change(screen.getByPlaceholderText('Name, place, city, user'), { target: { value: '' } });
    expect(screen.getByTestId(original)).toBeTruthy();
  });

  it('remembers the community’s grid-or-Mosaic choice, and draws Yours as tiles either way', async () => {
    state.uid = 'u1';
    state.cols.data = [col('theirs', ['a'])];
    state.mine.data = [col('mine1', ['a'], { owner_id: 'u1' })];
    show({ tab: 'community' });
    fireEvent.click(screen.getByRole('button', { name: 'Tile view' }));
    expect(screen.queryByTestId('collection-mosaic-row-feature')).toBeNull();
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('citycrew.collections.community.view', 'tile');
    fireEvent.click(screen.getByRole('button', { name: 'Mosaic view' }));
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('citycrew.collections.community.view', 'mosaic');
    // The ids 21-tab-bar-responsive picks a view by, one per button.
    for (const [v, name] of [['tile', 'Tile view'], ['mosaic', 'Mosaic view']]) {
      expect(screen.getByTestId(`collections-view-${v}`).getAttribute('aria-label')).toBe(name);
    }
    fireEvent.click(screen.getByRole('tab', { name: /Yours/ }));
    expect(screen.queryByRole('button', { name: 'Mosaic view' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Tile view' })).toBeNull();
    expect(screen.getByTestId('collection-tile-foot')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: /Community/ }));
    expect(screen.getByTestId('collection-mosaic-row-feature')).toBeTruthy();
    cleanup();
    show({ tab: 'community' });
    await screen.findByTestId('collection-mosaic-row-feature');
    expect(screen.getByRole('button', { name: 'Mosaic view' }).getAttribute('aria-selected')).toBe('true');
  });

  it('renders chosen and missing photos, optional authors and a feature description', () => {
    state.cols.data = [
      col('mosaic-0', ['a'], { desc_en: 'A morning across the city', cover: { photo_uri: 'https://img/feature.jpg' } }),
      col('mosaic-1', ['b']), col('mosaic-2', ['a']), col('mosaic-3', ['a']), col('mosaic-4', ['a']),
    ];
    show();
    expect(document.querySelector('img[src="https://img/feature.jpg"]')).toBeTruthy();
    expect(screen.getByText('A morning across the city')).toBeTruthy();
    expect(screen.queryByText(/^@/)).toBeNull();
    expect(icons('bookmark-outline')).toBeGreaterThan(0);
    expect(screen.getAllByTestId(/^collection-card-/)).toHaveLength(5);
  });

  it('ignores an invalid community preference and gives guests the Mosaic default', async () => {
    await AsyncStorage.setItem('citycrew.collections.community.view', 'bogus');
    state.cols.data = [col('mosaic-0', ['a'])];
    show();
    await act(async () => {});
    expect(screen.getByTestId('collection-mosaic-row-feature')).toBeTruthy();
    expect(screen.queryByRole('tab')).toBeNull();
  });
});

/** Committed props of the element whose testID is `id`. The gradients'
 *  `start`, `end` and style objects do not survive into the DOM. */
const propsOf = (id: string): Record<string, unknown> => {
  type Fiber = { child: Fiber | null; sibling: Fiber | null; memoizedProps: Record<string, unknown> | null };
  const host = document.body.firstElementChild as unknown as Record<string, { stateNode: { current: Fiber } }>;
  const key = Object.keys(host).find((k) => k.startsWith('__reactContainer'))!;
  const stack: Fiber[] = [host[key].stateNode.current];
  while (stack.length) {
    const f = stack.pop()!;
    const p = f.memoizedProps;
    if (p && typeof p === 'object' && p.testID === id) return p;
    if (f.sibling) stack.push(f.sibling);
    if (f.child) stack.push(f.child);
  }
  throw new Error(`no element ${id}`);
};

// The dark follows the words (owner, 5 Nov 2026): it lives inside the
// caption, so it is as long as the caption is, and a tail hangs off the
// caption's far side. Both run from the edge the caption sits on.
// One block a city, under its name (owner, 5 Nov 2026): Ốc Hà Nội sat
// over Ngọt Sài Gòn beside Hội An and Đà Lạt for no reason but the date.
describe('the Community Mosaic, one block a city', () => {
  const seed = () => {
    state.uid = 'u1';
    state.cities = ['hanoi', 'hcmc', 'hue', 'dalat'].map((id) => ({
      id, short_en: { hanoi: 'Hanoi', hcmc: 'Saigon', hue: 'Huế', dalat: 'Đà Lạt' }[id], short_vi: id, short_ja: id, name_en: id, name_vi: id, name_ja: id,
    }));
    state.places = [place('n', 'hanoi'), place('s', 'hcmc'), place('h', 'hue'), place('d', 'dalat')];
    // Newest first, cities interleaved, as the catalog sends them; one
    // list stamped Saigon with its places in Hanoi.
    state.cols.data = [
      col('s1', ['s']), col('n1', ['n']), col('h1', ['h']), col('s2', ['s']), col('n2', ['n']),
      col('d1', ['d']), col('s3', ['s']), col('n3', ['n'], { city_id: 'hcmc' }), col('s4', ['s']),
    ];
    state.likes = { s3: 2 };
  };
  const heads = () => screen.queryAllByTestId(/^collection-mosaic-city-/).map((h) => h.textContent);
  const order = () => screen.getAllByTestId(/^collection-card-/).map((c) => c.getAttribute('aria-label'));

  it('heads each city with its name and count, the reader’s city first, the small ones together last', () => {
    seed();
    show({ tab: 'community' });
    // The first block is named only once the list moves (owner, 7 Nov
    // 2026), by the pinned bar; at rest its slot is a gap.
    expect(heads()).toEqual(['Saigon4 collections', 'Elsewhere2 collections']);
    expect(screen.getByTestId('collections-first-gap')).toBeTruthy();
    // The block is the city's: liked list first, then arrival order.
    // The list draws its first ten items (rows and headings alike) on
    // mount; the last pair of "elsewhere" is past them.
    expect(order()).toEqual(['List n1', 'List n2', 'List n3', 'List s3', 'List s1', 'List s2', 'List s4', 'List h1']);
    expect(screen.getAllByTestId(/^collection-card-/).map((c) => c.dataset.testid))
      .toEqual(Array.from({ length: 8 }, (_, i) => `collection-card-${i}`));
  });

  // At rest no city is named under the search box (owner, 7 Nov 2026);
  // the first block's slot is the gap, and box + gap is a screen head's
  // gap, as the heading's was (6 Nov). Later headings keep the 24 that
  // parts a block from the one before.
  // The row above it is the tabs at rest (the box is shut since 7 Nov
  // 2026) and the box once open; both leave the same 14.
  it('leaves a screen-head gap under the last row where the first heading was, the rest a block apart', () => {
    seed();
    show({ tab: 'community' });
    expect(screen.queryByTestId('collection-mosaic-city-hanoi')).toBeNull();
    const below = (el: HTMLElement): number => {
      const walk = [el];
      while (walk.length) {
        const n = walk.shift()!;
        const m = parseFloat(getComputedStyle(n).marginBottom);
        if (m > 0) return m;
        walk.push(...(Array.from(n.children) as HTMLElement[]));
      }
      return 0;
    };
    const gap = parseFloat(getComputedStyle(screen.getByTestId('collections-first-gap')).height);
    const tabs = below(screen.getByTestId('collections-tabs'));
    expect([tabs, gap]).toEqual([14, 10]);
    expect(tabs + gap).toBe(space.titleToContent);
    // Opened, the box and the kinds row sit between, and the last of them
    // leaves the same 14.
    openBox();
    let row = screen.getByTestId('collections-input').parentElement;
    while (row && !(parseFloat(getComputedStyle(row).marginBottom) > 0)) row = row.parentElement;
    expect(parseFloat(getComputedStyle(row as HTMLElement).marginBottom)).toBe(14);
    const pad = (id: string) => getComputedStyle(screen.getByTestId(id).firstElementChild as HTMLElement).paddingTop;
    expect(pad('collection-mosaic-city-hcmc')).toBe(`${space.titleToContent}px`);
    expect(pad('collection-mosaic-city-elsewhere')).toBe(`${space.titleToContent}px`);
  });

  // Six blocks, the first sixteen long (owner, 6 Nov 2026): either heading
  // opens the cities, and a city takes the reader to its block.
  it('opens the cities from a heading, says where you are, and jumps to the one chosen', async () => {
    seed();
    show({ tab: 'community' });
    const ref = vi.mocked(useScrollToTop).mock.calls.at(-1)?.[0] as unknown as { current: { scrollToLocation: (p: unknown) => void } };
    const go = vi.spyOn(ref.current, 'scrollToLocation').mockImplementation(() => {});
    const head = screen.getByRole('button', { name: 'Saigon, 4 collections' });
    fireEvent.click(head);
    expect(screen.getByText('Go to a city')).toBeTruthy();
    const rows = ['hanoi', 'hcmc', 'elsewhere'].map((k) => screen.getByTestId(`collections-jump-${k}`));
    // Explore's city rows (owner, 7 Nov 2026): the name alone — no figure,
    // the heading has it — and no pin, no tick, no card.
    expect(rows.map((r) => r.textContent)).toEqual(['Hanoi', 'Saigon', 'ElsewhereHuế · Đà Lạt']);
    rows.forEach((r) => expect(r.textContent).not.toMatch(/\d/));
    rows.forEach((r) => {
      expect(r.querySelector('[data-icon="location-outline"]')).toBeNull();
      expect(r.querySelector('[data-icon="checkmark"]')).toBeNull();
    });
    expect(screen.queryByTestId('sheet-glyph')).toBeNull();
    // A rule between rows, and so above "Elsewhere": two, under the first.
    expect(screen.getAllByTestId('city-divider')).toHaveLength(2);
    expect(rows[2].parentElement!.firstElementChild!.getAttribute('data-testid')).toBe('city-divider');
    expect(rows[0].parentElement!.querySelector('[data-testid="city-divider"]')).toBeNull();
    // Nothing scrolled yet: the first block is the one in view, in the tint
    // and the accent.
    expect(rows.map((r) => r.getAttribute('aria-selected'))).toEqual(['true', 'false', 'false']);
    // The tint is on the scaled face, `contentStyle`.
    const face = (id: string) => {
      type Fiber = { child: Fiber | null; sibling: Fiber | null; memoizedProps: Record<string, unknown> | null };
      const host = document.body.firstElementChild as unknown as Record<string, { stateNode: { current: Fiber } }>;
      const stack: Fiber[] = [host[Object.keys(host).find((k) => k.startsWith('__reactContainer'))!].stateNode.current];
      while (stack.length) {
        const f = stack.pop()!;
        const p = f.memoizedProps;
        if (p && typeof p === 'object' && p.testID === id && 'contentStyle' in p) return StyleSheet.flatten(p.contentStyle as never) as { backgroundColor?: unknown };
        if (f.sibling) stack.push(f.sibling);
        if (f.child) stack.push(f.child);
      }
      throw new Error(`no face ${id}`);
    };
    expect(face('collections-jump-hanoi').backgroundColor).toBe(colors.accentSoft);
    expect(face('collections-jump-hcmc').backgroundColor).toBeUndefined();
    const accent = (() => {
      const h = String(colors.accent).replace('#', '');
      return `rgb(${[0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).join(', ')})`;
    })();
    expect(getComputedStyle(within(rows[0]).getByText('Hanoi')).color).toBe(accent);
    expect(getComputedStyle(within(rows[1]).getByText('Saigon')).color).not.toBe(accent);
    fireEvent.click(rows[2]);
    // The sheet goes first; the jump follows it (`SheetRows`).
    await act(async () => { await new Promise((r) => setTimeout(r, 250)); });
    expect(go).toHaveBeenCalledWith(expect.objectContaining({ sectionIndex: 2, itemIndex: 0 }));

    // A block not drawn yet: the list says so, the screen scrolls near it
    // on the average row and tries its heading again.
    go.mockClear();
    const responder = { scrollTo: vi.fn() };
    vi.spyOn(ref.current as unknown as { getScrollResponder: () => unknown }, 'getScrollResponder').mockReturnValue(responder);
    const props = listProps() as unknown as {
      sections: { data: unknown[] }[];
      onScrollToIndexFailed: (i: { index: number; averageItemLength: number }) => void;
    };
    const headingOf2 = props.sections.slice(0, 2).reduce((n, x) => n + x.data.length + 2, 0);
    act(() => props.onScrollToIndexFailed({ index: headingOf2, averageItemLength: 100 }));
    expect(responder.scrollTo).toHaveBeenCalledWith({ y: 100 * headingOf2, animated: false });
    await act(async () => { await new Promise((r) => setTimeout(r, 120)); });
    expect(go).toHaveBeenCalledWith(expect.objectContaining({ sectionIndex: 2, itemIndex: 0 }));
    // An index inside a block, not on its heading, is not chased — not
    // even into the next block's. (A fresh jump first: the retry above
    // has spent this one's.)
    fireEvent.click(screen.getByTestId('collection-mosaic-city-hcmc'));
    fireEvent.click(screen.getByTestId('collections-jump-elsewhere'));
    await act(async () => { await new Promise((r) => setTimeout(r, 250)); });
    go.mockClear();
    responder.scrollTo.mockClear();
    act(() => props.onScrollToIndexFailed({ index: props.sections[0].data.length + 3, averageItemLength: 100 }));
    expect(responder.scrollTo).toHaveBeenCalledTimes(1);
    await act(async () => { await new Promise((r) => setTimeout(r, 120)); });
    expect(go).not.toHaveBeenCalled();
    // Once. If the retry misses too, the screen stays where it scrolled to
    // rather than chasing the block every 100 ms.
    act(() => props.onScrollToIndexFailed({ index: headingOf2, averageItemLength: 100 }));
    await act(async () => { await new Promise((r) => setTimeout(r, 120)); });
    go.mockClear();
    responder.scrollTo.mockClear();
    act(() => props.onScrollToIndexFailed({ index: headingOf2, averageItemLength: 100 }));
    await act(async () => { await new Promise((r) => setTimeout(r, 120)); });
    expect(responder.scrollTo).not.toHaveBeenCalled();
    expect(go).not.toHaveBeenCalled();
    // A fresh jump from the sheet gets its own retry.
    fireEvent.click(screen.getByTestId('collection-mosaic-city-hcmc'));
    fireEvent.click(screen.getByTestId('collections-jump-elsewhere'));
    await act(async () => { await new Promise((r) => setTimeout(r, 250)); });
    act(() => props.onScrollToIndexFailed({ index: headingOf2, averageItemLength: 100 }));
    expect(responder.scrollTo).toHaveBeenCalledTimes(1);
  });

  // The heading rides under the pinned tabs once its own has gone up past
  // them — never both at once, so the name is not printed twice.
  it('pins the block’s heading under the tabs once its own is out of view', () => {
    seed();
    show({ tab: 'community' });
    type Layout = { __reactLayoutHandler: (e: unknown) => void };
    act(() => {
      (screen.getByTestId('collections-tabs') as unknown as Layout).__reactLayoutHandler({ nativeEvent: { layout: { x: 0, y: 120, width: 390, height: 44 } } });
    });
    const props = listProps() as unknown as {
      sections: { city?: { id: string | null } }[];
      onScroll: (e: unknown) => void;
      onViewableItemsChanged: (i: { viewableItems: { index: number | null; section: unknown }[] }) => void;
    };
    act(() => props.onScroll({ nativeEvent: {
      contentOffset: { x: 0, y: 900 }, contentSize: { width: 390, height: 3000 }, layoutMeasurement: { width: 390, height: 844 },
    } }));
    const [hanoi, saigon] = props.sections;
    // Saigon's heading at the top of the screen, above its rows: no
    // pinned copy, or the name would be printed twice.
    act(() => props.onViewableItemsChanged({ viewableItems: [
      { index: null, section: saigon }, { index: 0, section: saigon },
    ] }));
    expect(screen.queryByTestId('collections-city-bar')).toBeNull();
    // Its heading gone up: the rows under the tabs are Saigon's, and say so.
    act(() => props.onViewableItemsChanged({ viewableItems: [
      { index: 0, section: saigon }, { index: 1, section: saigon },
    ] }));
    const bar = within(screen.getByTestId('collections-pinned')).getByTestId('collections-city-bar');
    expect(bar.textContent).toBe('Saigon4 collections');
    // The next block's heading further down does not count: the rows at
    // the top are Hanoi's, whose heading has gone.
    act(() => props.onViewableItemsChanged({ viewableItems: [
      { index: 1, section: hanoi }, { index: null, section: saigon },
    ] }));
    expect(within(screen.getByTestId('collections-pinned')).getByTestId('collections-city-bar').textContent).toBe('Hanoi3 collections');
    // And from the bar, the sheet marks the block you are in.
    fireEvent.click(screen.getByTestId('collections-city-bar'));
    expect(screen.getByTestId('collections-jump-hanoi').getAttribute('aria-selected')).toBe('true');
  });

  // The freeze it shipped with (6 Nov 2026), on the path that froze: the
  // list's own conversion of what is in view, which hands the extractor a
  // section for a heading or footer token. jsdom never makes the list
  // report, so the report is made here, through the list itself.
  it('keys a heading the list reports as in view, so the report reaches the screen', () => {
    seed();
    show({ tab: 'community' });
    type Fiber = { child: Fiber | null; sibling: Fiber | null; stateNode: unknown };
    type SectionListInstance = {
      _onViewableItemsChanged: (i: { viewableItems: unknown[]; changed: unknown[] }) => void;
    };
    const host = document.body.firstElementChild as unknown as Record<string, { stateNode: { current: Fiber } }>;
    const stack: Fiber[] = [host[Object.keys(host).find((k) => k.startsWith('__reactContainer'))!].stateNode.current];
    let list: SectionListInstance | undefined;
    while (stack.length && !list) {
      const f = stack.pop()!;
      const node = f.stateNode as Partial<SectionListInstance> & { _convertViewable?: unknown } | null;
      if (node && typeof node === 'object' && typeof node._convertViewable === 'function') list = node as SectionListInstance;
      if (f.sibling) stack.push(f.sibling);
      if (f.child) stack.push(f.child);
    }
    expect(list).toBeTruthy();
    const { sections } = listProps() as unknown as { sections: { data: unknown[]; city?: { id: string | null } }[] };
    const [hanoi, saigon] = sections;
    // Flat indices, as the list counts: a heading, the rows, a footer, per
    // section. Hanoi's heading and first row, then Saigon's second row
    // with its heading gone.
    const saigonRow = hanoi.data.length + 2 + 1 + 1;
    const token = (index: number, item: unknown) => ({ index, item, key: String(index), isViewable: true });
    type Layout = { __reactLayoutHandler: (e: unknown) => void };
    act(() => {
      (screen.getByTestId('collections-tabs') as unknown as Layout).__reactLayoutHandler({ nativeEvent: { layout: { x: 0, y: 120, width: 390, height: 44 } } });
    });
    act(() => (listProps() as unknown as { onScroll: (e: unknown) => void }).onScroll({ nativeEvent: {
      contentOffset: { x: 0, y: 900 }, contentSize: { width: 390, height: 3000 }, layoutMeasurement: { width: 390, height: 844 },
    } }));
    // The first block's heading slot (a gap since 7 Nov) in view with its
    // rows: the slot names nothing, so the bar names the first city.
    expect(() => act(() => list!._onViewableItemsChanged({
      viewableItems: [token(0, hanoi), token(1, hanoi.data[0])],
      changed: [token(0, hanoi)],
    }))).not.toThrow();
    expect(screen.getByTestId('collections-city-bar').textContent).toBe('Hanoi3 collections');
    // A later block's heading in view over its rows: no bar, or the name
    // would be printed twice.
    const saigonHead = hanoi.data.length + 2;
    act(() => list!._onViewableItemsChanged({
      viewableItems: [token(saigonHead, saigon), token(saigonHead + 1, saigon.data[0])],
      changed: [token(saigonHead, saigon)],
    }));
    expect(screen.queryByTestId('collections-city-bar')).toBeNull();
    act(() => list!._onViewableItemsChanged({
      viewableItems: [token(saigonRow, saigon.data[1])],
      changed: [token(saigonHead, saigon), token(saigonRow, saigon.data[1])],
    }));
    expect(screen.getByTestId('collections-city-bar').textContent).toBe('Saigon4 collections');
  });

  // Not named at rest, named once the list moves, and close under the
  // tabs when it is (owner, 7 Nov 2026: it sat ~29pt below their
  // underline). The tabs' own 14 is the gap; the bar reaches up into it.
  it('names the first city only once the tabs pin, close under them', () => {
    seed();
    show({ tab: 'community' });
    const props = () => listProps() as unknown as {
      sections: { data: unknown[] }[];
      onScroll: (e: unknown) => void;
      onViewableItemsChanged: (i: { viewableItems: { index: number | null; section: unknown }[] }) => void;
    };
    const [hanoi] = props().sections;
    act(() => props().onViewableItemsChanged({ viewableItems: [{ index: null, section: hanoi }, { index: 0, section: hanoi }] }));
    expect(screen.queryByTestId('collections-city-bar')).toBeNull();
    type Layout = { __reactLayoutHandler: (e: unknown) => void };
    act(() => {
      (screen.getByTestId('collections-tabs') as unknown as Layout).__reactLayoutHandler({ nativeEvent: { layout: { x: 0, y: 120, width: 390, height: 44 } } });
    });
    act(() => props().onScroll({ nativeEvent: {
      contentOffset: { x: 0, y: 300 }, contentSize: { width: 390, height: 3000 }, layoutMeasurement: { width: 390, height: 844 },
    } }));
    const bar = screen.getByTestId('collections-city-bar');
    expect(bar.textContent).toBe('Hanoi3 collections');
    const box = getComputedStyle(bar.firstElementChild as HTMLElement);
    expect([box.paddingTop, box.paddingBottom, box.borderTopWidth, box.minHeight]).toEqual(['0px', '12px', '0px', '0px']);
    expect(TABS_ROW_GAP).toBe(14);
    const slop = propsOf('collections-city-bar').hitSlop as { top: number } | undefined;
    // 14 above, the 22pt line, 12 below: past the 44 a target is.
    expect(slop).toEqual({ top: TABS_ROW_GAP });
    expect(slop!.top + 22 + 12).toBeGreaterThanOrEqual(44);
  });

  // A guest has no tabs to pin: the bar is the whole pinned row, at the
  // top of the screen, and carries its own 12 above.
  it('gives a guest’s bar its own room above, with nothing to reach into', () => {
    seed();
    state.uid = null;
    show({ tab: 'community' });
    const props = () => listProps() as unknown as {
      sections: { data: unknown[] }[];
      onScroll: (e: unknown) => void;
      onViewableItemsChanged: (i: { viewableItems: { index: number | null; section: unknown }[] }) => void;
    };
    type Layout = { __reactLayoutHandler: (e: unknown) => void };
    act(() => {
      (screen.getByTestId('collections-tabs') as unknown as Layout).__reactLayoutHandler({ nativeEvent: { layout: { x: 0, y: 120, width: 390, height: 0 } } });
    });
    act(() => props().onScroll({ nativeEvent: {
      contentOffset: { x: 0, y: 300 }, contentSize: { width: 390, height: 3000 }, layoutMeasurement: { width: 390, height: 844 },
    } }));
    const [first] = props().sections;
    act(() => props().onViewableItemsChanged({ viewableItems: [{ index: 0, section: first }] }));
    const bar = screen.getByTestId('collections-city-bar');
    expect(getComputedStyle(bar.firstElementChild as HTMLElement).paddingTop).toBe('12px');
    expect(propsOf('collections-city-bar').hitSlop).toBeUndefined();
  });

  // The freeze it shipped with (6 Nov 2026): a list handed new `data`
  // reports what is in view again, and a report that changed state made a
  // render that made new data — round and round, the JS thread never free.
  it('settles after the list reports what is in view, instead of rendering for ever', () => {
    seed();
    show({ tab: 'community' });
    const props = () => listProps() as unknown as {
      sections: { city?: { id: string | null; count: number } }[];
      onViewableItemsChanged: (i: { viewableItems: { index: number | null; section: unknown }[] }) => void;
    };
    const before = props().sections;
    const saigon = before[1];
    // As the list would report it after any render: a copy of the section,
    // its city a new object with the same city in it.
    const report = () => props().onViewableItemsChanged({ viewableItems: [
      { index: 0, section: { ...saigon, city: { ...saigon.city! } } },
    ] });
    act(report);
    // One render for the change of block, and the list keeps its data: the
    // same array, so it has nothing to report again.
    expect(props().sections).toBe(before);
    // Reported again with the same block: React may render once more on
    // its way to dropping an unchanged state, never more than that.
    act(report);
    const settled = state.renders;
    act(report);
    act(report);
    act(report);
    expect(state.renders).toBe(settled);
  });

  it('is one shelf again, in the answer’s order, once anything is asked', () => {
    seed();
    show({ tab: 'community' });
    openBox();
    fireEvent.change(screen.getByPlaceholderText('Name, place, city, user'), { target: { value: 'List' } });
    expect(heads()).toEqual([]);
    expect(order()).toEqual(['List s1', 'List n1', 'List h1', 'List s2', 'List n2', 'List d1', 'List s3', 'List n3', 'List s4']);
  });

  it('leaves the list and tile shapes as they were', () => {
    seed();
    show({ tab: 'community' });
    fireEvent.click(screen.getByRole('button', { name: 'Tile view' }));
    expect(heads()).toEqual([]);
  });
});

describe('Mosaic scrims follow the caption', () => {
  const desc = 'A longer description for the featured collection that the dark has to reach';
  beforeEach(() => {
    state.cols.data = Array.from({ length: 12 }, (_, i) => col(`mosaic-${i}`, ['a'], {
      title_en: `A very long collection title mosaic-${i}`,
      curator_handle: `curator${i}`,
      desc_en: desc,
    }));
  });

  it('lays the dark behind every word of an on-photo caption, from the caption’s own edge', () => {
    show();
    const photos = screen.getAllByTestId(/^collection-mosaic-mosaic-/);
    const sides = new Set<string>();
    for (const photo of photos) {
      const id = photo.dataset.testid!;
      const slug = id.replace('collection-mosaic-', '').replace(/-(top|bottom|below)$/, '');
      const scrim = screen.queryByTestId(`collection-mosaic-scrim-${slug}`);
      if (id.endsWith('-below')) {
        expect(scrim).toBeNull();
        expect(photo.querySelector('[data-stub="LinearGradient"]')).toBeNull();
        continue;
      }
      const top = id.endsWith('-top');
      sides.add(top ? 'top' : 'bottom');
      // The caption is the scrim: its words are inside it, on the photo.
      expect(scrim!.parentElement).toBe(photo);
      expect(within(scrim!).getByText(`A very long collection title ${slug}`)).toBeTruthy();
      expect(within(scrim!).getByText(`@curator${slug.replace('mosaic-', '')}`)).toBeTruthy();
      // Two gradients, both inside it: the body under the words, the tail past them.
      expect(scrim!.querySelectorAll('[data-stub="LinearGradient"]')).toHaveLength(2);
      const body = propsOf(`collection-mosaic-body-${slug}`);
      const tail = propsOf(`collection-mosaic-tail-${slug}`);
      expect(body.style).toEqual(StyleSheet.absoluteFill);
      expect(body.colors).toEqual(mosaicScrim.body);
      expect(tail.colors).toEqual(mosaicScrim.tail);
      const tailStyle = StyleSheet.flatten(tail.style as never) as Record<string, unknown>;
      expect(tailStyle.height).toBe(mosaicScrim.tailHeight);
      expect(tailStyle[top ? 'top' : 'bottom']).toBe('100%');
      expect(tailStyle[top ? 'bottom' : 'top']).toBeUndefined();
      for (const g of [body, tail]) {
        expect(g.start).toEqual({ x: 0, y: top ? 0 : 1 });
        expect(g.end).toEqual({ x: 0, y: top ? 1 : 0 });
      }
    }
    // The fixture reaches both sides, or the direction above proved half.
    expect(sides).toEqual(new Set(['top', 'bottom']));
  });

  it('keeps the featured description on the photo, inside the dark, in full white', () => {
    show();
    const scrims = screen.getAllByTestId(/^collection-mosaic-scrim-/);
    const held = scrims.filter((sc) => within(sc).queryByText(desc));
    expect(held.length).toBeGreaterThan(0);
    const inkOf = (text: string) => {
      type Fiber = { child: Fiber | null; sibling: Fiber | null; memoizedProps: Record<string, unknown> | null };
      const host = document.body.firstElementChild as unknown as Record<string, { stateNode: { current: Fiber } }>;
      const key = Object.keys(host).find((k) => k.startsWith('__reactContainer'))!;
      const stack: Fiber[] = [host[key].stateNode.current];
      while (stack.length) {
        const f = stack.pop()!;
        const p = f.memoizedProps;
        if (p && typeof p === 'object' && p.children === text && 'style' in p) {
          return (StyleSheet.flatten(p.style as never) as { color?: string }).color;
        }
        if (f.sibling) stack.push(f.sibling);
        if (f.child) stack.push(f.child);
      }
      throw new Error(`no text ${text}`);
    };
    expect(inkOf(desc)).toBe(onPhoto.text);
    // And the byline on every on-photo caption, in the same full white.
    for (const sc of scrims) {
      const handle = within(sc).getByText(/^@curator\d+$/).textContent!;
      expect(inkOf(handle)).toBe(onPhoto.text);
    }
  });
});

// A friend's list shared with you (12 Nov 2026): on Yours, after your own
// and under its own heading, with the friend's byline; never on Community,
// which is what everyone sees.
describe('CollectionsScreen — shared with you', () => {
  /** Lan's private list, as `fetchSharedWithMe` names it. */
  const lent = (slug: string, members: string[], over: Partial<Collection> = {}) => col(slug, members, {
    is_public: false, owner_id: 'lan-id', curator_handle: 'lan', ...over,
  });
  const box = () => { openBox(); return screen.getByPlaceholderText('Name, place, city, user') as HTMLInputElement; };
  const type = (v: string) => fireEvent.change(box(), { target: { value: v } });

  beforeEach(() => {
    state.uid = 'u1';
    state.mine.data = [col('mine1', ['a'], { owner_id: 'u1', is_public: false, title_en: 'My cafés' })];
    state.shared.data = [lent('lans', ['b'], { title_en: 'Lan’s noodles' })];
  });

  it('asks for the lists shared with the reader, as the reader', () => {
    show();
    expect(spies.sharedFor).toHaveBeenCalledWith('u1');
  });

  it('draws them after your own, under their heading and count', () => {
    show();
    const head = screen.getByTestId('collections-shared-head');
    expect(within(head).getByRole('heading').textContent).toBe('Shared with you');
    expect(head.textContent).toBe('Shared with you1 collection');
    const mineTile = screen.getByText('My cafés');
    const theirs = screen.getByText('Lan’s noodles');
    // Document order: your own, then the heading, then the friend's.
    expect(mineTile.compareDocumentPosition(head) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(head.compareDocumentPosition(theirs) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('counts every list in the section', () => {
    state.shared.data = [lent('one', ['a']), lent('two', ['b']), lent('three', [])];
    show();
    expect(screen.getByTestId('collections-shared-head').textContent).toBe('Shared with you3 collections');
  });

  it('wears the friend’s byline and face, and no padlock, count or heart', async () => {
    spies.fetchProfilesById.mockImplementation(async () => ({ 'lan-id': { avatar_url: 'https://face/lan.jpg' } }));
    show();
    await act(async () => {});
    const tile = screen.getByTestId('collection-shared-0');
    expect(within(tile).getByText('@lan')).toBeTruthy();
    expect(spies.fetchProfilesById).toHaveBeenCalledWith(['lan-id']);
    await waitFor(() => expect(tile.querySelector('img[src="https://face/lan.jpg"]')).toBeTruthy());
    expect(within(tile).queryByTestId('collection-tile-lock')).toBeNull();
    expect(within(tile).queryByTestId('collection-tile-count')).toBeNull();
    expect(within(tile).queryByRole('button', { name: /like this collection/i })).toBeNull();
    // Your own private tile keeps its padlock: one on the shelf.
    expect(screen.getAllByTestId('collection-tile-lock')).toHaveLength(1);
  });

  it('says whose list it is in the tile’s spoken name, and opens it', () => {
    const { navigation } = show();
    const tile = screen.getByTestId('collection-shared-0');
    expect(tile.getAttribute('aria-label')).toBe('Lan’s noodles, @lan');
    fireEvent.click(tile);
    expect(navigation.navigate).toHaveBeenCalledWith('CollectionDetail', { slug: 'lans' });
  });

  it('names nobody where the owner has no handle to name', () => {
    state.shared.data = [lent('lans', ['b'], { title_en: 'Lan’s noodles', curator_handle: null })];
    show();
    expect(screen.getByTestId('collection-shared-0').getAttribute('aria-label')).toBe('Lan’s noodles');
  });

  it('keeps an empty shared list on the shelf', () => {
    state.shared.data = [lent('soon', [], { title_en: 'Coming soon' })];
    show();
    expect(screen.getByText('Coming soon')).toBeTruthy();
  });

  it('draws no heading when nothing is shared', () => {
    state.shared.data = [];
    show();
    expect(screen.getByText('My cafés')).toBeTruthy();
    expect(screen.queryByTestId('collections-shared-head')).toBeNull();
  });

  it('keeps them off Community', () => {
    state.cols.data = [col('public1', ['a'], { title_en: 'Everyone’s' })];
    show({ tab: 'community' });
    expect(screen.getByText('Everyone’s')).toBeTruthy();
    expect(screen.queryByText('Lan’s noodles')).toBeNull();
    expect(screen.queryByTestId('collections-shared-head')).toBeNull();
  });

  it('greets a reader with no lists of their own on Yours when one is shared with them', () => {
    state.mine.data = [];
    state.cols.data = [col('public1', ['a'], { title_en: 'Everyone’s' })];
    show();
    expect(screen.getByText('Lan’s noodles')).toBeTruthy();
    expect(screen.queryByText('Everyone’s')).toBeNull();
    // Their own half still offers the first list.
    expect(screen.getByText('No collections yet')).toBeTruthy();
  });

  it('waits for the shared lists before greeting, then greets an empty library with Community', () => {
    state.mine.data = [];
    state.shared = { data: [], loaded: false, loading: true, loadedAt: null };
    state.cols.data = [col('public1', ['a'], { title_en: 'Everyone’s' })];
    const navigation = nav();
    const view = render(<CollectionsScreen navigation={navigation} route={{}} />);
    expect(screen.queryByText('Everyone’s')).toBeNull();
    state.shared = { data: [], loaded: true, loading: false, loadedAt: 2 };
    view.rerender(<CollectionsScreen navigation={navigation} route={{}} />);
    expect(screen.getByText('Everyone’s')).toBeTruthy();
  });

  it('reloads them when the tab comes back into view', () => {
    show();
    expect(spies.sharedReload).toHaveBeenCalled();
  });

  it('finds a shared list by its words, with no "nothing matches" over it', () => {
    show();
    type('noodles');
    expect(screen.getByText('Lan’s noodles')).toBeTruthy();
    expect(screen.queryByText('My cafés')).toBeNull();
    expect(screen.queryByText(/Nothing here matches/)).toBeNull();
    // And by the friend's handle.
    type('@lan');
    expect(screen.getByText('Lan’s noodles')).toBeTruthy();
  });

  it('says once that nothing matched, when nothing on either half did', () => {
    show();
    type('zzz');
    expect(screen.getAllByText('Nothing here matches "zzz".')).toHaveLength(1);
    expect(screen.queryByTestId('collections-shared-head')).toBeNull();
  });
});
