// @vitest-environment jsdom
//
// One place, read in full. What is pinned here is what a reader standing on
// the pavement relies on: the right name (split from its branch), the rating
// and how many people it rests on, what kind of place it is and what it
// costs, whether it is open *right now* on Hanoi's clock, and that each row
// of the info card goes where it says — Google Maps for the address, the
// dialler for the phone, the browser for the website. The floating discs
// go back, share a sentence with the map link in it, and hand the place to
// the save sheet. Loading and not-found each get their own face.
//
// The catalog, the one-off fetch, the save flow, the taste log and the
// photo-credit flag are mocked at the screen's own imports. The pure
// helpers (hours parsing, name splitting, maps URLs, prices) stay real:
// they are what turns a row into the words on screen, and a mock of them
// would pin nothing. The clock is fixed because "Open now" is the
// behaviour under test.

import React from 'react';
import { Alert, Linking, Share } from 'react-native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '../uitest/render';
import type { Place } from '../lib/data';
import type { Nav, RootRoute } from '../nav';

// jsdom lays nothing out, so the document is zero pixels wide — and the hero
// is sized off the window: a zero-wide carousel pages by dividing by zero,
// and a zero-tall hero is scrolled past before the page moves. A phone's
// width is set before react-native-web's `Dimensions` first reads it.
const WIDTH = vi.hoisted(() => {
  Object.defineProperty(document.documentElement, 'clientWidth', { configurable: true, value: 400 });
  Object.defineProperty(document.documentElement, 'clientHeight', { configurable: true, value: 800 });
  return 400;
});

const state = vi.hoisted(() => ({
  catalog: { loading: false, data: [] as unknown[] },
  elsewhere: { loading: false, data: null as unknown },
  saved: [] as string[],
  credit: false,
  city: null as null | Record<string, string>,
  lang: 'en' as 'en' | 'vi' | 'ja',
}));
const spies = vi.hoisted(() => ({
  save: vi.fn(),
  note: vi.fn(),
  bySlug: vi.fn(),
  setStatusBarStyle: vi.fn(),
}));

// The provider's own fallback order, so a Japanese reader can be stood in
// for: which language a field is shown in is part of what is under test.
type Str = string | null | undefined;
vi.mock('../lib/i18n', () => ({
  useI18n: () => ({
    lang: state.lang,
    setLang: () => {},
    t: (en: Str, vi: Str, ja?: Str) => (state.lang === 'vi' ? vi ?? en ?? ''
      : state.lang === 'ja' ? ja ?? en ?? vi ?? ''
        : en ?? vi ?? ''),
  }),
}));
vi.mock('../lib/city', () => ({ useCity: () => ({ city: state.city }) }));
vi.mock('../lib/catalog', () => ({ usePlaces: () => state.catalog }));
// The barrel pulls in Supabase; the pure helpers it re-exports from
// `lib/place` are kept real, and only the fetch hook is stood in for.
vi.mock('../lib/data', async () => ({
  ...(await vi.importActual<typeof import('../lib/place')>('../lib/place')),
  usePlaceBySlug: (slug: string | null) => { spies.bySlug(slug); return state.elsewhere; },
}));
vi.mock('../lib/save', () => ({
  useSave: () => ({ save: spies.save, isSaved: (slug: string) => state.saved.includes(slug) }),
}));
vi.mock('../lib/tasteProfile', () => ({ useNoteEvent: () => spies.note }));
vi.mock('../lib/useFlag', () => ({ useFlag: () => state.credit }));
vi.mock('../lib/theme', () => ({
  useScheme: () => ({ scheme: 'light', setScheme: () => {}, ready: true }),
}));
// The status bar is owned through `useNavigation().isFocused` and painted
// through `setStatusBarStyle`; the shared stubs have neither.
vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ isFocused: () => true, addListener: () => () => {} }),
  useIsFocused: () => true,
  useFocusEffect: () => {},
}));
vi.mock('expo-status-bar', () => ({ StatusBar: () => null, setStatusBarStyle: spies.setStatusBarStyle }));

import PlaceDetailScreen from './PlaceDetailScreen';

const openURL = vi.spyOn(Linking, 'openURL').mockImplementation(async () => true);
const shareSpy = vi.spyOn(Share, 'share').mockImplementation(async () => ({ action: 'sharedAction' }));
// react-native-web's `Alert` is a silent no-op; what the reader is told is
// read off the spy (see `uitest/setup`).
const alert = vi.spyOn(Alert, 'alert').mockImplementation(() => {});
/** Lets a rejected `openURL` reach its `.catch`. */
const settle = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

// Wednesday 10:00 in Hanoi (UTC+7).
const WED_10AM = new Date('2026-09-09T03:00:00Z');
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const week = (hours: string) => DAYS.map((d) => `${d}: ${hours}`);

const photo = (uri: string, over: Record<string, unknown> = {}) => ({
  photo_uri: uri, is_cover: false, is_hidden: false, sort_order: 0, attribution_name: null, ...over,
});

const place = (over: Partial<Place> & Record<string, unknown> = {}): Place => ({
  slug: 'cong-caphe',
  city_id: 'hanoi',
  name_en: 'Cộng Cà Phê - Old Quarter',
  name_vi: 'Cộng Cà Phê - Phố Cổ',
  name_ja: null,
  category: 'food',
  categories: ['cafes'],
  vibe_tags: [],
  emoji: '☕',
  is_published: true,
  review_status: 'approved',
  place_photos: [],
  rating: 4.6,
  rating_count: 1234,
  price_display: null,
  price_vnd: 45000,
  desc_en: 'Military-green coconut coffee.',
  desc_vi: 'Cà phê cốt dừa.',
  desc_ja: null,
  address: '152 Trieu Viet Vuong, Hai Ba Trung, Hanoi, Vietnam',
  neighborhood_en: 'Hai Ba Trung',
  neighborhood_vi: 'Hai Bà Trưng',
  neighborhood_ja: null,
  lat: 21.01,
  lng: 105.85,
  google_place_id: 'gp1',
  opening_hours: week('7:00 AM – 11:00 PM'),
  phone: '024 3923 2233',
  website: 'https://www.congcaphe.com/',
  ...over,
} as unknown as Place);

const nav = () => ({ navigate: vi.fn(), goBack: vi.fn(), replace: vi.fn() }) as unknown as Nav & {
  goBack: ReturnType<typeof vi.fn>;
};
const route = (slug = 'cong-caphe') => ({ params: { slug } }) as RootRoute<'PlaceDetail'>;

const show = (p: Place | null = place(), n = nav(), slug?: string) => {
  state.catalog = { loading: false, data: p ? [p] : [] };
  render(<PlaceDetailScreen navigation={n} route={route(slug ?? p?.slug)} />);
  return n;
};

/**
 * Props of the first committed element matching `pick`. jsdom lays nothing
 * out, so a paging carousel never settles and a real scroll gesture does not
 * exist; the screen's own handlers for both are reached where it passes them.
 */
const propsWhere = (pick: (p: Record<string, unknown>) => boolean): Record<string, (...a: unknown[]) => void> => {
  type Fiber = { child: Fiber | null; sibling: Fiber | null; memoizedProps: Record<string, unknown> | null };
  const host = document.body.firstElementChild as unknown as Record<string, { stateNode: { current: Fiber } }>;
  const key = Object.keys(host).find((k) => k.startsWith('__reactContainer'))!;
  const stack: Fiber[] = [host[key].stateNode.current];
  while (stack.length) {
    const f = stack.pop()!;
    const p = f.memoizedProps;
    if (p && typeof p === 'object' && pick(p)) return p as Record<string, (...a: unknown[]) => void>;
    if (f.sibling) stack.push(f.sibling);
    if (f.child) stack.push(f.child);
  }
  throw new Error('no matching element in the committed tree');
};
/** The carousel's photographs, in the order a swipe reaches them. */
const heroPhotos = () => [...document.querySelectorAll('img')].map((i) => i.getAttribute('src'));
// react-native-web drops `accessibilityState`, so what VoiceOver would be
// told is read off the props the screen handed the control.
const a11yState = (label: string) =>
  propsWhere((p) => p.accessibilityLabel === label).accessibilityState as unknown as Record<string, boolean>;
const swipeTo = (page: number) => {
  const carousel = propsWhere((p) => p.horizontal === true && typeof p.onMomentumScrollEnd === 'function');
  act(() => { carousel.onMomentumScrollEnd({ nativeEvent: { contentOffset: { x: page * WIDTH } } }); });
};
const scrollPage = (y: number) => {
  const page = propsWhere((p) => p.scrollEventThrottle === 16 && typeof p.onScroll === 'function');
  act(() => { page.onScroll({ nativeEvent: { contentOffset: { y } } }); });
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(WED_10AM);
  state.catalog = { loading: false, data: [] };
  state.elsewhere = { loading: false, data: null };
  state.saved = [];
  state.credit = false;
  state.city = null;
  state.lang = 'en';
  spies.save.mockClear();
  spies.note.mockClear();
  spies.bySlug.mockClear();
  spies.setStatusBarStyle.mockClear();
  openURL.mockReset();
  openURL.mockImplementation(async () => true);
  shareSpy.mockClear();
  alert.mockClear();
});
afterEach(() => { vi.useRealTimers(); });

describe('PlaceDetailScreen — loading and missing', () => {
  it('shows a spinner, not "not found", while the catalog is still loading', () => {
    state.catalog = { loading: true, data: [] };
    render(<PlaceDetailScreen navigation={nav()} route={route()} />);
    expect(screen.getByRole('progressbar')).toBeTruthy();
    expect(screen.queryByText('Place not found.')).toBeNull();
    // Nothing is fetched separately until the catalog has had its say.
    expect(spies.bySlug).toHaveBeenLastCalledWith(null);
  });

  it('fetches a place the catalog does not hold, spinning while it does', () => {
    state.elsewhere = { loading: true, data: null };
    show(null, nav(), 'unlisted');
    expect(spies.bySlug).toHaveBeenLastCalledWith('unlisted');
    expect(screen.getByRole('progressbar')).toBeTruthy();
  });

  it('renders a place found outside the catalog (another city, a shared link)', () => {
    state.elsewhere = { loading: false, data: place({ slug: 'elsewhere', name_en: 'Far Away Café' }) };
    show(null, nav(), 'elsewhere');
    expect(screen.getByTestId('detail-name').textContent).toBe('Far Away Café');
  });

  it('says so when the place exists nowhere', () => {
    show(null, nav(), 'ghost');
    expect(screen.getByText('Place not found.')).toBeTruthy();
    expect(screen.queryByTestId('detail-name')).toBeNull();
    expect(spies.note).not.toHaveBeenCalled();
  });

  it('does not refetch a place the catalog already has', () => {
    show();
    expect(spies.bySlug).toHaveBeenLastCalledWith(null);
  });

  it('records one "open" in the taste log once the place is on screen', () => {
    show();
    expect(spies.note).toHaveBeenCalledWith('cong-caphe', 'open');
    expect(spies.note).toHaveBeenCalledTimes(1);
  });
});

describe('PlaceDetailScreen — title, rating, facts', () => {
  it('splits the branch off the name and prints it as a subtitle', () => {
    show();
    expect(screen.getByTestId('detail-name').textContent).toBe('Cộng Cà Phê');
    expect(screen.getByText('Old Quarter')).toBeTruthy();
  });

  it('drops a subtitle that only repeats the neighbourhood', () => {
    show(place({ name_en: 'Cafe Slow - Hai Ba Trung', address: null }));
    expect(screen.getByTestId('detail-name').textContent).toBe('Cafe Slow');
    // Printed once — as the location line — not twice.
    expect(screen.getAllByText('Hai Ba Trung')).toHaveLength(1);
  });

  it('shows the neighbourhood line only when there is no address to show instead', () => {
    show(place({ name_en: 'Plain' }));
    expect(screen.queryByText('Hai Ba Trung')).toBeNull();
  });

  it('prints the rating and the review count, compacted', () => {
    show();
    expect(screen.getByText('4.6')).toBeTruthy();
    expect(screen.getByText('1.2k reviews')).toBeTruthy();
  });

  it('shows the rating without a count when nobody is counted', () => {
    show(place({ rating_count: null }));
    expect(screen.getByText('4.6')).toBeTruthy();
    expect(screen.queryByText(/reviews/)).toBeNull();
  });

  it('has no rating badge for an unrated place', () => {
    show(place({ rating: null }));
    expect(screen.queryByText(/reviews/)).toBeNull();
    expect(document.querySelector('[data-icon="star"]')).toBeNull();
  });

  it('names the category with its own glyph, and a paid price per person', () => {
    show();
    expect(screen.getByText('Cafés')).toBeTruthy();
    expect(document.querySelector('[data-icon="cafe-outline"]')).toBeTruthy();
    expect(screen.getByText('~45k ₫ / person')).toBeTruthy();
    expect(document.querySelector('[data-icon="pricetag-outline"]')).toBeTruthy();
  });

  it('shows FREE as its own pill, without a price tag glyph', () => {
    show(place({ price_vnd: 0 }));
    expect(screen.getByText('Free')).toBeTruthy();
    expect(document.querySelector('[data-icon="pricetag-outline"]')).toBeNull();
  });

  it('shows no price at all when none is known', () => {
    show(place({ price_vnd: null, price_display: null }));
    expect(screen.queryByText(/person|Free/)).toBeNull();
  });

  it('falls back to the legacy category for rows written before `categories`', () => {
    show(place({ categories: [], category: 'food' }));
    expect(screen.getByText('Eats')).toBeTruthy();
  });

  it('prints the description', () => {
    show();
    expect(screen.getByText('Military-green coconut coffee.')).toBeTruthy();
  });

  it('omits the description paragraph for a place without one', () => {
    show(place({ desc_en: null, desc_vi: null }));
    expect(screen.queryByText('Military-green coconut coffee.')).toBeNull();
  });

  it('shows a description written only in Japanese to a Japanese reader', () => {
    state.lang = 'ja';
    show(place({ desc_en: null, desc_vi: null, desc_ja: 'ココナッツコーヒー。' }));
    expect(screen.getByText('ココナッツコーヒー。')).toBeTruthy();
  });
});

describe('PlaceDetailScreen — hero', () => {
  it('shows the emoji instead of a carousel when there are no photos', () => {
    show();
    expect(screen.getByText('☕')).toBeTruthy();
    expect(heroPhotos()).toEqual([]);
    expect(screen.queryByText(/\d \/ \d/)).toBeNull();
  });

  it('falls back to a pin for a place with no emoji either', () => {
    show(place({ emoji: null }));
    expect(screen.getByText('📍')).toBeTruthy();
  });

  it('opens on the cover photo, skipping hidden ones, and counts only visible ones', () => {
    show(place({
      place_photos: [
        photo('b.jpg', { sort_order: 1 }),
        photo('hidden.jpg', { is_hidden: true }),
        photo('cover.jpg', { is_cover: true, sort_order: 5 }),
      ],
    }));
    expect(heroPhotos()[0]).toBe('cover.jpg');
    expect(heroPhotos()).toEqual(['cover.jpg', 'b.jpg']);
    expect(screen.getByText('1 / 2')).toBeTruthy();
  });

  it('names each photo, and where it sits in the set, for VoiceOver', () => {
    show(place({ place_photos: [photo('a.jpg'), photo('b.jpg', { sort_order: 1 }), photo('c.jpg', { sort_order: 2 })] }));
    const labels = ['a.jpg', 'b.jpg', 'c.jpg'].map((uri) =>
      propsWhere((p) => (p.source as { uri?: string } | undefined)?.uri === uri).accessibilityLabel);
    expect(labels).toEqual([
      'Photo 1 of 3 of Cộng Cà Phê - Old Quarter',
      'Photo 2 of 3 of Cộng Cà Phê - Old Quarter',
      'Photo 3 of 3 of Cộng Cà Phê - Old Quarter',
    ]);
  });

  it('advances the counter as the carousel is swiped', () => {
    show(place({ place_photos: [photo('a.jpg'), photo('b.jpg', { sort_order: 1 }), photo('c.jpg', { sort_order: 2 })] }));
    swipeTo(2);
    expect(screen.getByText('3 / 3')).toBeTruthy();
  });

  it('credits the photographer of the photo on screen when attribution is on', () => {
    state.credit = true;
    show(place({
      place_photos: [
        photo('a.jpg', { attribution_name: 'Linh' }),
        photo('b.jpg', { sort_order: 1, attribution_name: 'Minh' }),
      ],
    }));
    expect(screen.getByText('Linh')).toBeTruthy();
    swipeTo(1);
    expect(screen.getByText('Minh')).toBeTruthy();
    expect(screen.queryByText('Linh')).toBeNull();
  });

  it('prints no credit while the attribution flag is off', () => {
    show(place({ place_photos: [photo('a.jpg', { attribution_name: 'Linh' })] }));
    expect(screen.queryByText('Linh')).toBeNull();
  });
});

describe('PlaceDetailScreen — floating controls', () => {
  it('goes back', () => {
    const n = show();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(n.goBack).toHaveBeenCalledTimes(1);
  });

  it('hands the place to the save sheet', () => {
    const p = place();
    show(p);
    const btn = screen.getByRole('button', { name: 'Save to a collection' });
    expect(a11yState('Save to a collection')).toEqual({ selected: false });
    expect(btn.querySelector('[data-icon="bookmark-outline"]')).toBeTruthy();
    fireEvent.click(btn);
    expect(spies.save).toHaveBeenCalledWith(p);
  });

  it('says a saved place is saved, and still opens the sheet to change lists', () => {
    state.saved = ['cong-caphe'];
    show();
    const btn = screen.getByRole('button', { name: 'Saved — change collections' });
    expect(a11yState('Saved — change collections')).toEqual({ selected: true });
    expect(document.querySelector('[data-icon="bookmark"]')).toBeTruthy();
    fireEvent.click(btn);
    expect(spies.save).toHaveBeenCalledTimes(1);
  });

  it('shares the name, address and the Google Maps link', () => {
    show();
    fireEvent.click(screen.getByLabelText('Share'));
    expect(shareSpy).toHaveBeenCalledWith({
      message: 'Cộng Cà Phê - Old Quarter — 152 Trieu Viet Vuong, Hai Ba Trung, Hanoi, Vietnam\n'
        + `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('Cộng Cà Phê - Old Quarter')}&query_place_id=gp1`,
    });
  });

  it('announces Share as a button', () => {
    show();
    expect(screen.getByRole('button', { name: 'Share' })).toBeTruthy();
  });

  it('shares the name alone, with no dangling dash, for a place with no address', () => {
    show(place({ address: null, lat: null, lng: null }));
    fireEvent.click(screen.getByLabelText('Share'));
    expect(shareSpy.mock.calls[0][0]).toEqual({ message: 'Cộng Cà Phê - Old Quarter' });
  });

  it('shares without a link for a place with no coordinates', () => {
    show(place({ lat: null, lng: null }));
    fireEvent.click(screen.getByLabelText('Share'));
    expect(shareSpy.mock.calls[0][0]).toEqual({
      message: 'Cộng Cà Phê - Old Quarter — 152 Trieu Viet Vuong, Hai Ba Trung, Hanoi, Vietnam',
    });
  });
});

describe('PlaceDetailScreen — info card', () => {
  it('shortens the address and opens Google Maps on the exact place', () => {
    show();
    const addr = screen.getByTestId('detail-address');
    // Country and the city this app is already about are dropped.
    expect(addr.textContent).toBe('152 Trieu Viet Vuong, Hai Ba Trung');
    fireEvent.click(screen.getByRole('button', { name: /Address/ }));
    expect(openURL).toHaveBeenCalledWith(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('Cộng Cà Phê - Old Quarter')}&query_place_id=gp1`,
    );
  });

  it('opens Maps on the coordinate when the place has no Google id', () => {
    show(place({ google_place_id: null }));
    fireEvent.click(screen.getByRole('button', { name: /Address/ }));
    expect(openURL).toHaveBeenCalledWith(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('21.01,105.85')}`,
    );
  });

  it('leaves the address as plain text when the place cannot be put on a map', () => {
    show(place({ lat: null, lng: null }));
    expect(screen.getByTestId('detail-address')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Address/ })).toBeNull();
  });

  it('also drops the current city\'s own name from the address', () => {
    state.city = { name_vi: 'Hồ Chí Minh', name_en: 'Ho Chi Minh City', short_vi: 'HCM', short_en: 'Saigon' };
    show(place({ address: '12 Le Loi, District 1, Ho Chi Minh City, Vietnam' }));
    expect(screen.getByTestId('detail-address').textContent).toBe('12 Le Loi, District 1');
  });

  it('dials the number with its spaces taken out', () => {
    show();
    expect(screen.getByText('024 3923 2233')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Phone/ }));
    expect(openURL).toHaveBeenCalledWith('tel:02439232233');
  });

  it('shows the website bare and opens the full URL', () => {
    show();
    expect(screen.getByText('congcaphe.com')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Website/ }));
    expect(openURL).toHaveBeenCalledWith('https://www.congcaphe.com/');
  });

  it('opens a website stored without a scheme as https', () => {
    show(place({ website: 'congcaphe.com' }));
    expect(screen.getByText('congcaphe.com')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Website/ }));
    expect(openURL).toHaveBeenCalledWith('https://congcaphe.com');
  });

  it.each([
    ['Address', 'Could not open Maps'],
    ['Phone', 'Could not place the call'],
    ['Website', 'Could not open the website'],
  ])('says so when the %s row cannot be opened', async (row, words) => {
    openURL.mockImplementation(async () => { throw new Error('no handler'); });
    show();
    fireEvent.click(screen.getByRole('button', { name: new RegExp(row) }));
    await settle();
    expect(alert).toHaveBeenCalledWith(words);
  });

  it('draws no card at all for a place with nothing to put in it', () => {
    show(place({ address: null, opening_hours: [], phone: null, website: null }));
    expect(screen.queryByText('Address')).toBeNull();
    expect(screen.queryByText('Hours')).toBeNull();
    expect(screen.queryByText('Phone')).toBeNull();
    expect(screen.queryByText('Website')).toBeNull();
    // With no address, the neighbourhood carries the location instead.
    expect(screen.getByText('Hai Ba Trung')).toBeTruthy();
  });

  it('still shows a lone website row', () => {
    show(place({ address: null, opening_hours: [], phone: null }));
    expect(screen.getByRole('button', { name: /Website/ })).toBeTruthy();
    expect(screen.queryByText('Phone')).toBeNull();
  });
});

describe('PlaceDetailScreen — opening hours (Wednesday 10:00, Hanoi)', () => {
  const hoursButton = () => screen.getByRole('button', { name: /^Hours/ });
  const hoursState = () =>
    propsWhere((p) => !!p.accessibilityState && 'expanded' in (p.accessibilityState as object))
      .accessibilityState as unknown as Record<string, boolean>;

  it('says it is open and until when', () => {
    show();
    expect(screen.getByText('Open now · until 23:00')).toBeTruthy();
  });

  it('says a round-the-clock place is open 24 hours', () => {
    show(place({ opening_hours: week('Open 24 hours') }));
    expect(screen.getByText('Open now · 24 hours')).toBeTruthy();
  });

  it('says when a closed place opens later today', () => {
    show(place({ opening_hours: week('5:00 PM – 11:00 PM') }));
    expect(screen.getByText('Closed · opens 17:00')).toBeTruthy();
  });

  it('says closed today when it does not open again today', () => {
    show(place({ opening_hours: week('Closed') }));
    expect(screen.getByText('Closed today')).toBeTruthy();
  });

  it('reads the place\'s clock, not the device\'s: 23:30 in Hanoi is closed', () => {
    vi.setSystemTime(new Date('2026-09-09T16:30:00Z'));
    show();
    expect(screen.getByText('Closed today')).toBeTruthy();
  });

  it('keeps the Hours row but no open-now line for hours it cannot read', () => {
    show(place({ opening_hours: week('by appointment') }));
    expect(screen.getByText('Hours')).toBeTruthy();
    expect(screen.queryByText(/Open now|Closed/)).toBeNull();
  });

  it('folds the weekly table behind the row and unfolds it on tap', () => {
    show(place({ opening_hours: [...week('7:00 AM – 11:00 PM').slice(0, 6), 'Sunday: Closed'] }));
    expect(hoursState()).toEqual({ expanded: false });
    expect(document.querySelector('[data-icon="chevron-down"]')).toBeTruthy();
    expect(screen.queryByText('Mon–Sat')).toBeNull();
    fireEvent.click(hoursButton());
    expect(hoursState()).toEqual({ expanded: true });
    expect(document.querySelector('[data-icon="chevron-up"]')).toBeTruthy();
    expect(screen.getByText('Mon–Sat')).toBeTruthy();
    expect(screen.getByText('Sun')).toBeTruthy();
    expect(screen.getByText('Closed')).toBeTruthy();
    fireEvent.click(hoursButton());
    expect(screen.queryByText('Mon–Sat')).toBeNull();
  });
});

describe('PlaceDetailScreen — status bar over the photo', () => {
  it('paints the clock light over the hero, and hands it back once scrolled past', () => {
    show();
    expect(spies.setStatusBarStyle).toHaveBeenLastCalledWith('light', true);
    scrollPage(5000);
    // The scheme is light, so the screen's own ink is dark.
    expect(spies.setStatusBarStyle).toHaveBeenLastCalledWith('dark', true);
    spies.setStatusBarStyle.mockClear();
    scrollPage(6000);
    // Still past the hero: nothing to repaint.
    expect(spies.setStatusBarStyle).not.toHaveBeenCalled();
    scrollPage(0);
    expect(spies.setStatusBarStyle).toHaveBeenLastCalledWith('light', true);
  });

  it('does not claim the bar for a place that is not there', () => {
    show(null, nav(), 'ghost');
    expect(spies.setStatusBarStyle).not.toHaveBeenCalledWith('light', true);
  });
});
