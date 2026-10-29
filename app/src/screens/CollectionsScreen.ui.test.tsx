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
import { Alert } from 'react-native';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '../uitest/render';
import { useScrollToTop } from '@react-navigation/native';
import type { Collection, Place } from '../lib/data';
import type { Nav } from '../nav';

const state = vi.hoisted(() => ({
  uid: null as string | null,
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
  likes: {} as Record<string, number>,
  myLikes: [] as string[],
}));
const spies = vi.hoisted(() => ({
  colsReload: vi.fn(),
  mineReload: vi.fn(),
  placesReload: vi.fn(),
  askToSignIn: vi.fn(),
  toggleLike: vi.fn(async () => {}),
  deleteCollection: vi.fn(async (_slug: string) => {}),
  fetchProfilesById: vi.fn(async (_ids: string[]) => ({}) as Record<string, { avatar_url: string }>),
  swipeClose: vi.fn(),
}));

vi.mock('../lib/i18n', () => ({
  useI18n: () => ({ lang: 'en', setLang: () => {}, t: (en: string) => en }),
}));
vi.mock('../lib/auth', () => {
  const m = {
    useAuth: () => ({ session: state.uid ? { user: { id: state.uid } } : null }),
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
  useCollections: () => ({ ...state.cols, reload: spies.colsReload }),
  useLikes: () => ({ likes: state.likes, myLikes: state.myLikes, toggleLike: spies.toggleLike }),
  usePlaces: () => ({ data: state.places, loading: state.placesLoading, loaded: state.placesLoaded, reload: spies.placesReload }),
}));
vi.mock('../lib/save', () => {
  const useSave = () => ({ mine: { ...state.mine, reload: spies.mineReload }, askToSignIn: spies.askToSignIn });
  return { useSave, useMyLists: () => (useSave() as { mine?: unknown }).mine, useSaveActions: () => useSave() };
});
// Only the two calls that leave the device are stood in for; the rest of
// the module is the real membership and city arithmetic.
vi.mock('../lib/data', async (orig) => ({
  ...(await orig<typeof import('../lib/data')>()),
  deleteCollection: spies.deleteCollection,
  fetchProfilesById: spies.fetchProfilesById,
}));
vi.mock('../components/tabBarDuck', () => ({ useDuckOnScroll: () => undefined, useTabBarDucked: () => state.ducked }));
// Swipeable is a native gesture recognizer; there is no thumb in jsdom. The
// stand-in draws the row and its revealed actions side by side (so Edit and
// Delete are reachable by name), hands the render prop a real drag value,
// and offers two buttons that play the open/close callbacks a swipe fires.
vi.mock('../components/Swipeable', async () => {
  const R = await import('react');
  const { Animated } = await import('react-native');
  type P = {
    children: React.ReactNode;
    renderRightActions: (p: unknown, d: unknown) => React.ReactNode;
    onSwipeableWillOpen: () => void;
    onSwipeableWillClose: () => void;
  };
  const Swipeable = R.forwardRef<{ close: () => void }, P>((p, ref) => {
    R.useImperativeHandle(ref, () => ({ close: spies.swipeClose }));
    const [drag] = R.useState(() => new Animated.Value(0));
    return R.createElement('div', { 'data-stub': 'Swipeable' },
      p.children,
      p.renderRightActions(drag, drag),
      R.createElement('button', { type: 'button', onClick: p.onSwipeableWillOpen }, 'swipe-open'),
      R.createElement('button', { type: 'button', onClick: p.onSwipeableWillClose }, 'swipe-close'));
  });
  return { default: Swipeable };
});

import AsyncStorage from '@react-native-async-storage/async-storage';
import CollectionsScreen from './CollectionsScreen';

// Spied where the screen looks: under the web alias `Alert.alert` is a
// silent no-op, so an unspied assertion could only ever pass vacuously.
const alert = vi.spyOn(Alert, 'alert').mockImplementation(() => {});
const pressInAlert = (label: string) => {
  const buttons = alert.mock.calls.at(-1)![2] as { text: string; onPress?: () => void }[];
  buttons.find((b) => b.text === label)!.onPress?.();
};

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

// Whether the sheet is up, by its own prop: react-native-web keeps a
// modal in the page through its fade, so absence is not the signal.
const sheetShown = (): boolean => {
  type Fiber = { child: Fiber | null; sibling: Fiber | null; memoizedProps: Record<string, unknown> | null };
  const host = document.body.firstElementChild as unknown as Record<string, { stateNode: { current: Fiber } }>;
  const key = Object.keys(host).find((k) => k.startsWith('__reactContainer'))!;
  const stack: Fiber[] = [host[key].stateNode.current];
  while (stack.length) {
    const f = stack.pop()!;
    const p = f.memoizedProps;
    if (p && typeof p === 'object' && 'countFor' in p && 'visible' in p) return p.visible as boolean;
    if (f.sibling) stack.push(f.sibling);
    if (f.child) stack.push(f.child);
  }
  throw new Error('no filter sheet');
};

/** The committed props of every host-side element that offers a screen
 *  reader actions — VoiceOver's rotor has no jsdom counterpart, and
 *  react-native-web drops the props from the DOM, so the handler is
 *  reached the way `listProps` reaches the pull. */
type A11yProps = {
  accessibilityLabel?: string;
  accessibilityActions: { name: string; label: string }[];
  onAccessibilityAction: (e: { nativeEvent: { actionName: string } }) => void;
};
const actionRows = (): A11yProps[] => {
  type Fiber = { child: Fiber | null; sibling: Fiber | null; memoizedProps: Record<string, unknown> | null };
  const host = document.body.firstElementChild as unknown as Record<string, { stateNode: { current: Fiber } }>;
  const key = Object.keys(host).find((k) => k.startsWith('__reactContainer'))!;
  const stack: Fiber[] = [host[key].stateNode.current];
  const out = new Set<A11yProps>();
  while (stack.length) {
    const f = stack.pop()!;
    const p = f.memoizedProps;
    if (p && typeof p === 'object' && 'accessibilityActions' in p && 'onPress' in p) out.add(p as never);
    if (f.sibling) stack.push(f.sibling);
    if (f.child) stack.push(f.child);
  }
  return [...out];
};

const icons = (name: string) => document.querySelectorAll(`[data-icon="${name}"]`).length;

beforeEach(async () => {
  vi.clearAllMocks();
  alert.mockImplementation(() => {});
  spies.deleteCollection.mockImplementation(async () => {});
  spies.fetchProfilesById.mockImplementation(async () => ({}));
  await AsyncStorage.removeItem('citycrew.collections.view');
  state.uid = null;
  state.ducked = false;
  state.city = { id: 'hanoi' };
  state.cities = [];
  state.places = [place('a', 'hanoi', 'https://img/a.jpg'), place('b'), place('s', 'saigon')];
  state.placesLoaded = true;
  state.placesLoading = false;
  state.cols = { data: [], loaded: true, loading: false, error: null, loadedAt: 1 };
  state.mine = { data: [], loaded: true, loading: false };
  state.likes = {};
  state.myLikes = [];
});

// An answer in the filter sheet by its word: each carries its figure
// after it, "Cafés (2)", which the accessible name runs together.
const word = (w: string) => ({ name: new RegExp(`^${w} ?(\\(\\d+\\))?$`) });

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

  it("a guest's heart asks them to sign in and writes nothing", () => {
    state.cols.data = [col('here', ['a'])];
    show();
    fireEvent.click(screen.getByRole('button', { name: 'Like this collection' }));
    expect(spies.askToSignIn).toHaveBeenCalledTimes(1);
    // A heart raises the heart sheet, not the bookmark one.
    expect(spies.askToSignIn).toHaveBeenCalledWith('like');
    expect(spies.toggleLike).not.toHaveBeenCalled();
  });

  it("community tiles wear the curator's handle and face, not a place count", async () => {
    state.cols.data = [
      col('here', ['a'], { curator_handle: 'Minh', owner_id: 'o1' }),
      col('there', ['b'], { owner_id: 'o1' }),
    ];
    spies.fetchProfilesById.mockImplementation(async () => ({ o1: { avatar_url: 'https://face/o1.jpg' } }));
    show();
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
    expect(screen.getByText('2 places')).toBeTruthy();
    expect(screen.getByText('1 place')).toBeTruthy();
    expect(icons('lock-closed-outline')).toBe(1);
    expect(icons('globe-outline')).toBeGreaterThanOrEqual(2); // the tab's glyph + the public tile
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

  // At any count, on the row shape too — and never on a private list.
  it('your own public row offers the heart before anybody has liked it', () => {
    state.mine.data = [
      col('mine1', ['a'], { owner_id: 'u1' }),
      col('shut', ['a'], { owner_id: 'u1', is_public: false }),
    ];
    state.likes = {};
    show();
    fireEvent.click(screen.getByRole('button', { name: 'List view' }));
    const hearts = screen.getAllByRole('button', { name: 'Like this collection' });
    expect(hearts).toHaveLength(1);
    expect(screen.queryByText(/likes?$/)).toBeNull();
    fireEvent.click(hearts[0]);
    expect(spies.toggleLike).toHaveBeenCalledWith(expect.objectContaining({ slug: 'mine1' }));
  });

  // The same list sits at the same height on both tabs: the meta row is
  // as tall as a face whether it leads with one or with a padlock.
  it('holds the tile\u2019s meta row at the avatar\u2019s height on either tab', () => {
    state.mine.data = [col('mine1', ['a'], { owner_id: 'u1', is_public: false })];
    show();
    const foot = screen.getByTestId('collection-tile-foot');
    expect(getComputedStyle(foot).minHeight).toBe('18px');
    expect(foot.querySelector('[data-icon="lock-closed-outline"]')!.getAttribute('data-size')).toBe('14');
  });

  it('an own tile with nothing in it says so in words, and is named by its title', () => {
    state.mine.data = [col('fresh', [], { owner_id: 'u1' })];
    show();
    expect(screen.getByText('No places yet')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'List fresh, Public' })).toBeTruthy();
    // Tiles keep no swipe, so they carry no actions either.
    expect(actionRows()).toEqual([]);
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
  // Community's, and lost the filter glyph beside the title.
  it('keeps the pill and the filter glyph on an empty library too, beside its own card', () => {
    show();
    expect(screen.getByTestId('collection-new')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: /Yours/ }));
    expect(screen.getByRole('button', { name: 'New collection' })).toBeTruthy();
    expect(screen.getByText('Create your first collection')).toBeTruthy();
    // Nothing of yours to filter: the glyph is there, and does nothing.
    const filters = screen.getByTestId('collections-filters');
    expect(filters.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(filters);
    expect(screen.queryByTestId('collections-filter-apply')).toBeNull();
  });

  it('draws no filter glyph for a guest with nothing to choose', () => {
    state.uid = null;
    state.cols.data = [];
    show();
    expect(screen.queryByTestId('collections-filters')).toBeNull();
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
  it('shows your own published list on Community, with your byline and the same heart', () => {
    const own = col('mine1', ['a'], { owner_id: 'u1', curator_handle: 'me', is_public: true });
    state.mine.data = [own];
    state.cols.data = [own, col('theirs', ['a'], { curator_handle: 'them' })];
    state.likes = { mine1: 2, theirs: 1 };
    show({ tab: 'community' });
    expect(screen.getByText('List theirs')).toBeTruthy();
    expect(screen.getByText('List mine1')).toBeTruthy();
    expect(screen.getByText('@me')).toBeTruthy();
    // Two heart controls, yours and theirs: a curator may like their own.
    expect(screen.getAllByRole('button', { name: 'Like this collection' })).toHaveLength(2);
    expect(screen.getByText('2')).toBeTruthy();
    // The same on the row shape.
    fireEvent.click(screen.getByRole('button', { name: 'List view' }));
    expect(screen.getAllByRole('button', { name: 'Like this collection' })).toHaveLength(2);
    expect(screen.getByText('2 likes')).toBeTruthy();
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

  it("the heart on somebody else's tile writes the like by id and slug", () => {
    state.cols.data = [col('theirs', ['a'])];
    show({ tab: 'community' });
    fireEvent.click(screen.getByRole('button', { name: 'Like this collection' }));
    expect(spies.toggleLike).toHaveBeenCalledWith({ id: 'id-theirs', slug: 'theirs' });
    expect(spies.askToSignIn).not.toHaveBeenCalled();
  });

  it('a liked tile offers Unlike and shows the count', () => {
    state.cols.data = [col('theirs', ['a'])];
    state.myLikes = ['id-theirs'];
    state.likes = { theirs: 7 };
    show({ tab: 'community' });
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
    act(() => { listProps().onRefresh(); });
    expect(spies.colsReload).toHaveBeenCalledTimes(1);
    expect(spies.mineReload).toHaveBeenCalledTimes(1);
    expect(spies.placesReload).toHaveBeenCalledTimes(1);
    // Nothing is loading, so the spinner disarms as soon as it is armed.
    expect(listProps().refreshing).toBe(false);
  });
});

describe('CollectionsScreen — list view', () => {
  beforeEach(() => { state.uid = 'u1'; });

  // Who can see a list of yours is a glyph on screen, which VoiceOver
  // does not read, so the card's spoken name carries it — in either view,
  // and only on your own: somebody else's list is public by being there.
  it('says in the card’s spoken name who can see a list of yours, in either view', async () => {
    state.mine.data = [
      col('mine1', ['a'], { is_public: false, owner_id: 'u1' }),
      col('mine2', ['a'], { is_public: true, owner_id: 'u1' }),
    ];
    show();
    expect(screen.getByRole('button', { name: 'List mine1, Private' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'List mine2, Public' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'List view' }));
    await screen.findByRole('button', { name: 'List mine1, Private' });
    expect(screen.getAllByRole('button', { name: 'Delete' })).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'List mine2, Public' })).toBeTruthy();
  });

  it('the switch turns tiles into rows and remembers the choice', async () => {
    state.mine.data = [col('mine1', ['a', 'b'], { is_public: false, owner_id: 'u1' })];
    show();
    // Tiles by default: the count stands alone, no status word beside it.
    expect(screen.getByText('2 places')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'List view' }));
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('citycrew.collections.view', 'row');
    // Rows, which a row's Delete says. Their count stands alone too now
    // (owner, 22 Oct 2026): the lock says it, and the word is not drawn.
    expect(screen.getByRole('button', { name: 'Delete' })).toBeTruthy();
    expect(screen.getByText('2 places')).toBeTruthy();
    expect(screen.queryByText(/Private/)).toBeNull();
    // And back again.
    fireEvent.click(screen.getByRole('button', { name: 'Tile view' }));
    expect(AsyncStorage.setItem).toHaveBeenLastCalledWith('citycrew.collections.view', 'tile');
    expect(screen.getByText('2 places')).toBeTruthy();
  });

  it('a stored row preference is what the screen opens in', async () => {
    await AsyncStorage.setItem('citycrew.collections.view', 'row');
    state.mine.data = [col('mine1', ['a'], { owner_id: 'u1' })];
    show();
    expect(await screen.findByRole('button', { name: 'Delete' })).toBeTruthy();
  });

  it('ignores a stored value that is neither view', async () => {
    await AsyncStorage.setItem('citycrew.collections.view', 'bogus');
    state.mine.data = [col('mine1', ['a'], { owner_id: 'u1' })];
    show();
    await act(async () => {});
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
    expect(screen.getByText('1 place')).toBeTruthy();
  });

  const rows = async () => {
    await AsyncStorage.setItem('citycrew.collections.view', 'row');
  };

  it('your row shows its description, likes line, and an empty one says "No places yet"', async () => {
    await rows();
    state.mine.data = [
      col('mine1', ['a'], { owner_id: 'u1', desc_en: '  Rooftops for Friday  ' }),
      col('fresh', [], { owner_id: 'u1', is_public: false }),
    ];
    state.likes = { mine1: 1 };
    show();
    expect(await screen.findByText('Rooftops for Friday')).toBeTruthy();
    expect(screen.getByText('1 like')).toBeTruthy();
    expect(screen.getByText('No places yet')).toBeTruthy();
    // The empty one draws the waiting well, not a photograph.
    expect(icons('bookmark-outline')).toBeGreaterThanOrEqual(2); // tab glyph + empty cover
  });

  // One height for every row, whatever it has to say (the owner's two
  // screenshots, 10 Oct 2026: 62pt beside 121). jsdom lays nothing out, so
  // what is held here is the mechanism: every row carries the same hidden
  // ghost, the tallest row there is, and draws its own text over it rather
  // than beside it, so nothing the row says can make it taller.
  it('sizes every row by the same hidden ghost, with its own text laid over it', async () => {
    await rows();
    state.mine.data = [
      col('bare', ['a'], { owner_id: 'u1', is_public: false }),
      col('full', ['a', 'b'], { owner_id: 'u1', desc_en: 'A sentence long enough to wrap onto a second line' }),
    ];
    state.likes = { full: 3 };
    show();
    await screen.findByText('A sentence long enough to wrap onto a second line');
    const column = (title: string) => screen.getByText(title).parentElement!.parentElement!;
    const ghosts = ['List bare', 'List full'].map((t) => {
      const ghost = column(t).firstElementChild as HTMLElement;
      expect(ghost.getAttribute('aria-hidden')).toBe('true');
      expect(ghost.textContent!.trim()).toBe('');
      return ghost;
    });
    expect(ghosts[0].innerHTML).toBe(ghosts[1].innerHTML);
    // Four lines: title, meta, two of description, likes.
    expect(ghosts[0].children).toHaveLength(4);
    expect(ghosts[0].children[2].textContent).toBe(' \n ');
    // The face is the ghost's sibling and covers it.
    for (const t of ['List bare', 'List full']) {
      const face = screen.getByText(t).parentElement!;
      expect(face.previousElementSibling?.getAttribute('aria-hidden')).toBe('true');
      expect(getComputedStyle(face).position).toBe('absolute');
      // From the top, so every title starts on the same line of its card.
      expect(getComputedStyle(face).justifyContent).toBe('flex-start');
    }
    // A one-line title, the only line that could outgrow the ghost: the
    // same clamp class the ghost's own title line wears.
    const ghostTitle = ghosts[0].firstElementChild!.className;
    expect(screen.getByText('List bare').className).toBe(ghostTitle);
    expect(screen.getByText('List full').className).toBe(ghostTitle);
  });

  it('opening the swipe drops the description; closing brings it back', async () => {
    await rows();
    state.mine.data = [col('mine1', ['a'], { owner_id: 'u1', desc_en: 'Rooftops' })];
    show();
    await screen.findByText('Rooftops');
    fireEvent.click(screen.getByText('swipe-open'));
    expect(screen.queryByText('Rooftops')).toBeNull();
    fireEvent.click(screen.getByText('swipe-close'));
    expect(screen.getByText('Rooftops')).toBeTruthy();
  });

  it('Edit closes the row and opens the form with slug, title and description', async () => {
    await rows();
    state.mine.data = [col('mine1', ['a'], { owner_id: 'u1', desc_en: 'Rooftops' })];
    const { navigation } = show();
    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    expect(spies.swipeClose).toHaveBeenCalled();
    expect(navigation.navigate).toHaveBeenCalledWith('CollectionForm', {
      slug: 'mine1', title: 'List mine1', desc: 'Rooftops',
    });
  });

  it('tapping your row opens it', async () => {
    await rows();
    state.mine.data = [col('mine1', ['a'], { owner_id: 'u1' })];
    const { navigation } = show();
    // Wait for the stored preference to land, or the tap hits a tile the
    // row is about to replace.
    await screen.findByRole('button', { name: 'Delete' });
    fireEvent.click(screen.getByText('List mine1'));
    expect(navigation.navigate).toHaveBeenCalledWith('CollectionDetail', { slug: 'mine1' });
  });

  it('Delete asks first; Cancel deletes nothing', async () => {
    await rows();
    state.mine.data = [col('mine1', ['a'], { owner_id: 'u1' })];
    show();
    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));
    expect(spies.swipeClose).toHaveBeenCalled();
    expect(alert).toHaveBeenCalledWith(
      'Delete this collection?', '"List mine1" will be gone for good.', expect.any(Array),
    );
    pressInAlert('Cancel');
    expect(spies.deleteCollection).not.toHaveBeenCalled();
  });

  it('confirming deletes by slug and reloads your library and the public catalog', async () => {
    await rows();
    state.mine.data = [col('mine1', ['a'], { owner_id: 'u1' })];
    show();
    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));
    spies.mineReload.mockClear();
    spies.colsReload.mockClear();
    await act(async () => pressInAlert('Delete'));
    expect(spies.deleteCollection).toHaveBeenCalledWith('mine1');
    expect(spies.mineReload).toHaveBeenCalledTimes(1);
    // A public list is on the Community shelf too; it must go from there.
    expect(spies.colsReload).toHaveBeenCalledTimes(1);
  });

  it('a screen reader gets Edit and Delete on your row, and Delete still asks first', async () => {
    await rows();
    state.mine.data = [col('mine1', ['a'], { owner_id: 'u1', desc_en: 'Rooftops' })];
    const { navigation } = show();
    await screen.findByRole('button', { name: 'Delete' });
    const [row] = actionRows();
    expect(row.accessibilityLabel).toBe('List mine1, Public');
    expect(row.accessibilityActions).toEqual([{ name: 'edit', label: 'Edit' }, { name: 'delete', label: 'Delete' }]);
    act(() => row.onAccessibilityAction({ nativeEvent: { actionName: 'edit' } }));
    expect(navigation.navigate).toHaveBeenCalledWith('CollectionForm', {
      slug: 'mine1', title: 'List mine1', desc: 'Rooftops',
    });
    act(() => row.onAccessibilityAction({ nativeEvent: { actionName: 'delete' } }));
    expect(spies.swipeClose).toHaveBeenCalledTimes(2);
    expect(alert).toHaveBeenCalledWith(
      'Delete this collection?', '"List mine1" will be gone for good.', expect.any(Array),
    );
    expect(spies.deleteCollection).not.toHaveBeenCalled();
    await act(async () => pressInAlert('Delete'));
    expect(spies.deleteCollection).toHaveBeenCalledWith('mine1');
    // An action it does not know does nothing.
    alert.mockClear();
    act(() => row.onAccessibilityAction({ nativeEvent: { actionName: 'magicTap' } }));
    expect(alert).not.toHaveBeenCalled();
  });

  it('every row is a button named by its title; a community byline stays in the name', async () => {
    await rows();
    state.mine.data = [col('mine1', ['a'], { owner_id: 'u1' })];
    state.cols.data = [col('theirs', ['a', 'b'], { curator_handle: 'trang' }), col('solo', ['a'])];
    show();
    expect(await screen.findByRole('button', { name: 'List mine1, Public' })).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: /Community/ }));
    expect(screen.getByRole('button', { name: 'List theirs, by @trang, 2 places' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'List solo' })).toBeTruthy();
    // Somebody else's list offers nothing to edit.
    expect(actionRows()).toEqual([]);
  });

  it('a failed delete says so with the reason', async () => {
    await rows();
    spies.deleteCollection.mockImplementation(async () => { throw new Error('forbidden'); });
    state.mine.data = [col('mine1', ['a'], { owner_id: 'u1' })];
    show();
    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));
    spies.mineReload.mockClear();
    await act(async () => pressInAlert('Delete'));
    expect(alert).toHaveBeenLastCalledWith('Could not delete', 'forbidden');
    expect(spies.mineReload).not.toHaveBeenCalled();
  });

  // The same ghost under somebody else's lists, so the two tabs keep one
  // row height between them as well as within each.
  it('sizes a community row by the same ghost as your own', async () => {
    await rows();
    state.cols.data = [
      col('theirs', ['a', 'b'], { curator_handle: 'trang', desc_en: 'Coffee crawl' }),
      col('solo', ['a']),
    ];
    show({ tab: 'community' });
    await screen.findByText('Coffee crawl');
    const ghosts = ['List theirs', 'List solo'].map((t) => {
      const face = screen.getByText(t).parentElement!;
      expect(getComputedStyle(face).position).toBe('absolute');
      return face.previousElementSibling as HTMLElement;
    });
    expect(ghosts[0].getAttribute('aria-hidden')).toBe('true');
    expect(ghosts[0].innerHTML).toBe(ghosts[1].innerHTML);
    expect(ghosts[0].children).toHaveLength(4);
    expect(screen.getByText('List theirs').className).toBe(ghosts[0].firstElementChild!.className);
  });

  it('a community row names its curator for a screen reader and draws the heart', async () => {
    await rows();
    state.cols.data = [
      col('theirs', ['a', 'b'], { curator_handle: 'trang', desc_en: 'Coffee crawl' }),
      col('solo', ['a']),
    ];
    state.likes = { theirs: 3, solo: 1 };
    state.myLikes = ['id-solo'];
    const { navigation } = show({ tab: 'community' });
    expect(await screen.findByLabelText('by @trang, 2 places')).toBeTruthy();
    expect(screen.getByText('Coffee crawl')).toBeTruthy();
    expect(screen.getByText('3 likes')).toBeTruthy();
    expect(screen.getByText('1 like')).toBeTruthy();
    // No byline, just the count, where there is no handle.
    expect(screen.getByText('1 place')).toBeTruthy();
    // Nothing to swipe on somebody else's list.
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Unlike this collection' }));
    expect(spies.toggleLike).toHaveBeenCalledWith({ id: 'id-solo', slug: 'solo' });
    fireEvent.click(screen.getByText('List theirs'));
    expect(navigation.navigate).toHaveBeenCalledWith('CollectionDetail', { slug: 'theirs' });
  });

  it('a private community row has no heart', async () => {
    await rows();
    state.cols.data = [col('shut', ['b'], { is_public: false })];
    show({ tab: 'community' });
    expect(await screen.findByText(/1 place/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /like this collection/i })).toBeNull();
  });
});

describe('CollectionsScreen — search', () => {
  const box = () => screen.getByPlaceholderText('Name, place, city, user') as HTMLInputElement;
  const type = (v: string) => fireEvent.change(box(), { target: { value: v } });
  const open = () => fireEvent.focus(box());
  const expectSub = (line: string) => expect(screen.getByTestId('collections-scope').textContent).toBe(line);

  // Cancel lives inside the box (owner, 15 Oct 2026): absent at rest, in
  // the box's own frame once the box is focused, gone again when pressed.
  it('shows Cancel inside the box on focus, and takes it away on the tap', () => {
    state.cols.data = [col('coffee', ['b'], { title_en: 'Coffee' })];
    show();
    expect(screen.queryByTestId('collections-cancel')).toBeNull();
    open();
    const cancel = screen.getByTestId('collections-cancel');
    expect(box().parentElement!.contains(cancel)).toBe(true);
    type('cof');
    fireEvent.click(cancel);
    expect(box().value).toBe('');
    expect(screen.queryByTestId('collections-cancel')).toBeNull();
    expect(screen.queryByTestId('collections-panel')).toBeNull();
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

  it('matches by a place inside the list, and says which place', () => {
    state.cols.data = [col('one', ['a']), col('two', ['b'])];
    show();
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

  // The filters are a sheet beside the title since 25 Oct 2026 (owner):
  // opened from the glyph, drafted, and applied by the button that says
  // what it will show.
  const sheetPick = (pick: { city?: string; kind?: string }) => {
    fireEvent.click(screen.getByTestId('collections-filters'));
    if (pick.city) fireEvent.click(within(screen.getByTestId('collections-filter-cities')).getByRole('button', word(pick.city)));
    if (pick.kind) fireEvent.click(within(screen.getByTestId('collections-filter-kinds')).getByRole('button', word(pick.kind)));
    fireEvent.click(screen.getByTestId('collections-filter-apply'));
  };

  it('Cancel lets go of the words and the panel, and keeps the filters', () => {
    state.places = [cafe('a'), bar('b')];
    state.cols.data = [col('rooftops', ['a'], { title_en: 'Rooftops' }), col('coffee', ['b'], { title_en: 'Coffee' })];
    show();
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
    open();
    expect(screen.getByTestId('collections-cancel')).toBeTruthy();
    // The filter first: with "roof" in the box the sheet would count no
    // nightlife on this shelf, and dim it.
    sheetPick({ kind: 'Nightlife' });
    type('roof');
    expect(screen.queryByText('Rooftops')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByTestId('collections-panel')).toBeNull();
    expect(box().value).toBe('');
    // The filter is the sheet's, and stays, in sight under the box.
    expect(screen.getByText('Coffee')).toBeTruthy();
    expect(screen.queryByText('Rooftops')).toBeNull();
    expect(within(screen.getByTestId('collections-chosen')).getByText('Nightlife')).toBeTruthy();
    expect(screen.queryByTestId('collections-cancel')).toBeNull();
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
    expect(panel.queryByText('Kind of place')).toBeNull();
    await AsyncStorage.removeItem('citycrew.recentCollectionSearches');
  });

  it('filters from a sheet beside the title, drafted until applied', () => {
    state.places = [cafe('a', 'hanoi'), bar('c', 'danang')];
    state.cols.data = [col('one', ['a'], { title_en: 'Hanoi cafés' }), col('two', ['c'], { title_en: 'Da Nang bars' })];
    show();
    const filters = screen.getByTestId('collections-filters');
    // Beside the title, in ink while nothing is on.
    expect(screen.getByTestId('collections-top').contains(filters)).toBe(true);
    expect(filters.getAttribute('aria-label')).toBe('Filters');
    fireEvent.click(filters);
    expect(screen.getByTestId('collections-filter-cities-all').getAttribute('aria-selected')).toBe('true');
    expect(screen.queryByTestId('collections-filter-reset')).toBeNull();
    fireEvent.click(within(screen.getByTestId('collections-filter-kinds')).getByRole('button', word('Cafés')));
    // A draft: the shelf has not moved, and the button says what it will.
    expect(screen.getByText('Da Nang bars')).toBeTruthy();
    expect(screen.getByTestId('collections-filter-apply').textContent).toContain('Show 1 collection');
    expect(screen.getByTestId('collections-filter-reset')).toBeTruthy();
    fireEvent.click(screen.getByTestId('collections-filter-apply'));
    expect(sheetShown()).toBe(false);
    expect(screen.queryByText('Da Nang bars')).toBeNull();
    expect(screen.getByText('Hanoi cafés')).toBeTruthy();
    // Coral, and counted, once something is on.
    expect(screen.getByTestId('collections-filters').getAttribute('aria-label')).toBe('Filters, 1');
    // Reset and close: nothing applied, nothing changed.
    fireEvent.click(screen.getByTestId('collections-filters'));
    fireEvent.click(screen.getByTestId('collections-filter-reset'));
    expect(screen.getByTestId('collections-filter-apply').textContent).toContain('Show 2 collections');
    fireEvent.click(screen.getByTestId('collections-filter-close'));
    expect(sheetShown()).toBe(false);
    expect(screen.queryByText('Da Nang bars')).toBeNull();
  });

  // What the sheet chose stays in sight under the box, each with a ✕ of
  // its own (owner, 25 Oct 2026), and the words open the sheet again.
  it('shows the chosen filters under the box: the words open the sheet, a ✕ lets go of its own', () => {
    state.places = [cafe('a', 'hanoi'), bar('c', 'danang')];
    state.cols.data = [col('one', ['a'], { title_en: 'Hanoi cafés' }), col('two', ['c'], { title_en: 'Da Nang bars' })];
    show();
    expect(screen.queryByTestId('collections-chosen')).toBeNull();
    type('café');
    sheetPick({ city: 'hanoi', kind: 'Cafés' });
    const row = screen.getByTestId('collections-chosen');
    expect(within(row).getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual(['hanoi', 'Remove hanoi', 'Cafés', 'Remove Cafés']);
    // The glyph led this row once; it is beside the title now.
    expect(row.querySelector('[data-icon="options-outline"]')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Remove Cafés' }));
    expectSub('1 collection · hanoi');
    expect(screen.queryByTestId('collections-chosen-kind')).toBeNull();
    // The words in the box are the box's: a ✕ leaves them.
    expect(box().value).toBe('café');
    fireEvent.click(within(screen.getByTestId('collections-chosen-city')).getByRole('button', { name: 'hanoi' }));
    expect(sheetShown()).toBe(true);
    expect(within(screen.getByTestId('collections-filter-cities')).getByRole('button', word('hanoi')).getAttribute('aria-selected')).toBe('true');
    fireEvent.click(screen.getByTestId('collections-filter-close'));
    fireEvent.click(screen.getByRole('button', { name: 'Remove hanoi' }));
    expect(screen.queryByTestId('collections-chosen')).toBeNull();
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
      const key = Object.keys(box()).find((k) => k.startsWith('__reactFiber'))!;
      type Fiber = { memoizedProps?: Record<string, unknown>; child?: Fiber; sibling?: Fiber; return?: Fiber };
      let top = (box() as unknown as Record<string, Fiber>)[key];
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
    // Nothing chosen: no row; the words are still in the box, and Cancel
    // is still the way to let them go.
    expect(screen.queryByTestId('collections-chosen')).toBeNull();
    expect(box().value).toBe('one');
    expect(screen.getByTestId('collections-cancel')).toBeTruthy();
  });

  // ── the panel ──
  //
  // A chip asks about places: "Cafés" lists a collection for the cafés
  // in it and the card says how many of its places those are.
  const cafe = (slug: string, city = 'hanoi') => ({ ...place(slug, city), categories: ['cafes'] } as unknown as Place);
  const bar = (slug: string, city = 'hanoi') => ({ ...place(slug, city), categories: ['nightlife'] } as unknown as Place);

  it('offers only the kinds its lists hold, narrows by one, and counts the places it reached', () => {
    state.places = [cafe('a'), cafe('b'), bar('c'), bar('d')];
    state.cols.data = [col('mixed', ['a', 'c', 'd'], { title_en: 'Mixed', curator_handle: 'minh' }), col('bars', ['d'], { title_en: 'Bars' })];
    show();
    fireEvent.click(screen.getByTestId('collections-filters'));
    expect(screen.getByText('Kind of place')).toBeTruthy();
    expect(screen.queryByText('Nature')).toBeNull();
    fireEvent.click(within(screen.getByTestId('collections-filter-kinds')).getByRole('button', word('Cafés')));
    fireEvent.click(screen.getByTestId('collections-filter-apply'));
    expect(screen.getByText('Mixed')).toBeTruthy();
    expect(screen.queryByText('Bars')).toBeNull();
    expect(screen.getByText('1 of 3 places · Cafés')).toBeTruthy();
    expectSub('1 collection · Cafés');
    // Tapped again, in the sheet, the choice lets go.
    sheetPick({ kind: 'Cafés' });
    expect(screen.getByText('Bars')).toBeTruthy();
    expect(screen.queryByText('1 of 3 places · Cafés')).toBeNull();
  });

  // The sheet dims a pair that holds nothing (25 Oct 2026), so a reader
  // reaches one only by carrying a choice to the other shelf.
  it('says so when nothing has a place the chips ask for, in words or without', () => {
    state.uid = 'u1';
    state.places = [cafe('a', 'hanoi'), cafe('b', 'danang'), bar('c', 'danang')];
    state.mine.data = [col('m1', ['a'], { owner_id: 'u1', title_en: 'My cafés' }), col('m2', ['c'], { owner_id: 'u1', title_en: 'My bars' })];
    state.cols.data = [col('one', ['b'], { title_en: 'Cafés of Da Nang' }), col('two', ['c'], { title_en: 'Bars' })];
    show();
    sheetPick({ city: 'hanoi', kind: 'Cafés' });
    expect(screen.getByText('My cafés')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: 'Community' }));
    // The words land on the first list's title, but the chips ask about
    // places, and it has no café in Hanoi — and under words the miss
    // names them.
    type('cafes');
    expect(screen.getByText('Nothing here matches "cafes".')).toBeTruthy();
    // Chips alone: Community has no café in Hanoi.
    type('');
    expect(screen.getByText('No collections match that choice.')).toBeTruthy();
  });

  // ── the city scope, said and switched ──
  //
  // Both shelves show every city and say how many under the title (owner,
  // 15 Oct 2026 — Community was scoped to the app's city until then). The
  // city chip narrows to one, and letting go of it is every city again.
  it('counts every city on Community, and narrows to one through the chip', () => {
    state.places = [place('a', 'hanoi'), place('b', 'danang'), place('c', 'danang')];
    state.cols.data = [col('hn', ['a'], { title_en: 'Hanoi list' }), col('dn', ['b', 'c'], { title_en: 'Da Nang list' })];
    show();
    expectSub('2 collections · 2 cities');
    expect(screen.getByText('Hanoi list')).toBeTruthy();
    expect(screen.getByText('Da Nang list')).toBeTruthy();
    fireEvent.click(screen.getByTestId('collections-filters'));
    // Nothing chosen for the reader: the app's city is not pre-picked.
    expect(screen.getByRole('button', word('hanoi')).getAttribute('aria-selected')).toBe('false');
    fireEvent.click(screen.getByRole('button', word('danang')));
    fireEvent.click(screen.getByTestId('collections-filter-apply'));
    expect(screen.getByText('Da Nang list')).toBeTruthy();
    expect(screen.queryByText('Hanoi list')).toBeNull();
    expectSub('1 collection · danang');
    // Let go of: every city.
    sheetPick({ city: 'danang' });
    expect(screen.getByText('Hanoi list')).toBeTruthy();
    expect(screen.getByText('Da Nang list')).toBeTruthy();
    expectSub('2 collections · 2 cities');
  });

  // Past eight cities the row ends in "More" (owner, 25 Oct 2026), and its
  // picker searches every name a city answers to, which the screen hands
  // over from the city list: "ho chi" finds the city the app calls Saigon.
  it('lets the filter find a city past the cut by any of its names', () => {
    const ids = ['hanoi', 'melbourne', 'dalat', 'danang', 'hoian', 'hue', 'tokyo', 'osaka', 'hcmc'];
    state.cities = ids.map((id) => (id === 'hcmc'
      ? { id, short_en: 'Saigon', short_vi: 'Sài Gòn', short_ja: 'ホーチミン', name_en: 'Ho Chi Minh City', name_vi: 'TP. Hồ Chí Minh', name_ja: 'ホーチミン市' }
      : { id, short_en: id, short_vi: id, short_ja: id, name_en: id, name_vi: id, name_ja: id }));
    state.places = ids.map((id) => place(id, id));
    state.cols.data = ids.map((id) => col(`l-${id}`, [id], { title_en: `List ${id}` }));
    show();
    fireEvent.click(screen.getByTestId('collections-filters'));
    // Nine cities, each in one list: the row keeps five and hides four.
    expect(screen.getByTestId('collections-filter-cities-more').textContent).toBe('More (+4)');
    expect(within(screen.getByTestId('collections-filter-cities')).queryByRole('button', word('Saigon'))).toBeNull();
    fireEvent.click(screen.getByTestId('collections-filter-cities-more'));
    fireEvent.change(screen.getByTestId('collections-filter-city-search'), { target: { value: 'ho chi' } });
    fireEvent.click(screen.getByTestId('collections-filter-city-hcmc'));
    fireEvent.click(screen.getByTestId('collections-filter-apply'));
    expect(screen.getByText('List hcmc')).toBeTruthy();
    expect(screen.queryByText('List hanoi')).toBeNull();
    expectSub('1 collection · Saigon');
  });

  it('shows a list from another city with no chip to reach it', () => {
    state.places = [place('b', 'danang')];
    state.cols.data = [col('dn', ['b'], { title_en: 'Da Nang list' })];
    show();
    expect(screen.getByText('Da Nang list')).toBeTruthy();
    expectSub('1 collection · danang');
  });

  it('counts every city on Yours, and narrows to one through the chip without an “all”', () => {
    state.uid = 'u1';
    state.places = [place('a', 'hanoi'), place('b', 'danang')];
    state.mine.data = [col('m1', ['a'], { owner_id: 'u1', title_en: 'Mine in Hanoi' }), col('m2', ['b'], { owner_id: 'u1', title_en: 'Mine in Da Nang' })];
    show();
    expectSub('2 collections · 2 cities');
    expect(screen.getByText('Mine in Da Nang')).toBeTruthy();
    fireEvent.click(screen.getByTestId('collections-filters'));
    expect(screen.getByRole('button', word('danang')).getAttribute('aria-selected')).toBe('false');
    fireEvent.click(screen.getByRole('button', word('danang')));
    fireEvent.click(screen.getByTestId('collections-filter-apply'));
    expect(screen.queryByText('Mine in Hanoi')).toBeNull();
    expectSub('1 collection · danang');
    sheetPick({ city: 'danang' });
    expectSub('2 collections · 2 cities');
  });

  it('names the one city on Yours when there is one', () => {
    state.uid = 'u1';
    state.places = [place('a', 'hanoi')];
    state.mine.data = [col('m1', ['a'], { owner_id: 'u1' })];
    show();
    expectSub('1 collection · hanoi');
    expect(screen.queryByText('City')).toBeNull();
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

  it("sits on somebody's list made this week, and is in its spoken name", () => {
    state.cols.data = [
      col('fresh', ['a'], { created_at: ago(2) }),
      col('old', ['a'], { created_at: ago(30) }),
    ];
    show();
    expect(screen.getAllByTestId('new-badge')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'List fresh, New' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'List old' })).toBeTruthy();
    // The badge is inside the tile it labels.
    expect(within(screen.getByRole('button', { name: 'List fresh, New' })).getByTestId('new-badge')).toBeTruthy();
  });

  it('and in the list shape, before the byline', async () => {
    await AsyncStorage.setItem('citycrew.collections.view', 'row');
    state.cols.data = [
      col('fresh', ['a'], { created_at: ago(2), curator_handle: 'Minh' }),
      col('old', ['a'], { created_at: ago(30) }),
    ];
    show();
    const row = await screen.findByRole('button', { name: 'List fresh, New, by @minh, 1 place' });
    expect(within(row).getByTestId('new-badge')).toBeTruthy();
    expect(screen.getAllByTestId('new-badge')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'List old' })).toBeTruthy();
  });

  it('never on your own, on either tab, in either shape', async () => {
    state.uid = 'u1';
    const own = col('mine1', ['a'], { owner_id: 'u1', is_public: true, created_at: ago(1) });
    state.mine.data = [own];
    state.cols.data = [own];
    show();
    expect(screen.getByRole('button', { name: 'List mine1, Public' })).toBeTruthy();
    expect(screen.queryByTestId('new-badge')).toBeNull();
    cleanup();
    show({ tab: 'community' });
    expect(screen.getByText('List mine1')).toBeTruthy();
    expect(screen.queryByTestId('new-badge')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'List view' }));
    expect(screen.getByText('List mine1')).toBeTruthy();
    expect(screen.queryByTestId('new-badge')).toBeNull();
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
  type Layout = { __reactLayoutHandler: (e: unknown) => void };
  const lay = (id: string, layout: { y: number; height: number }) => act(() => {
    (screen.getByTestId(id) as unknown as Layout).__reactLayoutHandler({ nativeEvent: { layout: { x: 0, width: 390, ...layout } } });
  });
  const scrollTo = (y: number) => act(() => {
    listProps().onScroll({ nativeEvent: {
      contentOffset: { x: 0, y }, contentSize: { width: 390, height: 3000 }, layoutMeasurement: { width: 390, height: 844 },
    } });
  });
  const box = () => screen.getByTestId('collections-input') as HTMLInputElement;
  // The header as a phone lays it out: the tabs 120 down, the whole 260.
  const laidOut = () => {
    lay('collections-tabs', { y: 120, height: 44 });
    lay('collections-top', { y: 0, height: 260 });
  };
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
    // Named, as Explore's pinned row is, and the name is a heading.
    expect(within(pinned).getByRole('heading').textContent).toBe('Collections');
    // At Explore's measures: a 36pt row, 16 to the tabs, nothing above.
    const head = within(pinned).getByRole('heading').parentElement!;
    expect(getComputedStyle(head).minHeight).toBe('36px');
    expect(getComputedStyle(head.parentElement!).marginBottom).toBe('16px');
    // And the line under the title, which says how many and where.
    expect(head.parentElement!.textContent).toBe(`Collections${screen.getByTestId('collections-scope').textContent}`);
    expect(getComputedStyle(pinned).paddingTop).not.toBe('8px');
    expect(pinned.textContent).toContain('Yours');
    expect(pinned.textContent).toContain('Community');
    // A copy, unnamed: the tests still find one of each.
    expect(screen.getAllByTestId('collections-yours')).toHaveLength(1);
    scrollTo(40);
    expect(screen.queryByTestId('collections-pinned')).toBeNull();
  });

  it('pins a guest nothing: there is no switch to keep', () => {
    show();
    laidOut();
    scrollTo(300);
    expect(screen.queryByTestId('collections-pinned')).toBeNull();
  });

  it('pins the chosen filters and the glyph with the tabs, and opens the sheet from there', () => {
    signedIn();
    state.places = [{ ...place('a', 'hanoi'), categories: ['cafes'] }, { ...place('b', 'saigon'), categories: ['nightlife'] }];
    state.mine.data = [col('m1', ['a'], { owner_id: 'u1' }), col('m2', ['b'], { owner_id: 'u1' })];
    show();
    fireEvent.click(screen.getByTestId('collections-filters'));
    fireEvent.click(within(screen.getByTestId('collections-filter-kinds')).getByRole('button', word('Cafés')));
    fireEvent.click(screen.getByTestId('collections-filter-apply'));
    laidOut();
    scrollTo(400);
    const pinned = within(screen.getByTestId('collections-pinned'));
    expect(pinned.getByRole('button', { name: 'Remove Cafés' })).toBeTruthy();
    // The glyph pins with the title, counted, and opens the sheet.
    expect(sheetShown()).toBe(false);
    fireEvent.click(pinned.getByRole('button', { name: 'Filters, 1' }));
    expect(sheetShown()).toBe(true);
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
