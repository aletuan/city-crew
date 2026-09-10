// @vitest-environment jsdom
//
// Explore, the guest's front door, rendered.
//
// Everything pinned here is something a reader either sees or reaches by
// tapping: the headline naming their city (or the desk's override of it),
// which photograph the hero picked, the community shelf and what its heart
// does for a signed-out guest, the category chips and the order of the
// list under them, and where each control lands. The catalog, the city,
// auth and the save flow are mocked at the screen's own imports so each
// state — loading, failed, empty, filtered — can be set up directly.

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '../uitest/render';
import type { Collection, Place } from '../lib/data';
import type { Nav } from '../nav';

type City = Record<string, unknown> & { id: string; short_en: string };

const state = vi.hoisted(() => ({
  city: null as City | null,
  places: {
    loading: false, loaded: true, error: null as string | null,
    data: [] as unknown[], reload: (() => {}) as () => void,
  },
  cols: { loaded: true, data: [] as unknown[] },
  likes: {} as Record<string, number>,
  myLikes: [] as string[],
  uid: null as string | null,
  taste: null as null | { affinity: (p: { slug: string }) => number },
  sky: null as null | { icon: string; temp: number; gold?: boolean },
  ducked: false,
  scheme: 'dark' as 'dark' | 'light',
}));
const spies = vi.hoisted(() => ({
  // A pull's fetch is in flight the moment it is asked for, which is what
  // the provider's own `reload` does to `loading` in the same batch.
  reload: vi.fn(() => { state.places.loading = true; }),
  toggleLike: vi.fn(async () => {}),
  askToSignIn: vi.fn(),
  goTo: vi.fn(),
  mark: vi.fn(),
  settle: vi.fn(),
  reportStartup: vi.fn(),
  setStatusBarStyle: vi.fn(),
}));

vi.mock('../lib/i18n', () => ({
  useI18n: () => ({ lang: 'en', setLang: () => {}, t: (en: string) => en }),
}));
vi.mock('../lib/city', () => ({
  useCity: () => ({ city: state.city, cities: state.city ? [state.city] : [] }),
}));
vi.mock('../lib/catalog', () => ({
  usePlaces: () => ({ ...state.places, reload: spies.reload }),
  useCollections: () => state.cols,
  useLikes: () => ({ likes: state.likes, myLikes: state.myLikes, toggleLike: spies.toggleLike }),
}));
vi.mock('../lib/auth', () => ({
  useAuth: () => ({ session: state.uid ? { user: { id: state.uid } } : null }),
}));
vi.mock('../lib/save', () => ({
  useSave: () => ({ save: vi.fn(), askToSignIn: spies.askToSignIn, isSaved: () => false }),
}));
vi.mock('../lib/theme', () => ({
  useScheme: () => ({ scheme: state.scheme, setScheme: () => {}, ready: true }),
}));
vi.mock('../lib/tasteProfile', () => ({ useBrowseTaste: () => state.taste }));
vi.mock('../lib/sky', () => ({ useSky: () => state.sky }));
vi.mock('../components/tabBarDuck', () => ({
  useTabBarDuck: () => ({ ducked: state.ducked }),
  useDuckOnScroll: () => undefined,
}));
// The sheet has its own suite (CitySwitcher.ui.test.tsx); what Explore owes
// it is opening and closing, so a stand-in that says which is enough.
vi.mock('../components/CitySwitcher', () => ({
  CitySwitcherModal: ({ visible, onClose }: { visible: boolean; onClose: () => void }) =>
    (visible ? <button type="button" onClick={onClose}>close-city-sheet</button> : null),
}));
// The status bar is owned through `useNavigation` and painted through
// `setStatusBarStyle`; the shared stubs have neither `isFocused` nor the
// setter, and the ink the clock wears over the photograph is behaviour
// this screen decides, so both are stood in for here.
vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ isFocused: () => true, addListener: () => () => {} }),
  useIsFocused: () => true,
  useFocusEffect: () => {},
  createNavigationContainerRef: () => ({ isReady: () => false, navigate: () => {} }),
}));
vi.mock('expo-status-bar', () => ({ StatusBar: () => null, setStatusBarStyle: spies.setStatusBarStyle }));
vi.mock('../nav', () => ({ goTo: spies.goTo }));
vi.mock('../lib/trace', () => ({ startupTrace: { mark: spies.mark, marks: () => [] } }));
vi.mock('../lib/launch', () => ({ launchSettled: { settle: spies.settle } }));
vi.mock('../lib/tracereport', () => ({ reportStartup: spies.reportStartup }));

import ExploreScreen from './ExploreScreen';

const photo = (uri: string) => ({ photo_uri: uri, is_cover: true, is_hidden: false, sort_order: 0, attribution_name: null });

const place = (slug: string, over: Partial<Place> = {}): Place => ({
  slug,
  city_id: 'hanoi',
  name_en: `Place ${slug}`,
  name_vi: `Địa ${slug}`,
  name_ja: null,
  category: 'out',
  categories: [],
  is_featured: false,
  is_published: true,
  review_status: 'approved',
  vibe_tags: [],
  place_photos: [],
  rating: null,
  rating_count: null,
  ...over,
} as unknown as Place);

const collection = (slug: string, members: string[], over: Partial<Collection> = {}): Collection => ({
  id: `id-${slug}`,
  slug,
  title_en: `List ${slug}`,
  title_vi: slug,
  title_ja: null,
  desc_en: null, desc_vi: null, desc_ja: null,
  curator_handle: null,
  cover: null,
  collection_places: members.map((m, i) => ({ sort_order: i, places: { slug: m } })),
  ...over,
} as unknown as Collection);

const hanoi: City = { id: 'hanoi', short_en: 'Hanoi', short_vi: 'Hà Nội', short_ja: 'ハノイ' };

type NavSpy = Nav & {
  navigate: ReturnType<typeof vi.fn>;
  parentNavigate: ReturnType<typeof vi.fn>;
  focus: () => void;
};
const nav = (): NavSpy => {
  const parentNavigate = vi.fn();
  let onFocus = () => {};
  const n = {
    navigate: vi.fn(), goBack: vi.fn(), replace: vi.fn(), popToTop: vi.fn(),
    getParent: () => ({ navigate: parentNavigate }),
    addListener: vi.fn((ev: string, cb: () => void) => { if (ev === 'focus') onFocus = cb; return () => {}; }),
    parentNavigate,
    focus: () => onFocus(),
  };
  return n as unknown as NavSpy;
};

/** A shelf card, found by its title: the nearest ancestor that also holds
 *  the card's scrim, which sits beside the badge and the text. */
const shelfCard = (title: string): HTMLElement => {
  let el: HTMLElement | null = screen.getByText(title);
  while (el && !el.querySelector('[data-stub="LinearGradient"]')) el = el.parentElement;
  if (!el) throw new Error(`no shelf card for ${title}`);
  return el;
};

/**
 * The list's own props, as the screen handed them over.
 *
 * jsdom lays nothing out, so a virtualized list never learns which cards
 * are on screen and a real pull gesture does not exist. The screen's
 * handlers for both are still its own code, so they are reached where the
 * screen passes them — on the `SectionList` element carrying its testID —
 * and fed the events a phone would send.
 */
type ListProps = {
  onViewableItemsChanged: (e: { viewableItems: { index: number | null }[] }) => void;
  onRefresh: () => void;
  refreshing: boolean;
};
const listProps = (): ListProps => {
  // From the committed tree's root down, because a fiber reached from a
  // DOM node can be the stale half of its pair and carry last render's props.
  type Fiber = { child: Fiber | null; sibling: Fiber | null; memoizedProps: Record<string, unknown> | null };
  const host = document.body.firstElementChild as unknown as Record<string, { stateNode: { current: Fiber } }>;
  const key = Object.keys(host).find((k) => k.startsWith('__reactContainer'))!;
  const stack: Fiber[] = [host[key].stateNode.current];
  while (stack.length) {
    const f = stack.pop()!;
    const p = f.memoizedProps;
    if (p && typeof p === 'object' && 'sections' in p && p.testID === 'explore-list') return p as unknown as ListProps;
    if (f.sibling) stack.push(f.sibling);
    if (f.child) stack.push(f.child);
  }
  throw new Error('no explore-list SectionList in the committed tree');
};
// The web ScrollView throttles its events to `scrollEventThrottle`, so each
// scroll is spaced past it — the tests using this run on fake timers.
const scrollTo = (y: number) => {
  act(() => { vi.advanceTimersByTime(50); });
  const el = screen.getByTestId('explore-list');
  el.scrollTop = y;
  fireEvent.scroll(el);
};
const seeCards = (...idx: (number | null)[]) =>
  act(() => { listProps().onViewableItemsChanged({ viewableItems: idx.map((index) => ({ index })) }); });

const cardNames = () => screen.getAllByTestId(/^place-card-\d+$/).map((el) => el.textContent ?? '');

beforeEach(() => {
  state.city = { ...hanoi };
  state.places = { loading: false, loaded: true, error: null, data: [], reload: () => {} };
  state.cols = { loaded: true, data: [] };
  state.likes = {};
  state.myLikes = [];
  state.uid = null;
  state.taste = null;
  state.sky = null;
  state.ducked = false;
  state.scheme = 'dark';
  Object.values(spies).forEach((s) => s.mockClear());
});

describe('the hero', () => {
  it('names the city in the default headline and sub-line', () => {
    state.places.data = [place('a')];
    render(<ExploreScreen navigation={nav()} />);
    expect(screen.getByText('Ideas for a night in Hanoi')).toBeTruthy();
    expect(screen.getByText('Browse public collections and places — no account needed.')).toBeTruthy();
    expect(screen.getByText("Let's go")).toBeTruthy();
  });

  it('wears the desk’s headline, sub-line and button when the city has them', () => {
    state.city = { ...hanoi, hero_title_en: 'Hanoi after dark', hero_sub_en: 'Lanterns and lakes', hero_cta_en: 'Plan it' };
    state.places.data = [place('a')];
    render(<ExploreScreen navigation={nav()} />);
    expect(screen.getByText('Hanoi after dark')).toBeTruthy();
    expect(screen.getByText('Lanterns and lakes')).toBeTruthy();
    expect(screen.getByText('Plan it')).toBeTruthy();
    expect(screen.queryByText('Ideas for a night in Hanoi')).toBeNull();
  });

  it('says "the city" and hides the city chip before a city resolves', () => {
    state.city = null;
    state.places.data = [place('a')];
    render(<ExploreScreen navigation={nav()} />);
    expect(screen.getByText('Ideas for a night in the city')).toBeTruthy();
    expect(screen.queryByTestId('explore-city')).toBeNull();
  });

  it('opens and closes the city switcher from the chip', () => {
    state.places.data = [place('a')];
    render(<ExploreScreen navigation={nav()} />);
    const chip = screen.getByTestId('explore-city');
    expect(chip.getAttribute('aria-label')).toBe('Choose a city');
    expect(within(chip).getByText('Hanoi')).toBeTruthy();
    expect(screen.queryByText('close-city-sheet')).toBeNull();
    fireEvent.click(chip);
    fireEvent.click(screen.getByText('close-city-sheet'));
    expect(screen.queryByText('close-city-sheet')).toBeNull();
  });

  it('shows the temperature once the sky has arrived', () => {
    state.sky = { icon: 'sunny', temp: 31, gold: true };
    state.places.data = [place('a')];
    render(<ExploreScreen navigation={nav()} />);
    expect(screen.getByText('31°')).toBeTruthy();
  });

  it('shows no temperature while the sky is unknown', () => {
    state.places.data = [place('a')];
    render(<ExploreScreen navigation={nav()} />);
    expect(screen.queryByText(/°$/)).toBeNull();
  });

  it('opens Search from the search disc', () => {
    state.places.data = [place('a')];
    const navigation = nav();
    render(<ExploreScreen navigation={navigation} />);
    const search = screen.getByTestId('explore-search');
    expect(search.getAttribute('aria-label')).toBe('Search');
    fireEvent.click(search);
    expect(navigation.navigate).toHaveBeenCalledWith('Search');
  });

  it('sends the button to the planner in the Ideas tab', () => {
    state.places.data = [place('a')];
    render(<ExploreScreen navigation={nav()} />);
    fireEvent.click(screen.getByText("Let's go"));
    expect(spies.goTo).toHaveBeenCalledWith('Ideas', { screen: 'IdeasHome' });
  });
});

describe('the hero photograph', () => {
  const heroSrc = () => document.querySelector('img')?.getAttribute('src');

  it('uses the city’s pinned place when it has a photo', () => {
    state.city = { ...hanoi, hero_place_slug: 'pinned' };
    state.places.data = [
      place('views', { is_featured: true, vibe_tags: ['views'], place_photos: [photo('views.jpg')] }),
      place('pinned', { place_photos: [photo('pinned.jpg')] }),
    ];
    render(<ExploreScreen navigation={nav()} />);
    expect(heroSrc()).toBe('pinned.jpg');
  });

  it('falls through a pinned slug that matches nothing to a featured views place', () => {
    state.city = { ...hanoi, hero_place_slug: 'gone' };
    state.places.data = [
      place('plain', { place_photos: [photo('plain.jpg')] }),
      place('feat', { is_featured: true, place_photos: [photo('feat.jpg')] }),
      place('night', { is_featured: true, vibe_tags: ['nightlife'], place_photos: [photo('night.jpg')] }),
    ];
    render(<ExploreScreen navigation={nav()} />);
    expect(heroSrc()).toBe('night.jpg');
  });

  it('prefers any featured photo over an unfeatured one', () => {
    state.places.data = [
      place('plain', { place_photos: [photo('plain.jpg')] }),
      place('feat', { is_featured: true, place_photos: [photo('feat.jpg')] }),
    ];
    render(<ExploreScreen navigation={nav()} />);
    expect(heroSrc()).toBe('feat.jpg');
  });

  it('never picks a featured place with no photograph', () => {
    state.places.data = [
      place('bare', { is_featured: true, vibe_tags: ['views'] }),
      place('plain', { place_photos: [photo('plain.jpg')] }),
    ];
    render(<ExploreScreen navigation={nav()} />);
    expect(heroSrc()).toBe('plain.jpg');
  });
});

describe('loading and failure', () => {
  it('holds skeletons, not the list, until the catalog has loaded', () => {
    state.places = { ...state.places, loading: true, loaded: false };
    render(<ExploreScreen navigation={nav()} />);
    expect(screen.queryByTestId('explore-list')).toBeNull();
    expect(screen.queryByText('Places')).toBeNull();
    expect(spies.settle).not.toHaveBeenCalled();
  });

  it('tells the launch the content has landed once it loads', () => {
    state.places.data = [place('a')];
    render(<ExploreScreen navigation={nav()} />);
    expect(spies.mark).toHaveBeenCalledWith('explore:mounted');
    expect(spies.mark).toHaveBeenCalledWith('explore:content');
    expect(spies.settle).toHaveBeenCalledOnce();
  });

  it('files the startup report ten seconds after content, not before', () => {
    vi.useFakeTimers();
    try {
      state.places.data = [place('a')];
      render(<ExploreScreen navigation={nav()} />);
      act(() => { vi.advanceTimersByTime(9_999); });
      expect(spies.reportStartup).not.toHaveBeenCalled();
      act(() => { vi.advanceTimersByTime(1); });
      expect(spies.reportStartup).toHaveBeenCalledOnce();
      expect(spies.reportStartup.mock.calls[0][1]).toMatchObject({ isDev: false });
    } finally {
      vi.useRealTimers();
    }
  });

  it('says why the places failed to load, and draws no list', () => {
    state.places = { ...state.places, error: 'offline' };
    render(<ExploreScreen navigation={nav()} />);
    expect(screen.getByText("Couldn't load places: offline")).toBeTruthy();
    expect(screen.queryByTestId('explore-list')).toBeNull();
  });
});

describe('the places list', () => {
  it('orders the list best-rated first', () => {
    state.places.data = [
      place('low', { rating: 3.9, rating_count: 500 } as Partial<Place>),
      place('none'),
      place('high', { rating: 4.9, rating_count: 500 } as Partial<Place>),
    ];
    render(<ExploreScreen navigation={nav()} />);
    expect(cardNames().map((n) => n.match(/Place (\w+)/)?.[1])).toEqual(['high', 'low', 'none']);
  });

  it('lets the reader’s taste lift a place among equals', () => {
    state.taste = { affinity: (p) => (p.slug === 'zeta' ? 1 : 0) };
    state.places.data = [place('alpha'), place('zeta')];
    render(<ExploreScreen navigation={nav()} />);
    expect(cardNames()[0]).toContain('Place zeta');
  });

  it('opens a place’s detail from its card', () => {
    state.places.data = [place('bun-cha')];
    const navigation = nav();
    render(<ExploreScreen navigation={navigation} />);
    fireEvent.click(within(screen.getByTestId('place-card-0')).getByText('Place bun-cha'));
    expect(navigation.navigate).toHaveBeenCalledWith('PlaceDetail', { slug: 'bun-cha' });
  });

  it('ends in the add-a-place row, which opens AddPlace', () => {
    state.places.data = [place('a')];
    const navigation = nav();
    render(<ExploreScreen navigation={navigation} />);
    expect(screen.getByText('Search by name or address')).toBeTruthy();
    fireEvent.click(screen.getByText('Add a new place'));
    expect(navigation.navigate).toHaveBeenCalledWith('AddPlace');
  });

  it('says there is nothing here when the city has no places, and still offers to add one', () => {
    render(<ExploreScreen navigation={nav()} />);
    expect(screen.getByText('Nothing here yet.')).toBeTruthy();
    expect(screen.getByText('Add a new place')).toBeTruthy();
  });

  it('does not say "nothing here" over a list with places in it', () => {
    state.places.data = [place('a')];
    render(<ExploreScreen navigation={nav()} />);
    expect(screen.queryByText('Nothing here yet.')).toBeNull();
  });
});

describe('the category filter', () => {
  const mixed = () => [
    place('cafe1', { categories: ['cafes'] }),
    // Derived from its vibe rather than stored — the older rows' path.
    place('bar1', { vibe_tags: ['food_tour'] }),
    place('cafe2', { categories: ['cafes'] }),
  ];

  it('offers All plus only the categories this city has, in taxonomy order', () => {
    state.places.data = [place('bar1', { categories: ['nightlife'] }), place('cafe1', { categories: ['cafes'] })];
    render(<ExploreScreen navigation={nav()} />);
    expect(screen.getByText('All')).toBeTruthy();
    const cafes = screen.getByText('Cafés');
    const night = screen.getByText('Nightlife');
    expect(cafes.compareDocumentPosition(night) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByText('Eats')).toBeNull();
  });

  it('narrows the list to the chosen category, and All brings it back', () => {
    state.places.data = mixed();
    render(<ExploreScreen navigation={nav()} />);
    expect(cardNames()).toHaveLength(3);
    fireEvent.click(screen.getByText('Cafés'));
    expect(cardNames().every((n) => n.includes('cafe'))).toBe(true);
    expect(cardNames()).toHaveLength(2);
    fireEvent.click(screen.getByText('Eats'));
    expect(cardNames()).toHaveLength(1);
    expect(cardNames()[0]).toContain('Place bar1');
    fireEvent.click(screen.getByText('All'));
    expect(cardNames()).toHaveLength(3);
  });

  it('drops back to All when a city switch retires the chosen chip', () => {
    state.places.data = mixed();
    const { rerender } = render(<ExploreScreen navigation={nav()} />);
    fireEvent.click(screen.getByText('Eats'));
    expect(cardNames()).toHaveLength(1);
    state.places.data = [place('cafe9', { categories: ['cafes'] }), place('cafe8', { categories: ['cafes'] })];
    rerender(<ExploreScreen navigation={nav()} />);
    expect(screen.queryByText('Eats')).toBeNull();
    expect(cardNames()).toHaveLength(2);
    expect(screen.queryByText('Nothing here yet.')).toBeNull();
  });
});

describe('the community shelf', () => {
  it('shows only lists with a member in this city, most liked first', () => {
    state.places.data = [place('p1'), place('p2'), place('far', { city_id: 'saigon' })];
    state.cols.data = [
      collection('quiet', ['p1']),
      collection('elsewhere', ['far']),
      collection('empty', []),
      collection('loved', ['p1', 'p2']),
    ];
    state.likes = { loved: 7 };
    render(<ExploreScreen navigation={nav()} />);
    expect(screen.getByText('From the community')).toBeTruthy();
    expect(screen.queryByText('List elsewhere')).toBeNull();
    expect(screen.queryByText('List empty')).toBeNull();
    const loved = screen.getByText('List loved');
    const quiet = screen.getByText('List quiet');
    expect(loved.compareDocumentPosition(quiet) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText('7')).toBeTruthy();
  });

  it('counts members with the right plural', () => {
    state.places.data = [place('p1'), place('p2')];
    state.cols.data = [collection('one', ['p1']), collection('two', ['p1', 'p2'])];
    render(<ExploreScreen navigation={nav()} />);
    expect(screen.getByText('1 place')).toBeTruthy();
    expect(screen.getByText('2 places')).toBeTruthy();
  });

  it('is absent altogether when no list touches the city', () => {
    state.places.data = [place('p1')];
    state.cols.data = [collection('empty', [])];
    render(<ExploreScreen navigation={nav()} />);
    expect(screen.queryByText('From the community')).toBeNull();
  });

  it('holds its header over placeholders while collections load', () => {
    state.places.data = [place('p1')];
    state.cols = { loaded: false, data: [collection('later', ['p1'])] };
    render(<ExploreScreen navigation={nav()} />);
    expect(screen.getByText('From the community')).toBeTruthy();
    expect(screen.queryByText('List later')).toBeNull();
  });

  it('covers a card with its chosen cover, else its first member’s photo', () => {
    state.places.data = [place('p1', { place_photos: [photo('member.jpg')] })];
    state.cols.data = [
      collection('chosen', ['p1'], { cover: { photo_uri: 'chosen.jpg' } }),
      collection('fallback', ['p1']),
    ];
    render(<ExploreScreen navigation={nav()} />);
    const srcs = [...document.querySelectorAll('img')].map((i) => i.getAttribute('src'));
    expect(srcs).toContain('chosen.jpg');
    expect(srcs.filter((s) => s === 'member.jpg').length).toBeGreaterThanOrEqual(2);
  });

  it('badges a card with the vibe its members share most', () => {
    state.places.data = [
      place('p1', { vibe_tags: ['nightlife', 'not-a-vibe'] }),
      place('p2', { vibe_tags: ['nightlife', 'views'] }),
    ];
    state.cols.data = [collection('bars', ['p1', 'p2'])];
    render(<ExploreScreen navigation={nav()} />);
    const card = shelfCard('List bars');
    expect(card.querySelector('[data-icon="wine-outline"]')).toBeTruthy();
    expect(card.querySelector('[data-icon="business-outline"]')).toBeNull();
  });

  it('wears no badge when its members carry no known vibe', () => {
    state.places.data = [place('p1', { vibe_tags: ['not-a-vibe'] })];
    state.cols.data = [collection('plain', ['p1'])];
    render(<ExploreScreen navigation={nav()} />);
    const icons = [...shelfCard('List plain').querySelectorAll('[data-icon]')].map((i) => i.getAttribute('data-icon'));
    expect(icons).toEqual(['heart-outline']);
  });

  it('opens a list from its card', () => {
    state.places.data = [place('p1')];
    state.cols.data = [collection('bars', ['p1'])];
    const navigation = nav();
    render(<ExploreScreen navigation={navigation} />);
    fireEvent.click(screen.getByText('List bars'));
    expect(navigation.navigate).toHaveBeenCalledWith('CollectionDetail', { slug: 'bars' });
  });

  it('lands "See all" on the Community tab of Collections', () => {
    state.places.data = [place('p1')];
    state.cols.data = [collection('bars', ['p1'])];
    const navigation = nav();
    render(<ExploreScreen navigation={navigation} />);
    fireEvent.click(screen.getByText('See all →'));
    expect(navigation.parentNavigate).toHaveBeenCalledWith('Collections', {
      screen: 'CollectionsHome', params: { tab: 'community' },
    });
  });

  it('asks a signed-out guest to sign in instead of liking', () => {
    state.places.data = [place('p1')];
    state.cols.data = [collection('bars', ['p1'])];
    const navigation = nav();
    render(<ExploreScreen navigation={navigation} />);
    fireEvent.click(screen.getByRole('button', { name: 'Like this collection' }));
    expect(spies.askToSignIn).toHaveBeenCalledOnce();
    expect(spies.toggleLike).not.toHaveBeenCalled();
    expect(navigation.navigate).not.toHaveBeenCalled();
  });

  it('likes the list for a signed-in reader, by id and slug', () => {
    state.uid = 'u1';
    state.places.data = [place('p1')];
    state.cols.data = [collection('bars', ['p1'])];
    render(<ExploreScreen navigation={nav()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Like this collection' }));
    expect(spies.toggleLike).toHaveBeenCalledWith({ id: 'id-bars', slug: 'bars' });
    expect(spies.askToSignIn).not.toHaveBeenCalled();
  });

  it('shows a list already liked as such, and offers to unlike it', () => {
    state.uid = 'u1';
    state.myLikes = ['id-bars'];
    state.places.data = [place('p1')];
    state.cols.data = [collection('bars', ['p1'])];
    render(<ExploreScreen navigation={nav()} />);
    const heart = screen.getByRole('button', { name: 'Unlike this collection' });
    expect(heart.querySelector('[data-icon="heart"]')).toBeTruthy();
  });

  it('draws no heart on a list without an id, and prints no zero tally', () => {
    state.places.data = [place('p1')];
    state.cols.data = [collection('bars', ['p1'], { id: undefined } as Partial<Collection>)];
    state.likes = { bars: 0 };
    render(<ExploreScreen navigation={nav()} />);
    expect(screen.queryByRole('button', { name: 'Like this collection' })).toBeNull();
    expect(screen.queryByText('0')).toBeNull();
  });
});


describe('the status bar over the photograph', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  // Light type over the hero's dark scrim whatever the theme; past it, the
  // scheme's own ink — which on the paper theme is dark.
  it('wears light ink over the hero and hands back the scheme’s past it', () => {
    state.scheme = 'light';
    state.places.data = [place('a')];
    render(<ExploreScreen navigation={nav()} />);
    expect(spies.setStatusBarStyle).toHaveBeenLastCalledWith('light', true);
    scrollTo(2000);
    expect(spies.setStatusBarStyle).toHaveBeenLastCalledWith('dark', true);
    scrollTo(0);
    expect(spies.setStatusBarStyle).toHaveBeenLastCalledWith('light', true);
  });

  it('repaints once per crossing, not on every scroll frame', () => {
    state.scheme = 'light';
    state.places.data = [place('a')];
    render(<ExploreScreen navigation={nav()} />);
    scrollTo(1000);
    const after = spies.setStatusBarStyle.mock.calls.length;
    scrollTo(1500);
    scrollTo(2000);
    expect(spies.setStatusBarStyle.mock.calls.length).toBe(after);
  });
});

describe('pull to refresh', () => {
  it('reloads the catalog and spins only for the pull it started', () => {
    state.places.data = [place('a')];
    const { rerender } = render(<ExploreScreen navigation={nav()} />);
    expect(listProps().refreshing).toBe(false);
    act(() => { listProps().onRefresh(); });
    expect(spies.reload).toHaveBeenCalledOnce();
    expect(listProps().refreshing).toBe(true);
    // The fetch it started is in flight, then settles.
    state.places = { ...state.places, loading: true };
    rerender(<ExploreScreen navigation={nav()} />);
    expect(listProps().refreshing).toBe(true);
    state.places = { ...state.places, loading: false };
    rerender(<ExploreScreen navigation={nav()} />);
    expect(listProps().refreshing).toBe(false);
  });

  it('does not spin for a background refresh nobody pulled', () => {
    state.places = { ...state.places, loading: true, data: [place('a')] };
    render(<ExploreScreen navigation={nav()} />);
    expect(listProps().refreshing).toBe(false);
  });
});

describe('the scroll nudge', () => {
  const long = () => Array.from({ length: 6 }, (_, i) => place(`p${i}`));
  // Always mounted, so visibility is its fade: 0 is away, 1 is offered.
  const shown = () => {
    let el: HTMLElement | null = screen.getByText('Not finding it?');
    while (el && !el.style.opacity) el = el.parentElement;
    return el?.style.opacity === '1';
  };
  const settle = () => act(() => { vi.advanceTimersByTime(400); });

  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('offers search and add once the reader is deep and the tab bar has left', () => {
    state.ducked = true;
    state.places.data = long();
    const navigation = nav();
    render(<ExploreScreen navigation={navigation} />);
    settle();
    expect(shown()).toBe(false);
    seeCards(3, 2, null, 4);
    settle();
    expect(shown()).toBe(true);
    expect(screen.getByText('Search, or add your own')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(navigation.navigate).toHaveBeenCalledWith('AddPlace');
    fireEvent.click(screen.getByText('Not finding it?'));
    expect(navigation.navigate).toHaveBeenCalledWith('Search');
  });

  it('stays away while the tab bar holds the dock', () => {
    state.places.data = long();
    render(<ExploreScreen navigation={nav()} />);
    seeCards(3);
    settle();
    expect(shown()).toBe(false);
  });

  it('stays away until two cards have passed overhead', () => {
    state.ducked = true;
    state.places.data = long();
    render(<ExploreScreen navigation={nav()} />);
    seeCards(1, 2);
    settle();
    expect(shown()).toBe(false);
  });

  // Between frames the list reports an empty set, which says nothing about
  // where the reader is: it must neither withdraw the offer nor raise it.
  it('reads an empty viewability batch as no news', () => {
    state.ducked = true;
    state.places.data = long();
    render(<ExploreScreen navigation={nav()} />);
    seeCards(0, 1);
    seeCards();
    settle();
    expect(shown()).toBe(false);
    seeCards(3);
    seeCards();
    settle();
    expect(shown()).toBe(true);
  });

  it('never appears on a list too short to get lost in', () => {
    state.ducked = true;
    state.places.data = long().slice(0, 4);
    render(<ExploreScreen navigation={nav()} />);
    seeCards(3);
    settle();
    expect(shown()).toBe(false);
  });

  it('withdraws when the reader scrolls back near the top', () => {
    state.ducked = true;
    state.places.data = long();
    render(<ExploreScreen navigation={nav()} />);
    seeCards(3);
    settle();
    expect(shown()).toBe(true);
    scrollTo(100);
    settle();
    expect(shown()).toBe(false);
  });

  it('starts its beat over when the screen is focused again', () => {
    state.ducked = true;
    state.places.data = long();
    const navigation = nav();
    render(<ExploreScreen navigation={navigation} />);
    seeCards(3);
    settle();
    expect(shown()).toBe(true);
    act(() => { navigation.focus(); });
    settle();
    expect(shown()).toBe(false);
  });
});
