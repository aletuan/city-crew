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
import { act, cleanup, fireEvent, render, screen } from '../uitest/render';
import { pinImage } from '../components/mapPins';
import type { Place } from '../lib/data';
import type { Nav, RootRoute } from '../nav';
import { colors } from '../theme';

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
  guide: false,
  uid: null as string | null,
  price: false,
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
// The list carries the chosen city alone: the hours ribbon reads the
// place's zone off it, and a place from another city reads as Vietnam.
vi.mock('../lib/city', () => ({ useCity: () => ({ city: state.city, cities: state.city ? [state.city] : [] }) }));
vi.mock('../lib/catalog', () => ({ usePlaces: () => state.catalog }));
// The barrel pulls in Supabase; the pure helpers it re-exports from
// `lib/place` are kept real, and only the fetch hook is stood in for.
vi.mock('../lib/data', async () => ({
  ...(await vi.importActual<typeof import('../lib/place')>('../lib/place')),
  usePlaceBySlug: (slug: string | null) => { spies.bySlug(slug); return state.elsewhere; },
  // What `LocalGuidePanel` reaches for. Answering "not a guide" is what
  // keeps every test below about the screen it is testing: the panel draws
  // nothing, exactly as it does for almost everybody. `state.guide` is
  // what the two tests that *are* about it turn on.
  fetchPlaceId: async () => 'place-uuid',
  fetchMyPhotoCounts: async () => ({ mineHere: 0, mineToday: 0 }),
  addPlacePhoto: async () => 'photo-id',
}));
// The grant is read from a store now, not fetched — see `lib/guideGrant`.
vi.mock('../lib/useGuideGrant', () => ({ useIsGuide: () => state.guide }));
vi.mock('../lib/auth', () => ({
  useAuth: () => ({ session: state.uid ? { user: { id: state.uid } } : null }),
}));
vi.mock('../lib/save', () => ({
  useSave: () => ({ save: spies.save, isSaved: (slug: string) => state.saved.includes(slug) }),
}));
vi.mock('../lib/tasteProfile', () => ({ useNoteEvent: () => spies.note }));
// Two switches now, and they are not the same answer. `place_price` ships
// off, which is what the screen draws for everybody until a row in
// `app_flags` says otherwise — so that is what these tests see unless one
// of them turns it on.
vi.mock('../lib/useFlag', () => ({
  useFlag: (key: string) => (key === 'place_price' ? state.price : state.credit),
}));
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
// A stub, which is also what keeps `expo-constants` — and through it the
// whole native module layer — out of jsdom. The real one answers to the
// binary's capabilities, which no test can stand in for.
// `vi.hoisted`, because the mock factory is lifted above everything else
// in this file and would otherwise close over an uninitialised binding.
const mapStub = vi.hoisted(() => ({ canDraw: true }));
vi.mock('../components/MiniMap', async () => {
  const R = await import('react');
  return {
    default: (p: any) => R.createElement('button', {
      type: 'button',
      'data-stub': 'MiniMap',
      'data-interactive': String(p.interactive),
      'data-pin': String(p.pin),
      onClick: () => p.onPick({ lat: p.lat, lng: p.lng }),
    }),
    // A getter, so a test can answer no. True by default, because the
    // screen asks before it draws and a stub that always said no would be
    // testing the empty card every time — but the no is now reachable,
    // and it has to be: it is the whole of the Expo Go and
    // built-without-the-key case, where the Directions button has no map
    // to stand on and must fall back into the address row.
    //
    // Whether a given binary can really draw a Google map stays the real
    // module's business; it answers by asking `expo-constants`.
    get canDrawMap() { return mapStub.canDraw; },
  };
});

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
  state.price = false;
  state.city = null;
  state.lang = 'en';
  state.guide = false;
  state.uid = null;
  mapStub.canDraw = true;
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

  // ── the subtitle against the address ──
  //
  // The commoner half of the rule, and the half the neighbourhood test
  // cannot reach: 128 of the catalog's 250 subtitles name the street the
  // address row prints a few lines down. See `subtitleBeside`.
  it('drops a subtitle the address row already prints', () => {
    show(place({ name_en: 'Cộng Cà Phê - Trieu Viet Vuong' }));
    expect(screen.getByTestId('detail-name').textContent).toBe('Cộng Cà Phê');
    // Once, as the address — not twice.
    expect(screen.getAllByText(/Trieu Viet Vuong/)).toHaveLength(1);
  });

  // The one that pins *which* address is used. "Hanoi" is in the raw
  // column and not in the string the row prints, because `shortAddress`
  // cuts the city; judged against the raw column this subtitle would
  // vanish over a word the reader cannot see.
  it('judges the subtitle against the printed address, not the raw column', () => {
    show(place({ name_en: 'Cộng Cà Phê - Hanoi', address: '152 Trieu Viet Vuong, Hai Ba Trung, Hanoi, Vietnam' }));
    expect(screen.getByTestId('detail-name').textContent).toBe('Cộng Cà Phê');
    expect(screen.getByText('Hanoi')).toBeTruthy();
    expect(screen.getByTestId('detail-address').textContent).toBe('152 Trieu Viet Vuong, Hai Ba Trung');
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

  it('has no rating line at all for an unrated place', () => {
    show(place({ rating: null }));
    expect(screen.queryByText(/reviews/)).toBeNull();
    expect(screen.queryByTestId('detail-rating')).toBeNull();
    expect(document.querySelector('[data-icon="star"]')).toBeNull();
  });

  // ── the rating is a line under the name, not a badge beside it ──
  //
  // Both halves of this matter and neither is enough alone. Under the old
  // markup the rating was also "present" and also "after the name" in
  // document order — it was a sibling of the column the name lived in, one
  // level up. Asserting the shared parent is what distinguishes a line
  // below the title from a box next to it, and the shared parent is the
  // whole point: it is what gives the name the full width of the card.
  it('puts the rating in the title column, below the name, not beside it', () => {
    show();
    const name = screen.getByTestId('detail-name');
    const rating = screen.getByTestId('detail-rating');
    expect(rating.parentElement).toBe(name.parentElement);
    expect(name.compareDocumentPosition(rating) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('reads the score and the count on one line, separated by a dot', () => {
    show();
    const rating = screen.getByTestId('detail-rating');
    expect(rating.textContent).toBe('4.6\u00b71.2k reviews');
  });

  // Four stops for one fact is what this avoids: the star glyph, the
  // number, a lone middle dot, then the count.
  it('speaks the rating as a single phrase', () => {
    show();
    expect(screen.getByTestId('detail-rating').getAttribute('aria-label'))
      .toBe('4.6 \u2014 1.2k reviews');
  });

  it('says only the score when nobody is counted', () => {
    show(place({ rating_count: null }));
    expect(screen.getByTestId('detail-rating').getAttribute('aria-label')).toBe('4.6');
  });

  it('names the category with its own glyph', () => {
    show();
    expect(screen.getByText('Cafés')).toBeTruthy();
    expect(document.querySelector('[data-icon="cafe-outline"]')).toBeTruthy();
  });

  // ── the price, which ships hidden ──
  //
  // It is the chip that pushes a three-category place onto a second line,
  // and this screen is the only surface in the app that has ever drawn a
  // price — so it is a switch rather than a deletion, and the switch is
  // off. The tests that used to read the price now turn it on, because
  // what they pin is the rendering, which has to keep working for the
  // release that brings it back.
  it('draws no price at all as it ships', () => {
    show();
    expect(screen.queryByText(/person|Free/)).toBeNull();
    expect(document.querySelector('[data-icon="pricetag-outline"]')).toBeNull();
  });

  it('draws a paid price per person once the switch is on', () => {
    state.price = true;
    show();
    expect(screen.getByText('~45k ₫ / person')).toBeTruthy();
    expect(document.querySelector('[data-icon="pricetag-outline"]')).toBeTruthy();
  });

  it('shows FREE as its own pill, without a price tag glyph', () => {
    state.price = true;
    show(place({ price_vnd: 0 }));
    expect(screen.getByText('Free')).toBeTruthy();
    expect(document.querySelector('[data-icon="pricetag-outline"]')).toBeNull();
  });

  it('shows no price at all when none is known, switch or no switch', () => {
    state.price = true;
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

// ── the outside links ──
//
// Three rows that all had the same fault: they showed a machine's version
// of an address. The website row trimmed the scheme and the `www.` and left
// everything else, so 70 of the catalog's 413 websites ran off the end of
// the row mid-tracking-parameter; and the two accounts a venue actually
// posts from were not drawn at all, though 166 of them have been sitting in
// `threads_handle` since September.

// ── a long address ──
//
// Of the 648 published places, 254 fit on one line beside the Directions
// button and 606 fit in two. Forty-two do not, and those forty-two are the
// whole of this: a card that grows to five lines for one address in
// fifteen costs the other fourteen the opening hours.
//
// `onTextLayout` never fires in jsdom, which lays nothing out, so the
// screen's own handler is called with the line count a phone would have
// reported. What that pins is the arithmetic around the measurement, not
// the measurement.

describe('PlaceDetailScreen — an address too long for the card', () => {
  const addressProps = () => propsWhere((p) => p.testID === 'detail-address') as
    unknown as { numberOfLines?: number; onTextLayout: (e: unknown) => void };
  const measure = (lines: number) => act(() => {
    addressProps().onTextLayout({ nativeEvent: { lines: Array.from({ length: lines }) } });
  });

  // The first paint runs unclamped on purpose. `onTextLayout` reports the
  // lines it actually drew, so a Text already limited to two could only
  // ever report two and could never say whether there was a third.
  it('measures before it clamps', () => {
    show();
    expect(addressProps().numberOfLines).toBeUndefined();
  });

  it('holds a long address to two lines once it knows', () => {
    show();
    measure(4);
    expect(addressProps().numberOfLines).toBe(2);
  });

  it('leaves a short one alone', () => {
    show();
    measure(1);
    expect(addressProps().numberOfLines).toBe(2);
    expect(screen.queryByTestId('detail-address-toggle')!.getAttribute('role')).toBeNull();
  });

  // Read off the props, like `hoursState` does: react-native-web drops
  // `accessibilityState` on a plain View rather than turning it into
  // `aria-expanded`, so an assertion on the DOM would pass vacuously.
  const expanded = () => (propsWhere((p) => p.testID === 'detail-address-toggle')
    .accessibilityState as unknown as { expanded?: boolean } | undefined)?.expanded;

  it('opens on a tap and closes on the next', () => {
    show();
    measure(4);
    expect(expanded()).toBe(false);

    fireEvent.click(screen.getByTestId('detail-address-toggle'));
    expect(addressProps().numberOfLines).toBeUndefined();
    expect(expanded()).toBe(true);

    fireEvent.click(screen.getByTestId('detail-address-toggle'));
    expect(addressProps().numberOfLines).toBe(2);
    expect(expanded()).toBe(false);
  });

  // A control that does nothing is worse than no control: VoiceOver would
  // announce a button on three cards in five and open nothing.
  it('is not a control at all when there is nothing to open', () => {
    show();
    measure(2);
    expect(screen.getByTestId('detail-address-toggle').getAttribute('role')).toBeNull();
    expect(expanded()).toBeUndefined();
  });

  // The button is the row's other half, and a row that grows must not take
  // it along: a target that moves under the thumb between the look and the
  // tap is the oldest bug in a list.
  it('leaves the Directions button exactly where it was', () => {
    show();
    measure(4);
    const before = getComputedStyle(screen.getByTestId('detail-directions').parentElement!);
    const box = { top: before.marginTop, shrink: before.flexShrink };

    fireEvent.click(screen.getByTestId('detail-address-toggle'));
    const after = getComputedStyle(screen.getByTestId('detail-directions').parentElement!);
    expect({ top: after.marginTop, shrink: after.flexShrink }).toEqual(box);
  });
});

describe('PlaceDetailScreen — website, Instagram and Threads', () => {
  it('shows a website as its domain, not as its URL', () => {
    show(place({
      website: 'https://anticofornaio.com/?utm_source=google&utm_medium=organic&utm_campaign=mapera',
    }));
    expect(screen.getByTestId('detail-website').textContent).toBe('anticofornaio.com');
  });

  // The label is short; the destination is not. A stripped URL may 404,
  // and what the venue handed out is what the tap has to carry.
  it('still opens the whole URL it was given', () => {
    show(place({ website: 'https://anticofornaio.com/menu?utm_source=google' }));
    fireEvent.click(screen.getByRole('button', { name: /Website/ }));
    expect(openURL).toHaveBeenCalledWith('https://anticofornaio.com/menu?utm_source=google');
  });

  it('draws a handle with its @ back on, and opens the account', () => {
    show(place({ instagram_handle: 'cab.cafesg', threads_handle: 'sweet.as.hanoi' }));
    expect(screen.getByTestId('detail-instagram').textContent).toBe('@cab.cafesg');
    expect(screen.getByTestId('detail-threads').textContent).toBe('@sweet.as.hanoi');

    fireEvent.click(screen.getByRole('button', { name: /Instagram/ }));
    expect(openURL).toHaveBeenCalledWith('https://www.instagram.com/cab.cafesg');
    fireEvent.click(screen.getByRole('button', { name: /Threads/ }));
    expect(openURL).toHaveBeenCalledWith('https://www.threads.com/@sweet.as.hanoi');
  });

  // Ionicons' own monochrome marks, not the brands' full-colour ones. Two
  // saturated logos in a grey gutter pull the eye off the words, and that
  // column is the point of the card.
  it('uses the icon font\'s own logos rather than the brands\' artwork', () => {
    show(place({ instagram_handle: 'cab.cafesg', threads_handle: 'cab.cafesg' }));
    expect(document.querySelector('[data-icon="logo-instagram"]')).toBeTruthy();
    expect(document.querySelector('[data-icon="logo-threads"]')).toBeTruthy();
  });

  it('draws no handle row for a place that has none', () => {
    show();
    expect(screen.queryByTestId('detail-instagram')).toBeNull();
    expect(screen.queryByTestId('detail-threads')).toBeNull();
  });

  // Forty-seven of the catalog's websites are Instagram profile URLs. With
  // the handle drawn above, the website row would be the same account said
  // twice — once as a name and once as a URL.
  it('drops a website that only repeats the handle above it', () => {
    show(place({
      website: 'https://www.instagram.com/cab.cafesg?igsh=MXJod3k3',
      instagram_handle: 'cab.cafesg',
    }));
    expect(screen.getByTestId('detail-instagram')).toBeTruthy();
    expect(screen.queryByTestId('detail-website')).toBeNull();
  });

  // But only when there is a handle to repeat: on a place nobody has looked
  // up, that URL is the one way to reach the venue.
  it('keeps a profile URL when no handle has been recorded', () => {
    show(place({ website: 'https://www.instagram.com/someone' }));
    expect(screen.getByTestId('detail-website').textContent).toBe('instagram.com');
  });

  // A Facebook page has no column and no row, so the website row carries it.
  it('keeps a Facebook page in the website row', () => {
    show(place({
      website: 'https://www.facebook.com/people/magichastand/61567169829674/?mibextid=wwXIfr',
      instagram_handle: 'magicha.zenbar',
    }));
    expect(screen.getByTestId('detail-website').textContent).toBe('facebook.com');
  });

  // The card opens on whichever row a place actually has, and the hairline
  // rule follows it: the first row draws none above itself.
  it('lets a handle open the card when there is nothing above it', () => {
    show(place({
      address: null, opening_hours: [], phone: null, website: null,
      instagram_handle: 'cab.cafesg',
    }));
    expect(screen.getByTestId('detail-instagram')).toBeTruthy();
  });
});

describe('PlaceDetailScreen — the map', () => {
  const map = () => document.querySelector('[data-stub="MiniMap"]') as HTMLElement | null;

  it('draws the place on a map', () => {
    show();
    expect(map()).toBeTruthy();
  });

  // The same picture the place wears on Explore's map. Google's default
  // teardrop said only "a place", on a screen already about one place,
  // while the chips two rows above it said Focus and Cafés.
  it('draws the pin in the place\u2019s own category, like the places map', () => {
    show(place({ categories: ['cafes'] }));
    expect(map()!.getAttribute('data-pin'))
      .toBe(String(pinImage({ categories: ['cafes'] }, null, false)));
  });

  // Different category, different picture — which is the whole claim, and
  // an assertion against `pinImage` alone would pass on a constant.
  it('gives a different category a different pin', () => {
    show(place({ categories: ['nightlife'] }));
    const nightlife = map()!.getAttribute('data-pin');
    cleanup();
    show(place({ categories: ['cafes'] }));
    expect(map()!.getAttribute('data-pin')).not.toBe(nightlife);
  });

  // Plain, not the coral `chosen` art: that variant exists to win a fight
  // with 250 other pins and there is no fight on a page about one place.
  // Plain is also the variant that keeps the category's own colour as the
  // fill, which is the thing being said.
  it('uses the plain pin, not the chosen one', () => {
    show(place({ categories: ['cafes'] }));
    expect(map()!.getAttribute('data-pin'))
      .not.toBe(String(pinImage({ categories: ['cafes'] }, null, true)));
  });

  // ── where the Directions button stands ──
  //
  // On the picture, so the address gets the whole width back. The button
  // measures 104.7pt of the 318.7pt the address could otherwise have — a
  // third of the row. Beside it 332–415 of 671 addresses fit on one line;
  // without it 582–613, and the 6–16 that needed a third line stop being
  // clamped. Measured off a real render at 3x.
  it('puts the Directions button on the map, not in the address row', () => {
    show();
    const go = screen.getByTestId('detail-directions');
    expect(go.parentElement).toBe(map()!.parentElement);
    expect(screen.getByTestId('detail-address-toggle').contains(go)).toBe(false);
  });

  // The labelled pill was 104.7pt wide and laid that much of a 320pt map
  // under itself, over a picture whose whole job is street names. The
  // name survives for VoiceOver; what goes is the ink on the tiles.
  it('carries no word on the map, only the arrow and its name', () => {
    show();
    const go = screen.getByTestId('detail-directions');
    expect(go.textContent).toBe('');
    expect(go.getAttribute('aria-label')).toBe('Directions');
    expect(go.querySelector('[data-icon="navigate"]')).toBeTruthy();
  });

  it('holds the button clear of Google\u2019s attribution in the far corner', () => {
    show();
    const box = getComputedStyle(screen.getByTestId('detail-directions'));
    expect(box.position).toBe('absolute');
    // Bottom right, and that corner is a constraint rather than a taste:
    // Google's terms require their attribution stay visible, and the logo
    // sits bottom left — 60 x 29pt, on a map 150pt tall.
    expect(box.right).toBe('10px');
    expect(box.bottom).toBe('10px');
    expect(box.left).toBe('');
  });

  // The regression this must never have. A binary with no Google Maps SDK
  // — Expo Go on iOS, or a build made without the key — draws no map, and
  // the one action this card exists for cannot vanish with it.
  it('falls back into the address row when the binary cannot draw a map', () => {
    mapStub.canDraw = false;
    show();
    expect(map()).toBeNull();
    const go = screen.getByTestId('detail-directions');
    expect(getComputedStyle(go).position).not.toBe('absolute');
    fireEvent.click(go);
    expect(openURL).toHaveBeenCalled();
  });

  // And in that fallback the row finally has a gap. It never had one: the
  // address is `flex: 1` and the button `flexShrink: 0`, so with nothing
  // between them the words ran to the pill's edge — measured at 5.0pt on a
  // real render, and five was only where that line happened to break.
  it('keeps the fallback button off the address text', () => {
    mapStub.canDraw = false;
    show();
    expect(getComputedStyle(screen.getByTestId('detail-directions')).marginLeft).toBe('12px');
  });

  // It used to be a card of its own below the facts, which asked the
  // reader to bind "where" to two separate objects — the words in one box,
  // the picture in another. Inside the card it is the address's own
  // illustration, and the proof of that is what it sits between.
  // The third thing in the address's column, under the label and the
  // street. Full-bleed was tried — it is what the reference does — and it
  // broke that column: the picture reached left past every other thing in
  // the card and the grid stopped being a grid.
  it('starts where the words start, not at the card\u2019s edge', () => {
    show();
    expect(getComputedStyle(map()!.parentElement!).marginLeft).toBe('33px');
  });

  it('sits inside the info card, under the address and above the hours', () => {
    show();
    const all = [...document.querySelectorAll('*')];
    const at = (el: Element | null) => all.indexOf(el as Element);
    expect(at(screen.getByTestId('detail-address'))).toBeLessThan(at(map()));
    expect(at(map())).toBeLessThan(at(screen.getByText('Hours')));
  });

  // A live map inside a vertical scroll is a hole the page cannot be
  // scrolled through: the native view takes the drag and the thumb stops
  // working over a third of the screen.
  it('freezes it, so the page can still be scrolled over it', () => {
    show();
    expect(map()?.dataset.interactive).toBe('false');
  });

  // The only thing this view can usefully do. Routing, street view and
  // the rest are Maps' job, and the tap is the whole handoff.
  it('hands off to Maps when tapped', () => {
    show();
    fireEvent.click(map()!);
    expect(openURL).toHaveBeenCalledWith(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('Cộng Cà Phê - Old Quarter')}&query_place_id=gp1`,
    );
  });

  it('draws none at all for a place with no coordinates', () => {
    show(place({ lat: null, lng: null }));
    expect(map()).toBeNull();
  });
});

describe('PlaceDetailScreen — info card', () => {
  // The glyph in the gutter is what lets the eye find the phone number
  // without reading the labels. Said in the tree as well as drawn, since
  // an icon nobody can name is decoration.
  it('names each fact with a glyph of its own', () => {
    show();
    const icons = [...document.querySelectorAll('[data-icon]')].map((n) => (n as HTMLElement).dataset.icon);
    expect(icons).toEqual(expect.arrayContaining([
      'location-outline', 'time-outline', 'call-outline', 'globe-outline',
    ]));
  });

  // The row is no longer the button; the button is. Tapping an address has
  // always opened Maps and nothing on the row said so — an address looks
  // like a fact, not a control — so the handoff has a named target now and
  // the row itself is text again.
  it('shortens the address and opens Google Maps on the exact place', () => {
    show();
    const addr = screen.getByTestId('detail-address');
    // Country and the city this app is already about are dropped.
    expect(addr.textContent).toBe('152 Trieu Viet Vuong, Hai Ba Trung');
    fireEvent.click(screen.getByTestId('detail-directions'));
    expect(openURL).toHaveBeenCalledWith(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('Cộng Cà Phê - Old Quarter')}&query_place_id=gp1`,
    );
  });

  it('names that button for VoiceOver', () => {
    show();
    expect(screen.getByRole('button', { name: 'Directions' })).toBeTruthy();
  });

  it('opens Maps on the coordinate when the place has no Google id', () => {
    show(place({ google_place_id: null }));
    fireEvent.click(screen.getByTestId('detail-directions'));
    expect(openURL).toHaveBeenCalledWith(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('21.01,105.85')}`,
    );
  });

  it('leaves the address as plain text when the place cannot be put on a map', () => {
    show(place({ lat: null, lng: null }));
    expect(screen.getByTestId('detail-address')).toBeTruthy();
    expect(screen.queryByTestId('detail-directions')).toBeNull();
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

  // Named by their accessible name now rather than by their label, because
  // Address is the one row whose control is a button beside the words
  // rather than the words themselves.
  it.each([
    ['Directions', 'Could not open Maps'],
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

  // The closed line used to be `textTertiary` — the colour of the label
  // above it — so the one fact a reader opens this screen at ten at night
  // to find read as furniture, and measured 3.41:1 on the dark card, under
  // the 4.5 small text needs. It takes the sash's own brick now: the red a
  // reader already met on the diagonal across the closed card they tapped.
  //
  // Not the accent, which is this app's voice for "this is the thing" and
  // is on every link in this very card. The assertion is that the two are
  // different, because a near-miss of the accent would be worse than the
  // grey was.
  it('gives the closed line its own red, and not the accent', () => {
    show(place({ opening_hours: week('5:00 PM – 11:00 PM') }));
    const shut = getComputedStyle(screen.getByText('Closed · opens 17:00'));
    const rgb = (hex: string) => {
      const n = parseInt(String(hex).slice(1), 16);
      return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
    };
    expect(shut.color).toBe(rgb(colors.shutInk as string));
    expect(shut.color).not.toBe(rgb(colors.accent as string));
    expect(shut.color).not.toBe(rgb(colors.textTertiary as string));
  });

  it('leaves an open place its green', () => {
    show();
    const open = getComputedStyle(screen.getByText(/^Open now/));
    expect(open.color).not.toBe(getComputedStyle(screen.getByText('Hours')).color);
  });

  it('says closed today when it does not open again today', () => {
    show(place({ opening_hours: week('Closed') }));
    expect(screen.getByText('Closed today')).toBeTruthy();
  });

  // Shut, and — since `openState` looks a day ahead — told when it opens:
  // tomorrow's seven o'clock is the hour that matters at half past eleven.
  it('reads the place\'s clock, not the device\'s: 23:30 in Hanoi is closed, until 07:00', () => {
    vi.setSystemTime(new Date('2026-09-09T16:30:00Z'));
    show();
    expect(screen.getByText('Closed · opens 07:00')).toBeTruthy();
    expect(screen.queryByText('Closed today')).toBeNull();
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

// The one control this screen offers the person who put the place here.
// Its rules live in `LocalGuidePanel` and are tested there; what this
// pins is that the screen mounts it at all — the JSX could be deleted and
// every component test would still pass.
describe('the local guide’s panel', () => {
  it('is not on the screen for an ordinary reader', () => {
    show(place({ submitted_by: 'u1' }));
    expect(screen.queryByTestId('guide-panel')).toBeNull();
  });

  it('is there for a granted guide looking at a place they imported', () => {
    state.uid = 'u1';
    state.guide = true;
    show(place({ submitted_by: 'u1' }));
    expect(screen.getByTestId('guide-panel')).toBeTruthy();
  });

  // The grant is not a key to the catalog.
  it('is absent on somebody else’s place, grant or no grant', () => {
    state.uid = 'u1';
    state.guide = true;
    show(place({ submitted_by: 'u2' }));
    expect(screen.queryByTestId('guide-panel')).toBeNull();
  });

  // The panel's button asks; the screen answers with the route. Pinned
  // here because the panel cannot navigate on its own, and a door that
  // opens onto nothing is the fault this catches.
  it('opens the gallery for this place', () => {
    state.uid = 'u1';
    state.guide = true;
    const n = show(place({ submitted_by: 'u1' }));
    fireEvent.click(screen.getByTestId('guide-open-gallery'));
    expect(n.navigate).toHaveBeenCalledWith('Gallery', { slug: 'cong-caphe' });
  });
});

// The info card's left column, which two bugs had quietly pulled apart.
//
// Neither was visible in the markup. The gutter constant said "Glyph 19,
// air 14" and the style that read it was `GUTTER - 14` — the glyph alone,
// so the air never existed and each label sat against its icon at whatever
// that glyph's own side bearing happened to be (4.0pt after the pin, 2.7
// after the clock, 2.4 after the handset, measured on the phone). And the
// hairline between rows carried `marginLeft` on the box that *held* the
// row, so every row after the first was pushed 33pt right — icon, label
// and value together — while the first row sat at the card's padding.
//
// Both are geometry, which `react-native-web` does put on the host element,
// so both can be asserted rather than looked at.
describe('the info card’s gutter', () => {
  const styleOf = (el: Element | null) => getComputedStyle(el as Element);
  /**
   * The `infoStack` a value sits in — the element whose own first child
   * holds the glyph.
   *
   * Climbed rather than counted, because the address's value is one level
   * deeper than the others: it is wrapped in the control that expands it,
   * and the next row to gain one would have broken a fixed count
   * silently.
   */
  const rowOf = (el: Element): HTMLElement => {
    let n = el.parentElement;
    while (n && !n.querySelector(':scope > div > [data-icon]')) n = n.parentElement;
    return n as HTMLElement;
  };

  it('gives the glyph the whole gutter, so the words start where the lines do', () => {
    show(place({ address: '27 Huỳnh Thúc Kháng' }));
    const value = screen.getByTestId('detail-address');
    expect(styleOf(rowOf(value).firstElementChild).width).toBe('33px');
  });

  // ── where the glyph sits down the row ──
  //
  // Level with the label, which makes the row a two-column grid and says
  // so: glyph beside the name of the thing, the thing itself beneath.
  //
  // Position and room are two numbers, and the version that shipped
  // conflated them: it gave the glyph a box of 15 — the label's line — and
  // a 19pt glyph laid out inside a 15pt height is cut off at the bottom,
  // which is what reached the phone. The box is 26 now, big enough for any
  // 19pt line, and the position is carried by the margin.
  //
  // Both halves are asserted together on purpose. Either one alone is
  // satisfied by the bug: a 15pt box is in the right place and clips, a
  // 26pt box with no lift is whole and sits too low.
  it('gives the glyph room, and puts its middle on the label\u2019s', () => {
    show(place({ address: '27 Huỳnh Thúc Kháng' }));
    const slot = styleOf(rowOf(screen.getByTestId('detail-address')).firstElementChild);
    const h = parseFloat(slot.height);
    const top = parseFloat(slot.marginTop);
    // Room: taller than the 19pt glyph it holds, by enough for its line.
    expect(h).toBeGreaterThan(19);
    // Place: the box's middle is the label's middle, 15 / 2.
    expect(top + h / 2).toBeCloseTo(7.5, 5);
    expect(slot.justifyContent).toBe('center');
  });

  // The address the app actually holds, rather than the short one above.
  // Ninety-eight places in a hundred take a second line, and measuring the
  // box from the whole row would make the glyph's position a property of
  // how long an address happens to be.
  it('leaves the glyph where it is when the address wraps', () => {
    show(place({ address: '27/16 Ngõ 18 Huỳnh Thúc Kháng, Giảng Võ, Ba Đình, Hà Nội' }));
    const slot = styleOf(rowOf(screen.getByTestId('detail-address')).firstElementChild);
    expect(parseFloat(slot.marginTop) + parseFloat(slot.height) / 2).toBeCloseTo(7.5, 5);
  });

  // The box above is only honest while the lines it names are the lines
  // the text actually draws. Left to the platform, a 12pt label is 14.3pt
  // on iOS and something else on the next OS, and the glyph drifts off
  // centre with nothing in the diff to show why.
  //
  // Read off the injected rule rather than `getComputedStyle`, which
  // answers `normal` for `line-height` in this jsdom however plainly
  // react-native-web declares it. The class is on the element and the
  // rule is in the document; the cascade between them is the part that
  // is missing, so the test steps over it.
  const lineHeightOf = (el: Element | null) => {
    const classes = new Set((el as Element).className.split(/\s+/));
    const rules = [...document.styleSheets].flatMap((sheet) => {
      try { return [...sheet.cssRules]; } catch { return []; }
    });
    for (const rule of rules) {
      const css = (rule as CSSStyleRule).selectorText ?? '';
      const px = classes.has(css.slice(1)) && /line-height:\s*([^;}]+)/.exec(rule.cssText);
      if (px) return px[1].trim();
    }
    return null;
  };

  it('states the line heights the glyph’s box is measured from', () => {
    show(place({ address: '27 Huỳnh Thúc Kháng' }));
    const value = screen.getByTestId('detail-address');
    // The label is the first thing in the words column; the value is now
    // one deeper than that, inside the control that expands it.
    const label = rowOf(value).querySelector(':scope > div:nth-child(2) > *');
    expect(lineHeightOf(label)).toBe('15px');
    expect(styleOf(label).marginBottom).toBe('5px');
    expect(lineHeightOf(value)).toBe('24px');
    // The label's 15 is the number the glyph's position is measured from:
    // its box is centred on half of it.
    const slot = styleOf(rowOf(value).firstElementChild);
    expect(parseFloat(slot.marginTop) + parseFloat(slot.height) / 2).toBeCloseTo(7.5, 5);
  });

  // Both ends of the row are level. This replaces a test that asserted the
  // opposite on the argument that a control lives with the thing it acts
  // on — which reads well and is not what the reference does: its trailing
  // glyph sits within 2pt of its leading one on every row measured.
  it('keeps both ends of the hours row level', () => {
    show(place({ address: '27 Huỳnh Thúc Kháng' }));
    const row = screen.getByRole('button', { name: /^Hours/ });
    for (const end of [row.firstElementChild, row.lastElementChild]) {
      const css = styleOf(end);
      expect(parseFloat(css.height)).toBeGreaterThan(19);
      expect(parseFloat(css.marginTop) + parseFloat(css.height) / 2).toBeCloseTo(7.5, 5);
      expect(css.justifyContent).toBe('center');
    }
  });

  // A line has nothing inside it to drag along. Written as a border on the
  // wrapper, this inset moved the row; written as its own element, it
  // moves only itself.
  //
  // Found by height as well as inset, because the gutter's inset is not
  // the hairline's alone any more: the map is indented to the same column
  // and it very much does have something inside it.
  it('draws each hairline as its own element, not as a border on a row', () => {
    show(place({ address: '27 Huỳnh Thúc Kháng', phone: '+84 799 986 201' }));
    const hairlines = [...document.querySelectorAll('div')].filter((el) => {
      const css = styleOf(el);
      return css.marginLeft === '33px' && parseFloat(css.height) <= 1;
    });
    expect(hairlines.length).toBeGreaterThan(0);
    for (const el of hairlines) {
      expect(el.children.length, 'a hairline that holds a row indents it').toBe(0);
    }
  });
});

// ── the identity block ──
//
// Name, rating and category answer one question between them — what is
// this place — and they should be read without being interrupted. The
// offer to add a photo is a different kind of thing: it is addressed to
// one reader by name and asks them for something. It sat between the
// rating and the pills, which is the middle of a sentence.
describe('PlaceDetailScreen — what is this place, said without interruption', () => {
  const order = (id: string) => {
    const nodes = [...document.querySelectorAll('[data-testid]')];
    return nodes.findIndex((n) => n.getAttribute('data-testid') === id);
  };

  // Name, pills and "why go" are one argument about the place, made to
  // everybody; the panel is a request made to one reader by name. The
  // argument finishes before the favour is asked, and the facts begin
  // after. The panel used to sit between the pills and the reason to go,
  // which cut the argument in half.
  it('asks for a photo only after the case for the place has been made', () => {
    // The panel only draws for the reader it is addressed to, which is
    // exactly the reader this ordering matters for.
    state.uid = 'u1';
    state.guide = true;
    show(place({ rating: 4.1, rating_count: 604, categories: ['cafes', 'eats'], submitted_by: 'u1' }));
    expect(order('detail-rating')).toBeLessThan(order('detail-facts'));
    expect(order('detail-facts')).toBeLessThan(order('detail-why'));
    expect(order('detail-why')).toBeLessThan(order('guide-panel'));
    expect(order('guide-panel')).toBeLessThan(order('detail-address'));
  });

  // A quotation mark, not a speech bubble: a bubble is what somebody else
  // said, and this is the desk's own sentence about the place.
  it('marks the desk\u2019s words with a quote rather than a speech bubble', () => {
    show();
    const why = screen.getByTestId('detail-why');
    expect(why.textContent).toContain('\u201C');
    expect(why.querySelector('[data-icon="chatbox-ellipses"]')).toBeNull();
  });

  // The desk writes these, and they have a voice — "exactly what some
  // nights need" is a person, not a summary. Saying so out loud is the
  // difference between a paragraph a reader skims and a reason they act
  // on. No chevron: there is nowhere further to go, and an arrow that
  // leads nowhere is a promise the screen cannot keep.
  it('says what the description is for, and does not pretend it leads somewhere', () => {
    show(place({ desc_en: 'Brunch and counter food under the arches.' }));
    expect(screen.getByTestId('detail-why')).toBeTruthy();
    expect(screen.getByText('Why go?')).toBeTruthy();
    expect(screen.getByText('Brunch and counter food under the arches.')).toBeTruthy();
    expect(screen.queryByTestId('detail-why-chevron')).toBeNull();
  });

  it('draws no heading where the desk has written nothing', () => {
    show(place({ desc_en: null, desc_vi: null, desc_ja: null }));
    expect(screen.queryByTestId('detail-why')).toBeNull();
  });
});
