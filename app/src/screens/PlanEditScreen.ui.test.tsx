// @vitest-environment jsdom
//
// The editor between "I like this plan" and a row in `trips`. What is
// pinned here is the part a reader cannot see going wrong: that the stops
// saved are the stops on screen, in the order on screen, at the times on
// screen; that a model's sentence is only saved while the stop it was
// written about is still in the plan; that the evening's start survives a
// reorder; and that Save leaves the flow rather than leaving a live editor
// behind to insert a duplicate on the next visit.
//
// The planner and the narration cache are the seams: `planTrips` is stubbed
// so the plan is fixed, and `cachedNarration` / `prefetchNarration` stand in
// for the words the options screen would have fetched. `lib/itinerary` is
// the real one, because what an arrow press does to the other stops is the
// behaviour under test, not a detail to be mocked away.

import { appFlags } from '../lib/flags';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PanResponder, type PanResponderCallbacks } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '../uitest/render';
import { todayISO } from '../lib/day';
import { derivedTitle, type Narration } from '../lib/assist';
import { fmtDistance } from '../lib/geo';
import { legsOfPlan } from '../lib/itinerary';
import type { Place } from '../lib/types';
import type { Nav, RootRoute } from '../nav';

const saveTrip = vi.hoisted(() => vi.fn(async (_trip: unknown) => 'trip-1'));
const planTrips = vi.hoisted(() => vi.fn());
const cachedNarration = vi.hoisted(() => vi.fn());
const prefetchNarration = vi.hoisted(() => vi.fn());
const scheduleTripReminder = vi.hoisted(() => vi.fn(async () => {}));
const note = vi.hoisted(() => vi.fn());
const alert = vi.hoisted(() => vi.fn());
const auth = vi.hoisted(() => ({
  current: { session: { user: { id: 'u1' } } as { user: { id: string } } | null, profile: { avatar_url: null } },
}));
const cityState = vi.hoisted(() => ({ current: { city: { id: 'hanoi' } as { id: string; tz?: string } | null } }));
const mine = vi.hoisted(() => ({ current: [] as unknown[] }));

// `Alert` from react-native-web is a silent no-op, so what the reader was
// told has to be caught at the import the screen actually uses.
vi.mock('react-native', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  Alert: { alert },
}));
vi.mock('../lib/auth', () => ({ useAuth: () => auth.current }));
vi.mock('../lib/city', () => ({ useCity: () => cityState.current }));
vi.mock('../lib/i18n', () => ({
  useI18n: () => ({ lang: 'en', setLang: () => {}, t: (en: string) => en }),
}));
vi.mock('../lib/catalog', () => ({ usePlaces: () => ({ data: PLACES }) }));
const askToSignIn = vi.hoisted(() => vi.fn());
vi.mock('../lib/save', () => ({ useSave: () => ({ mine: { data: mine.current, reload: vi.fn() }, askToSignIn }) }));
vi.mock('../lib/tasteProfile', () => ({
  useNoteEvent: () => note,
  usePlanProfile: () => ({ taste: null, budgetVnd: 400000 }),
}));
vi.mock('../lib/planner', () => ({ planTrips }));
vi.mock('../lib/reminders', () => ({ scheduleTripReminder }));
vi.mock('../lib/assist', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  cachedNarration,
  prefetchNarration,
}));
vi.mock('../lib/data', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  saveTrip,
}));

import PlanEditScreen from './PlanEditScreen';

// The list's drag responder, as `useListDrag` made it: the real one, with
// its callbacks kept so a test can play the touch system's side.
const responder = vi.hoisted(() => ({ config: null as null | PanResponderCallbacks }));
const realCreate = PanResponder.create.bind(PanResponder);
vi.spyOn(PanResponder, 'create').mockImplementation((config) => {
  responder.config = config;
  return realCreate(config);
});

const place = (slug: string, name: string, extra: Partial<Place>): Place => ({
  slug, name_en: name, name_vi: name, name_ja: null, category: 'food', is_featured: false,
  vibe_tags: [], neighborhood_en: 'Hoàn Kiếm', neighborhood_vi: null, neighborhood_ja: null,
  address: null, lat: null, lng: null, place_photos: [], ...extra,
} as Place);

const photo = (uri: string, sort_order = 0) => ({
  id: uri, photo_uri: uri, is_cover: sort_order === 0, is_hidden: false, sort_order, attribution_name: null,
});

// Café and dinner a short walk apart; the rooftop across town, so the last
// leg is a ride and costs a fare.
const CAFE = place('cafe', 'Cộng Café', {
  categories: ['cafes'], lat: 21.0285, lng: 105.8542, price_vnd: 50000, rating: 4.6,
  place_photos: [photo('https://img/cafe-1.jpg'), photo('https://img/cafe-2.jpg', 1)],
} as Partial<Place>);
const DINNER = place('dinner', 'Bún Chả Hương Liên', { categories: ['eats'], lat: 21.0300, lng: 105.8560, price_vnd: 200000 } as Partial<Place>);
const ROOF = place('roof', 'Sky Bar', { categories: ['views'], lat: 21.0700, lng: 105.8200 } as Partial<Place>);
const PINNED = place('pinned', 'Collection Pick', {});
const PLACES = [CAFE, DINNER, ROOF, PINNED];

const stop = (p: Place, arriveMin: number, dwellMin: number) => ({ place: p, arriveMin, dwellMin });
const plan = (lens: string, stops: ReturnType<typeof stop>[]) => ({
  lens, title: null, stops, legs: [], costVnd: { food: 0, activity: 0, transport: 0 },
  windowMin: [0, 0], pinnedDropped: [],
});
const EVENING = plan('classic', [stop(CAFE, 18 * 60, 60), stop(DINNER, 19 * 60 + 15, 90), stop(ROOF, 21 * 60, 60)]);

const words = (over: Partial<Narration> = {}): Narration => ({
  title: 'Coffee, noodles, skyline',
  why: new Map([['cafe', 'An easy first stop before the crowds.']]),
  fromModel: true,
  ...over,
});

type BeforeRemove = (e: { preventDefault: () => void; data: { action: unknown } }) => void;
type TestNav = Nav & {
  parent: { navigate: ReturnType<typeof vi.fn> };
  dispatch: ReturnType<typeof vi.fn>;
  /** What a real navigator does before the screen goes: ask every
   *  `beforeRemove` listener. True when one of them held the screen. */
  leave: () => boolean;
};
const nav = (): TestNav => {
  const parent = { navigate: vi.fn() };
  const listeners = new Set<BeforeRemove>();
  const action = { type: 'GO_BACK' };
  return {
    navigate: vi.fn(), goBack: vi.fn(), popToTop: vi.fn(), getParent: vi.fn(() => parent), parent,
    dispatch: vi.fn(),
    addListener: vi.fn((name: string, fn: BeforeRemove) => {
      if (name !== 'beforeRemove') return () => {};
      listeners.add(fn);
      return () => { listeners.delete(fn); };
    }),
    leave: () => {
      let held = false;
      for (const fn of [...listeners]) fn({ preventDefault: () => { held = true; }, data: { action } });
      return held;
    },
  } as unknown as TestNav;
};

const routeWith = (over: object = {}) => ({
  params: {
    company: 'friends', categories: ['cafes'], where: 'Old Quarter', district: 'hoan-kiem',
    date: todayISO(), when: 'evening', startMin: 18 * 60, seed: 7, lens: 'classic',
    title: 'An evening in the Old Quarter', ...over,
  },
}) as unknown as RootRoute<'PlanEdit'>;

const renderScreen = (over: object = {}, navigation = nav()) => {
  render(<PlanEditScreen navigation={navigation} route={routeWith(over)} />);
  return navigation;
};

const names = () => Array.from(document.querySelectorAll('[aria-label^="Open "]'))
  .map((el) => el.getAttribute('aria-label')!.slice('Open '.length));
/** Row `i`'s control, by the name VoiceOver reads for it — so the names
 *  are pinned too. Keyed by glyph to keep the tests reading as the rail
 *  looks. */
const control: Record<string, (name: string) => string> = {
  remove: (n) => `Arrive 15 min earlier at ${n}`,
  add: (n) => `Arrive 15 min later at ${n}`,
  close: (n) => `Remove ${n}`,
};

/** Props of the first committed element matching `pick`. */
const propsWhere = (pick: (p: Record<string, unknown>) => boolean): Record<string, any> => {
  type Fiber = { child: Fiber | null; sibling: Fiber | null; memoizedProps: Record<string, unknown> | null };
  const host = document.body.firstElementChild as unknown as Record<string, { stateNode: { current: Fiber } }>;
  const key = Object.keys(host).find((k) => k.startsWith('__reactContainer'))!;
  const stack: Fiber[] = [host[key].stateNode.current];
  while (stack.length) {
    const f = stack.pop()!;
    const p = f.memoizedProps;
    if (p && typeof p === 'object' && pick(p)) return p;
    if (f.sibling) stack.push(f.sibling);
    if (f.child) stack.push(f.child);
  }
  throw new Error('no matching element in the committed tree');
};
/** Row `i`'s identity band — the pressable that opens the place and
 *  carries the hold and VoiceOver's actions. */
const band = (i: number) => {
  const name = names()[i];
  if (!name) throw new Error(`no row #${i}`);
  return propsWhere((p) => p.accessibilityLabel === `Open ${name}` && 'onLongPress' in p);
};
/** One step, the way VoiceOver takes it. */
const act11y = (i: number, actionName: string) => act(() => {
  band(i).onAccessibilityAction({ nativeEvent: { actionName } });
});
// Where the finger is when the card lifts; the drag is measured from here.
const Y0 = 480;
const cfg = () => responder.config!;
const evt = {} as never;
const at = (dy: number) => ({ moveY: Y0 + dy }) as never;
/** The hold completes on row `i`'s band. */
const lift = (i: number) => act(() => { band(i).onLongPress({ nativeEvent: { pageY: Y0 } }); });
/** The finger's first move: the list asks for the touch and, when it wants
 *  it, is granted it and the band is told it has lost it. */
const claim = (i: number) => {
  let wanted = false;
  act(() => {
    wanted = !!cfg().onMoveShouldSetPanResponderCapture!(evt, at(0));
    if (wanted) { cfg().onPanResponderGrant!(evt, at(0)); band(i).onPressOut(); }
  });
  return wanted;
};
const moveBy = (dy: number) => act(() => { cfg().onPanResponderMove!(evt, at(dy)); });
const drop = () => act(() => { cfg().onPanResponderRelease!(evt, at(0)); });
/** The row as React Native Web measures it, by hand: jsdom has no
 *  ResizeObserver, and the handler is left on the node for one. */
const measure = (slug: string, height: number) => act(() => {
  (screen.getByTestId(`drag-${slug}`) as unknown as { __reactLayoutHandler: (e: unknown) => void })
    .__reactLayoutHandler({ nativeEvent: { layout: { height } } });
});
const scroller = () => propsWhere((p) => 'scrollEnabled' in p && 'contentContainerStyle' in p);
const press = (glyph: string, i: number) => {
  const name = names()[i];
  if (!name) throw new Error(`no row #${i}`);
  fireEvent.click(screen.getByRole('button', { name: control[glyph](name) }));
};
const save = () => fireEvent.click(screen.getByRole('button', { name: /Save to Trips|Saving…/ }));
type Payload = { stops: { placeSlug: string; arriveMin: number; why: string | null; whyLang: string | null }[] } & Record<string, unknown>;
const payload = () => saveTrip.mock.calls[0][0] as Payload;

beforeEach(() => {
  appFlags.reset();
  vi.clearAllMocks();
  responder.config = null;
  saveTrip.mockImplementation(async () => 'trip-1');
  planTrips.mockImplementation(() => [EVENING]);
  cachedNarration.mockImplementation(() => words());
  prefetchNarration.mockImplementation(async () => words());
  auth.current = { session: { user: { id: 'u1' } }, profile: { avatar_url: null } };
  cityState.current = { city: { id: 'hanoi' } };
  mine.current = [];
});

describe('the plan as it arrives', () => {
  it('shows every stop, in order, with its time, dwell, rating and narration', () => {
    renderScreen();
    expect(names()).toEqual(['Cộng Café', 'Bún Chả Hương Liên', 'Sky Bar']);
    expect(screen.getByText('18:00')).toBeTruthy();
    expect(screen.getByText('19:15')).toBeTruthy();
    expect(screen.getByText('21:00')).toBeTruthy();
    expect(screen.getByText('Hoàn Kiếm · Eats · 90 min')).toBeTruthy();
    expect(screen.getByText('4.6')).toBeTruthy();
    expect(screen.getByText('An easy first stop before the crowds.')).toBeTruthy();
    // The model's name for the evening beats the lens name in the params.
    expect(screen.getByText('Coffee, noodles, skyline')).toBeTruthy();
    expect(screen.queryByText('An evening in the Old Quarter')).toBeNull();
    expect(screen.getByText(/Old Quarter/)).toBeTruthy();
  });

  // The name line is the brand; the ward after the catalog's dash opens
  // the line under it (`lib/name`). VoiceOver's label keeps the whole
  // name, which `names()` reads, so the two are pinned apart here.
  it('prints the brand alone on a stop, and the whole name to VoiceOver', () => {
    const branch = { ...ROOF, name_en: 'Sky Bar – Lotte Center' } as Place;
    planTrips.mockImplementation(() => [plan('classic', [stop(branch, 20 * 60, 60)])]);
    renderScreen();
    expect(screen.getByText('Sky Bar')).toBeTruthy();
    expect(screen.queryByText(/Lotte Center/)).toBeNull();
    expect(names()).toEqual(['Sky Bar – Lotte Center']);
  });

  // The evening's facts are chips under the title: the window, the
  // distance, the company, and — behind the price switch (#598) — the
  // spend. No stop count: the rail numbers the stops.
  it('chips the window, the distance by how the route is made, the company and the spend', () => {
    appFlags.set('place_price', true);
    renderScreen();
    expect(screen.getByText('18:00–22:00')).toBeTruthy();
    // The legs summed, as the options card sums them, and worn as a ride
    // because the last leg is one. Computed here from the same stops so
    // a screen that summed two of the three legs would be caught.
    const km = legsOfPlan(EVENING.stops.map((st) => ({ ...st, pinned: false })))
      .reduce((n, l) => n + (l?.km ?? 0), 0);
    expect(km).toBeGreaterThan(5);
    expect(screen.getByText(fmtDistance(km))).toBeTruthy();
    expect(screen.getByText('Friends')).toBeTruthy();
    // 50k + 200k in prices, plus one 15k ride out to the rooftop.
    expect(screen.getByText('~265k ₫ / person')).toBeTruthy();
    expect(screen.queryByText(/\d stops?/)).toBeNull();
    // One walk between the first two legs, one ride out to the rooftop,
    // and the ride again on the distance chip.
    expect(document.querySelectorAll('[data-icon="walk-outline"]')).toHaveLength(1);
    expect(document.querySelectorAll('[data-icon="car-outline"]')).toHaveLength(2);
    expect(screen.getAllByText(/≈ \d+ min/)).toHaveLength(2);
  });

  it('wears the distance as a walk when every leg is one', () => {
    planTrips.mockImplementation(() => [plan('classic', [stop(CAFE, 18 * 60, 60), stop(DINNER, 19 * 60 + 15, 90)])]);
    renderScreen();
    expect(document.querySelectorAll('[data-icon="walk-outline"]')).toHaveLength(2);
    expect(document.querySelectorAll('[data-icon="car-outline"]')).toHaveLength(0);
  });

  it('keeps the spend off the chips while the price switch is off', () => {
    renderScreen();
    expect(screen.getByText('18:00–22:00')).toBeTruthy();
    expect(screen.queryByText(/₫/)).toBeNull();
  });

  it('prints a spend of a million or more in millions', () => {
    appFlags.set('place_price', true);
    planTrips.mockImplementation(() => [plan('classic', [stop({ ...CAFE, price_vnd: 1_240_000 } as Place, 18 * 60, 60)])]);
    renderScreen();
    expect(screen.getByText('18:00–19:00')).toBeTruthy();
    expect(screen.getByText('~1.2M ₫ / person')).toBeTruthy();
  });

  it('leaves spend and distance out when nothing costs anything and nothing is travelled', () => {
    appFlags.set('place_price', true);
    planTrips.mockImplementation(() => [plan('classic', [stop(ROOF, 20 * 60, 60)])]);
    renderScreen();
    expect(screen.getByText('20:00–21:00')).toBeTruthy();
    expect(screen.queryByText(/₫/)).toBeNull();
    expect(screen.queryByText(/km$| m$/)).toBeNull();
  });

  // The stops down a numbered rail, each card wearing its place's own
  // photographs where it has any, and the picture opening the place the
  // way the name does.
  it('numbers the stops down the rail and opens a place from its picture', () => {
    const navigation = renderScreen();
    expect(screen.getByText('1')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
    // Only the café has photographs: one band, two pages, the count.
    expect(screen.getAllByTestId('stop-hero')).toHaveLength(1);
    expect(screen.getAllByTestId('hero-page')).toHaveLength(2);
    expect(screen.getByTestId('hero-dots').children).toHaveLength(2);
    fireEvent.click(screen.getAllByTestId('hero-page')[1]);
    expect(navigation.navigate).toHaveBeenCalledWith('PlaceDetail', { slug: 'cafe' });
  });

  it('opens the lens the reader tapped, not merely the first plan', () => {
    planTrips.mockImplementation(() => [EVENING, plan('chill', [stop(ROOF, 20 * 60, 60)])]);
    renderScreen({ lens: 'chill' });
    expect(names()).toEqual(['Sky Bar']);
  });

  it('rebuilds with the same inputs the options screen used, collection pins included', () => {
    mine.current = [
      { slug: 'weekend', members: [PINNED] },
      { slug: 'other', members: [ROOF] },
    ];
    renderScreen({ from: ['weekend'], avoid: ['old-bar'] });
    expect(planTrips).toHaveBeenCalledWith(
      expect.objectContaining({ categories: ['cafes'], when: 'evening', from: ['weekend'] }),
      PLACES,
      'hanoi',
      { seed: 7, startMin: 18 * 60, pinned: [PINNED], avoid: ['old-bar'], taste: null, budgetVnd: 400000, tz: 'Asia/Ho_Chi_Minh' },
    );
  });

  // The planner asks `openState` about seven on Saturday, and builds
  // that instant on the zone it is given — the city's, so a Melbourne
  // evening is not read on Vietnam's clock.
  it('asks the planner on the city’s clock', () => {
    cityState.current = { city: { id: 'melbourne', tz: 'Australia/Melbourne' } };
    renderScreen();
    expect((planTrips.mock.calls[0][3] as { tz: string }).tz).toBe('Australia/Melbourne');
  });

  it('falls back to the lens title, then to the facts, when no model wrote anything', () => {
    cachedNarration.mockImplementation(() => ({ title: null, why: new Map(), fromModel: false }));
    renderScreen();
    expect(screen.getByText('An evening in the Old Quarter')).toBeTruthy();
    expect(screen.queryByText('An easy first stop before the crowds.')).toBeNull();
  });

  it('names the plan from the catalog when neither model nor lens did', async () => {
    cachedNarration.mockImplementation(() => ({ title: null, why: new Map(), fromModel: false }));
    const navigation = renderScreen({ title: undefined });
    const expected = derivedTitle(
      EVENING.stops.map((st) => ({
        slug: st.place.slug, name: st.place.name_en, neighborhood: st.place.neighborhood_en, arriveMin: st.arriveMin,
      })),
      'evening',
      (en: string) => en,
    );
    expect(expected).toBeTruthy();
    expect(screen.getByText(expected)).toBeTruthy();
    save();
    await waitFor(() => expect(navigation.popToTop).toHaveBeenCalled());
    expect(payload().title).toBe(expected);
  });

  it('says so when the plan the reader tapped can no longer be built', () => {
    planTrips.mockImplementation(() => []);
    const navigation = renderScreen();
    expect(screen.getByText('That plan is no longer available.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Save to Trips' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(navigation.goBack).toHaveBeenCalled();
  });
});

describe('narration that was not cached yet', () => {
  it('asks once with the plan’s answers and shows the words when they land', async () => {
    cachedNarration.mockImplementation(() => null);
    let land!: (n: Narration) => void;
    prefetchNarration.mockImplementation(() => new Promise((r) => { land = r; }));
    renderScreen();
    expect(screen.getByText('An evening in the Old Quarter')).toBeTruthy();
    expect(prefetchNarration).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ slug: 'cafe' })]),
      { company: 'friends', categories: ['cafes'], when: 'evening', where: 'Old Quarter' },
      'en',
    );
    await act(async () => { land(words({ why: new Map([['dinner', 'Grilled pork, done right.']]) })); });
    expect(screen.getByText('Grilled pork, done right.')).toBeTruthy();
    expect(screen.getByText('Coffee, noodles, skyline')).toBeTruthy();
  });

  it('takes the cached words when the plan resolves after the first render', () => {
    // The first render misses and a later read hits: the effect uses the
    // hit rather than asking the model again.
    cachedNarration.mockImplementationOnce(() => null);
    renderScreen();
    expect(prefetchNarration).not.toHaveBeenCalled();
    expect(screen.getByText('Coffee, noodles, skyline')).toBeTruthy();
  });

  it('does not ask about a plan with no stops', () => {
    cachedNarration.mockImplementation(() => null);
    planTrips.mockImplementation(() => [plan('classic', [])]);
    renderScreen();
    expect(prefetchNarration).not.toHaveBeenCalled();
    expect(screen.getByText('Nothing left in this plan.')).toBeTruthy();
    // Nothing to window, nothing to travel; the company still stands.
    expect(screen.queryByText(/\d\d:\d\d–/)).toBeNull();
    expect(screen.getByText('Friends')).toBeTruthy();
  });
});

describe('editing', () => {
  it('nudging a time pins it and pushes the unpinned stops after it', () => {
    renderScreen();
    press('add', 0);
    expect(screen.getByText('18:15')).toBeTruthy();
    expect(screen.queryByText('18:00')).toBeNull();
    // Dinner flows from the café's new departure rather than keeping 19:15.
    expect(screen.queryByText('19:15')).toBeNull();
    press('remove', 0);
    press('remove', 0);
    expect(screen.getByText('17:45')).toBeTruthy();
  });

  it('flags a stop pinned earlier than the one above it', () => {
    renderScreen();
    expect(screen.queryByText('Earlier than the stop above.')).toBeNull();
    // Dinner from 19:15 back to 17:45, before the café's 18:00.
    for (let n = 0; n < 6; n++) press('remove', 1);
    expect(screen.getByText('17:45')).toBeTruthy();
    expect(screen.getAllByText('Earlier than the stop above.')).toHaveLength(1);
    press('add', 1);
    press('add', 1);
    expect(screen.queryByText('Earlier than the stop above.')).toBeNull();
  });

  // VoiceOver cannot drag, so each card offers Move up and Move down as
  // actions — the arrows the rail used to carry.
  it('moves a stop down and up by VoiceOver’s actions without moving the evening’s start', () => {
    renderScreen();
    act11y(0, 'moveDown');
    expect(names()).toEqual(['Bún Chả Hương Liên', 'Cộng Café', 'Sky Bar']);
    expect(screen.getByText('18:00')).toBeTruthy();
    act11y(2, 'moveUp');
    expect(names()).toEqual(['Bún Chả Hương Liên', 'Sky Bar', 'Cộng Café']);
  });

  it('offers no Move up on the first stop and no Move down on the last', () => {
    renderScreen();
    const actions = (i: number) => (band(i).accessibilityActions as { name: string }[]).map((a) => a.name);
    expect(actions(0)).toEqual(['moveDown']);
    expect(actions(1)).toEqual(['moveUp', 'moveDown']);
    expect(actions(2)).toEqual(['moveUp']);
    expect(band(0).accessibilityHint).toMatch(/Hold and drag/);
  });

  // The hold-and-drag the collection screen has, on the stops. The rows
  // are 360 tall until measured; a row is passed once the held row's
  // centre is past its middle.
  it('moves a stop by holding and dragging it, and retimes the evening', () => {
    renderScreen();
    lift(0);
    expect(claim(0)).toBe(true);
    // Held still while a stop is up.
    expect(scroller().scrollEnabled).toBe(false);
    moveBy(100);
    expect(names()).toEqual(['Cộng Café', 'Bún Chả Hương Liên', 'Sky Bar']);
    moveBy(200);
    drop();
    expect(names()).toEqual(['Bún Chả Hương Liên', 'Cộng Café', 'Sky Bar']);
    expect(screen.getByText('18:00')).toBeTruthy();
    expect(scroller().scrollEnabled).toBe(true);
  });

  it('drags over the rows as they measured, not as guessed', () => {
    renderScreen();
    measure('dinner', 600);
    lift(0);
    claim(0);
    moveBy(200);
    drop();
    expect(names()).toEqual(['Cộng Café', 'Bún Chả Hương Liên', 'Sky Bar']);
    lift(0);
    claim(0);
    moveBy(320);
    drop();
    expect(names()).toEqual(['Bún Chả Hương Liên', 'Cộng Café', 'Sky Bar']);
  });

  it('puts a held stop down where it was when the finger comes up without moving', () => {
    renderScreen();
    lift(1);
    act(() => { band(1).onPressOut(); });
    expect(names()).toEqual(['Cộng Café', 'Bún Chả Hương Liên', 'Sky Bar']);
    expect(scroller().scrollEnabled).toBe(true);
  });

  it('lifts from a hold on the picture as well as on the name', () => {
    renderScreen();
    const page = propsWhere((p) => p.testID === 'hero-page' && 'onLongPress' in p);
    act(() => { page.onLongPress({ nativeEvent: { pageY: Y0 } }); });
    expect(claim(0)).toBe(true);
    moveBy(300);
    drop();
    expect(names()).toEqual(['Bún Chả Hương Liên', 'Cộng Café', 'Sky Bar']);
  });

  it('offers no hold, no actions and no promise of moving on a plan of one stop', () => {
    planTrips.mockImplementation(() => [plan('classic', [stop(CAFE, 18 * 60, 60)])]);
    renderScreen();
    expect(band(0).onLongPress).toBeUndefined();
    expect(band(0).accessibilityActions).toBeUndefined();
    expect(band(0).accessibilityHint).toBeUndefined();
    const page = propsWhere((p) => p.testID === 'hero-page');
    expect(page.onLongPress).toBeUndefined();
    expect(screen.getByText('Nudge the time with − and +.')).toBeTruthy();
    expect(screen.queryByText(/Hold a stop/)).toBeNull();
  });

  it('removes a stop and the chips follow', () => {
    appFlags.set('place_price', true);
    renderScreen();
    press('close', 2);
    expect(names()).toEqual(['Cộng Café', 'Bún Chả Hương Liên']);
    // The ride went with the rooftop: the window closes at dinner's end,
    // the fare leaves the spend, and the distance is a walk again.
    expect(screen.getByText(/^18:00–/).textContent).not.toBe('18:00–22:00');
    expect(screen.getByText('~250k ₫ / person')).toBeTruthy();
    expect(document.querySelectorAll('[data-icon="car-outline"]')).toHaveLength(0);
    press('close', 0);
    press('close', 0);
    expect(screen.getByText('Nothing left in this plan.')).toBeTruthy();
  });

  it('retires a model title once the order changes but keeps the sentences', async () => {
    const navigation = renderScreen();
    act11y(1, 'moveDown');
    expect(screen.queryByText('Coffee, noodles, skyline')).toBeNull();
    expect(screen.getByText('An evening in the Old Quarter')).toBeTruthy();
    expect(screen.getByText('An easy first stop before the crowds.')).toBeTruthy();
    // And what is saved is what is shown: a title about a sequence that no
    // longer exists must not reach the database either.
    save();
    await waitFor(() => expect(navigation.popToTop).toHaveBeenCalled());
    expect(payload()).toMatchObject({ title: 'An evening in the Old Quarter', generatedBy: 'rules+llm' });
    expect(payload().stops.map((st) => st.placeSlug)).toEqual(['cafe', 'roof', 'dinner']);
  });

  it('opens a place from its name, not from its controls', () => {
    const navigation = renderScreen();
    fireEvent.click(screen.getByRole('button', { name: 'Open Bún Chả Hương Liên' }));
    expect(navigation.navigate).toHaveBeenCalledWith('PlaceDetail', { slug: 'dinner' });
    (navigation.navigate as ReturnType<typeof vi.fn>).mockClear();
    press('add', 1);
    expect(navigation.navigate).not.toHaveBeenCalled();
  });
});

describe('saving', () => {
  it('saves the plan on screen and leaves the flow for Trips', async () => {
    const navigation = renderScreen();
    save();
    await waitFor(() => expect(navigation.popToTop).toHaveBeenCalled());
    expect(saveTrip).toHaveBeenCalledTimes(1);
    expect(payload()).toMatchObject({
      ownerId: 'u1', cityId: 'hanoi', title: 'Coffee, noodles, skyline', company: 'friends',
      categories: ['cafes'], district: 'hoan-kiem', day: todayISO(), when: 'evening',
      generatedBy: 'rules+llm',
    });
    expect(payload().stops).toEqual([
      { placeSlug: 'cafe', arriveMin: 18 * 60, dwellMin: 60, why: 'An easy first stop before the crowds.', whyLang: 'en' },
      { placeSlug: 'dinner', arriveMin: 19 * 60 + 15, dwellMin: 90, why: null, whyLang: null },
      { placeSlug: 'roof', arriveMin: 21 * 60, dwellMin: 60, why: null, whyLang: null },
    ]);
    expect(navigation.parent.navigate).toHaveBeenCalledWith('Trips');
    // Pop before switching tabs, so nothing stale is left behind the Trips tab.
    expect((navigation.popToTop as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0])
      .toBeLessThan(navigation.parent.navigate.mock.invocationCallOrder[0]);
    // The first stop's hour rides along, so the day's own note can be two
    // hours before it; the words are the reminder module's to write.
    expect(scheduleTripReminder).toHaveBeenCalledWith(
      { id: 'trip-1', day: todayISO(), title: 'Coffee, noodles, skyline', startMin: 18 * 60 },
      expect.any(Function),
    );
  });

  it('carries the pin location through when the day started from one', async () => {
    const navigation = renderScreen({ atLat: 21.03, atLng: 105.84 });
    save();
    await waitFor(() => expect(navigation.popToTop).toHaveBeenCalled());
    expect(payload()).toMatchObject({ atLat: 21.03, atLng: 105.84 });
  });

  it('saves the edited order and times, and records what was kept and dropped', async () => {
    const navigation = renderScreen();
    press('close', 0);
    press('add', 1);
    save();
    await waitFor(() => expect(navigation.popToTop).toHaveBeenCalled());
    const saved = payload().stops;
    expect(saved.map((st) => st.placeSlug)).toEqual(['dinner', 'roof']);
    // The removed opener's start is inherited by the new first stop.
    expect(saved[0].arriveMin).toBe(18 * 60);
    expect(screen.queryByText('21:00')).toBeNull();
    // The café's sentence left with the café, so nothing model-written
    // remains and the trip is a rules trip under the lens title.
    expect(saved.every((st) => st.why === null)).toBe(true);
    expect(payload()).toMatchObject({ generatedBy: 'rules', title: 'An evening in the Old Quarter' });
    expect(note).toHaveBeenCalledWith('dinner', 'plan_keep');
    expect(note).toHaveBeenCalledWith('roof', 'plan_keep');
    expect(note).toHaveBeenCalledWith('cafe', 'plan_drop');
    expect(note).toHaveBeenCalledTimes(3);
  });

  it('shows Saving… and ignores a second tap while the write is in flight', async () => {
    let finish!: (id: string) => void;
    saveTrip.mockImplementation(() => new Promise((r) => { finish = r; }));
    const navigation = renderScreen();
    save();
    expect(await screen.findByRole('button', { name: 'Saving…' })).toBeTruthy();
    save();
    expect(saveTrip).toHaveBeenCalledTimes(1);
    await act(async () => { finish('trip-9'); });
    expect(navigation.popToTop).toHaveBeenCalledTimes(1);
  });

  it('reports a failed save, stays put, and records nothing', async () => {
    saveTrip.mockImplementation(async () => { throw new Error('offline'); });
    const navigation = renderScreen();
    save();
    await waitFor(() => expect(alert).toHaveBeenCalledWith('Could not save', 'offline'));
    expect(navigation.popToTop).not.toHaveBeenCalled();
    expect(navigation.parent.navigate).not.toHaveBeenCalled();
    expect(note).not.toHaveBeenCalled();
    expect(scheduleTripReminder).not.toHaveBeenCalled();
    // The button comes back, so the reader can try again.
    expect(await screen.findByRole('button', { name: 'Save to Trips' })).toBeTruthy();
  });

  it('reports a failure that is not an Error in its own words', async () => {
    saveTrip.mockImplementation(async () => { throw 'quota exceeded'; });
    renderScreen();
    save();
    await waitFor(() => expect(alert).toHaveBeenCalledWith('Could not save', 'quota exceeded'));
  });

  it('asks a signed-out reader to sign in, and does not write', async () => {
    auth.current = { session: null, profile: { avatar_url: null } };
    renderScreen();
    expect(screen.getByText('Sign in to save this trip.')).toBeTruthy();
    save();
    await act(async () => {});
    expect(saveTrip).not.toHaveBeenCalled();
    // The sheet the bookmark and the heart raise, titled for a trip — not
    // a tap that goes nowhere with a caption to explain it.
    expect(askToSignIn).toHaveBeenCalledTimes(1);
    expect(askToSignIn).toHaveBeenCalledWith('trip');
  });

  it('does not write without a city', async () => {
    cityState.current = { city: null };
    renderScreen();
    expect(screen.getByText('Saved trips go to Trips, where you can invite your crew.')).toBeTruthy();
    save();
    await act(async () => {});
    expect(saveTrip).not.toHaveBeenCalled();
  });

  it('does not write a plan the reader emptied', async () => {
    const navigation = renderScreen();
    press('close', 0);
    press('close', 0);
    press('close', 0);
    save();
    await act(async () => {});
    expect(saveTrip).not.toHaveBeenCalled();
    expect(navigation.popToTop).not.toHaveBeenCalled();
  });
});

describe('the header and the company', () => {
  it('Share says it is a mock rather than doing nothing', () => {
    renderScreen();
    fireEvent.click(screen.getByRole('button', { name: 'Share' }));
    expect(alert).toHaveBeenCalledWith('Share', expect.stringMatching(/does not exist yet/));
  });

  it('Back leaves without saving', () => {
    const navigation = renderScreen();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(navigation.goBack).toHaveBeenCalled();
    expect(saveTrip).not.toHaveBeenCalled();
  });

  // The company is the wizard's own word for the answer the reader gave
  // there, and the avatar row that used to argue with it is gone.
  it('names the company the way the wizard did', () => {
    renderScreen({ company: 'solo' });
    expect(screen.getByText('Just me')).toBeTruthy();
    expect(screen.queryByText('Just you, for now')).toBeNull();
    expect(screen.queryByText('Save first, then invite')).toBeNull();
  });

  it('says what the controls do: hold to move, − and + for the time', () => {
    renderScreen();
    expect(screen.getByText('Hold a stop to move it. Nudge its time with − and +.')).toBeTruthy();
    // The stepper is named on every card.
    expect(screen.getAllByText('Time')).toHaveLength(3);
    // No arrows on the rail any more: remove is the only tool there.
    expect(screen.queryByRole('button', { name: /^Move / })).toBeNull();
    expect(screen.queryByText(/Drag/)).toBeNull();
  });
});

// Edits exist only on this screen until Save, and leaving used to drop
// them without a word. The guard sits on `beforeRemove`, which the header's
// Back and iOS's swipe both pass through — so the tests drive that.
describe('leaving with unsaved edits', () => {
  it('lets an untouched plan go without asking', () => {
    const navigation = renderScreen();
    expect(navigation.leave()).toBe(false);
    expect(alert).not.toHaveBeenCalled();
  });

  it('holds an edited plan and asks first; Keep editing stays', () => {
    const navigation = renderScreen();
    press('add', 0);
    expect(navigation.leave()).toBe(true);
    expect(alert).toHaveBeenCalledWith('Discard your changes?', expect.any(String), expect.any(Array));
    const buttons = alert.mock.calls.at(-1)![2] as { text: string; onPress?: () => void }[];
    expect(buttons.map((b) => b.text)).toEqual(['Keep editing', 'Discard']);
    buttons[0].onPress?.();
    expect(navigation.dispatch).not.toHaveBeenCalled();
  });

  it('Discard carries on with the very navigation it held', () => {
    const navigation = renderScreen();
    press('close', 0);
    navigation.leave();
    const buttons = alert.mock.calls.at(-1)![2] as { text: string; onPress?: () => void }[];
    buttons.find((b) => b.text === 'Discard')!.onPress!();
    expect(navigation.dispatch).toHaveBeenCalledWith({ type: 'GO_BACK' });
  });

  it('does not stand in the way of the exit a save takes', async () => {
    const navigation = renderScreen();
    press('add', 0);
    save();
    await waitFor(() => expect(navigation.popToTop).toHaveBeenCalled());
    expect(navigation.leave()).toBe(false);
  });
});
