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
import { Alert } from 'react-native';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '../uitest/render';
import type { Collection, Place } from '../lib/data';
import type { Nav } from '../nav';

const state = vi.hoisted(() => ({
  uid: null as string | null,
  city: { id: 'hanoi' } as { id: string } | null,
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
  askToSignIn: vi.fn(),
  toggleLike: vi.fn(async () => {}),
  deleteCollection: vi.fn(async (_slug: string) => {}),
  fetchProfilesById: vi.fn(async (_ids: string[]) => ({}) as Record<string, { avatar_url: string }>),
  swipeClose: vi.fn(),
}));

vi.mock('../lib/i18n', () => ({
  useI18n: () => ({ lang: 'en', setLang: () => {}, t: (en: string) => en }),
}));
vi.mock('../lib/auth', () => ({
  useAuth: () => ({ session: state.uid ? { user: { id: state.uid } } : null }),
}));
vi.mock('../lib/city', () => ({ useCity: () => ({ city: state.city, cities: [] }) }));
vi.mock('../lib/catalog', () => ({
  useCollections: () => ({ ...state.cols, reload: spies.colsReload }),
  useLikes: () => ({ likes: state.likes, myLikes: state.myLikes, toggleLike: spies.toggleLike }),
  usePlaces: () => ({ data: state.places, loading: state.placesLoading, loaded: state.placesLoaded }),
}));
vi.mock('../lib/save', () => ({
  useSave: () => ({ mine: { ...state.mine, reload: spies.mineReload }, askToSignIn: spies.askToSignIn }),
}));
// Only the two calls that leave the device are stood in for; the rest of
// the module is the real membership and city arithmetic.
vi.mock('../lib/data', async (orig) => ({
  ...(await orig<typeof import('../lib/data')>()),
  deleteCollection: spies.deleteCollection,
  fetchProfilesById: spies.fetchProfilesById,
}));
vi.mock('../components/tabBarDuck', () => ({ useDuckOnScroll: () => undefined }));
// Swipeable is a native gesture recognizer; there is no thumb in jsdom. The
// stand-in draws the row and its revealed actions side by side (so Edit and
// Delete are reachable by name), hands the render prop a real drag value,
// and offers two buttons that play the open/close callbacks a swipe fires.
vi.mock('react-native-gesture-handler/Swipeable', async () => {
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
const listProps = (): { onRefresh: () => void; refreshing: boolean } => {
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
  state.city = { id: 'hanoi' };
  state.places = [place('a', 'hanoi', 'https://img/a.jpg'), place('b'), place('s', 'saigon')];
  state.placesLoaded = true;
  state.placesLoading = false;
  state.cols = { data: [], loaded: true, loading: false, error: null, loadedAt: 1 };
  state.mine = { data: [], loaded: true, loading: false };
  state.likes = {};
  state.myLikes = [];
});

describe('CollectionsScreen — as a guest', () => {
  it('leads with the sign-in card, which jumps to the Profile stack', () => {
    const { navigation } = show();
    expect(screen.getByText('Start your own collection')).toBeTruthy();
    // No tabs for a guest: there is no library to switch to.
    expect(screen.queryByRole('tab')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Sign in to build your own collections' }));
    expect(navigation.parentNavigate).toHaveBeenCalledWith('Profile', { screen: 'SignIn', initial: false });
  });

  it('shows only public lists with a place in the city on screen', () => {
    state.cols.data = [
      col('here', ['a']),
      col('elsewhere', ['s']),
      col('hollow', []),
    ];
    show();
    expect(screen.getByText('List here')).toBeTruthy();
    expect(screen.queryByText('List elsewhere')).toBeNull();
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
    expect(screen.getByText('Start your own collection')).toBeTruthy();
  });

  it('holds while the places catalog has not loaded, even if lists are in', () => {
    state.placesLoaded = false;
    state.cols.data = [col('here', ['a'])];
    show();
    expect(screen.queryByText('List here')).toBeNull();
  });

  it('says the load failed, with the reason, instead of a list', () => {
    state.cols.error = 'network down';
    state.cols.data = [col('here', ['a'])];
    show();
    expect(screen.getByText("Couldn't load collections: network down")).toBeTruthy();
    expect(screen.queryByText('List here')).toBeNull();
  });

  it('an empty shelf points a guest at Explore, not at creating', () => {
    const { navigation } = show();
    expect(screen.getByText('No public lists here yet')).toBeTruthy();
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
    expect(screen.queryByText('Start your own collection')).toBeNull();
  });

  it('your own public tile shows its likes as a tally, never a pressable heart', () => {
    state.mine.data = [col('mine1', ['a'], { owner_id: 'u1' })];
    state.likes = { mine1: 4 };
    show();
    expect(screen.getByText('4')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /like this collection/i })).toBeNull();
  });

  it('an own tile with nothing in it says so in words, and is named by its title', () => {
    state.mine.data = [col('fresh', [], { owner_id: 'u1' })];
    show();
    expect(screen.getByText('No places yet')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'List fresh' })).toBeTruthy();
    // Tiles keep no swipe, so they carry no actions either.
    expect(actionRows()).toEqual([]);
  });

  it('the dashed row under your lists starts a new one', () => {
    state.mine.data = [col('mine1', ['a'], { owner_id: 'u1' })];
    const { navigation } = show();
    fireEvent.click(screen.getByText('New collection'));
    expect(navigation.navigate).toHaveBeenCalledWith('CollectionForm');
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
    expect(screen.getByText('Only you can see your lists.')).toBeTruthy();
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
    expect(screen.queryByText('No public lists here yet')).toBeNull();
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

  it('pulling reloads both shelves and holds the spinner only for the pull', () => {
    state.mine.data = [col('mine1', ['a'], { owner_id: 'u1' })];
    show();
    spies.mineReload.mockClear();
    act(() => { listProps().onRefresh(); });
    expect(spies.colsReload).toHaveBeenCalledTimes(1);
    expect(spies.mineReload).toHaveBeenCalledTimes(1);
    // Nothing is loading, so the spinner disarms as soon as it is armed.
    expect(listProps().refreshing).toBe(false);
  });
});

describe('CollectionsScreen — list view', () => {
  beforeEach(() => { state.uid = 'u1'; });

  it('the switch turns tiles into rows and remembers the choice', async () => {
    state.mine.data = [col('mine1', ['a', 'b'], { is_public: false, owner_id: 'u1' })];
    show();
    // Tiles by default: the count stands alone, no status word beside it.
    expect(screen.getByText('2 places')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'List view' }));
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('citycrew.collections.view', 'row');
    expect(screen.getByText(/2 places\s+·\s+Private/)).toBeTruthy();
    // And back again.
    fireEvent.click(screen.getByRole('button', { name: 'Tile view' }));
    expect(AsyncStorage.setItem).toHaveBeenLastCalledWith('citycrew.collections.view', 'tile');
    expect(screen.getByText('2 places')).toBeTruthy();
  });

  it('a stored row preference is what the screen opens in', async () => {
    await AsyncStorage.setItem('citycrew.collections.view', 'row');
    state.mine.data = [col('mine1', ['a'], { owner_id: 'u1' })];
    show();
    expect(await screen.findByText(/1 place\s+·\s+Public/)).toBeTruthy();
  });

  it('ignores a stored value that is neither view', async () => {
    await AsyncStorage.setItem('citycrew.collections.view', 'bogus');
    state.mine.data = [col('mine1', ['a'], { owner_id: 'u1' })];
    show();
    await act(async () => {});
    expect(screen.queryByText(/·\s+Public/)).toBeNull();
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
    expect(screen.getByText(/No places yet\s+·\s+Private/)).toBeTruthy();
    // The empty one draws the waiting well, not a photograph.
    expect(icons('bookmark-outline')).toBeGreaterThanOrEqual(2); // tab glyph + empty cover
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
    await screen.findByText(/1 place\s+·\s+Public/);
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
    await screen.findByText(/1 place\s+·\s+Public/);
    const [row] = actionRows();
    expect(row.accessibilityLabel).toBe('List mine1');
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
    expect(await screen.findByRole('button', { name: 'List mine1' })).toBeTruthy();
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
  it('filters by name, says when nothing matches, and clears', () => {
    state.cols.data = [col('rooftops', ['a'], { title_en: 'Rooftops' }), col('coffee', ['b'], { title_en: 'Coffee' })];
    show();
    fireEvent.click(screen.getByRole('button', { name: 'Search collections' }));
    const input = screen.getByPlaceholderText('Name, place, or @username');
    fireEvent.change(input, { target: { value: 'roof' } });
    expect(screen.getByText('Rooftops')).toBeTruthy();
    expect(screen.queryByText('Coffee')).toBeNull();
    fireEvent.change(input, { target: { value: 'zzz' } });
    expect(screen.getByText('Nothing here matches "zzz".')).toBeTruthy();
    // Under a query the empty-shelf invitation stands down.
    expect(screen.queryByText('No public lists here yet')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(screen.getByText('Coffee')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Clear' })).toBeNull();
  });

  it('matches by a place inside the list', () => {
    state.cols.data = [col('one', ['a']), col('two', ['b'])];
    show();
    fireEvent.click(screen.getByRole('button', { name: 'Search collections' }));
    fireEvent.change(screen.getByPlaceholderText('Name, place, or @username'), { target: { value: 'Place b' } });
    expect(screen.getByText('List two')).toBeTruthy();
    expect(screen.queryByText('List one')).toBeNull();
  });

  it('closing the search drops the field and the query with it', () => {
    state.cols.data = [col('rooftops', ['a'], { title_en: 'Rooftops' }), col('coffee', ['b'], { title_en: 'Coffee' })];
    show();
    fireEvent.click(screen.getByRole('button', { name: 'Search collections' }));
    fireEvent.change(screen.getByPlaceholderText('Name, place, or @username'), { target: { value: 'roof' } });
    fireEvent.click(screen.getByRole('button', { name: 'Close search' }));
    expect(screen.queryByPlaceholderText('Name, place, or @username')).toBeNull();
    expect(screen.getByText('Coffee')).toBeTruthy();
  });

  it('on your own tab a miss shows the honest footer, not the new-collection row', () => {
    state.uid = 'u1';
    state.mine.data = [col('mine1', ['a'], { owner_id: 'u1' })];
    show();
    fireEvent.click(screen.getByRole('button', { name: 'Search collections' }));
    fireEvent.change(screen.getByPlaceholderText('Name, place, or @username'), { target: { value: 'zzz' } });
    expect(screen.getByText('Nothing here matches "zzz".')).toBeTruthy();
    expect(screen.queryByText('New collection')).toBeNull();
  });
});
