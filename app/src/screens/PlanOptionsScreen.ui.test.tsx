// @vitest-environment jsdom
//
// The three drafts and the button that asks for three more. What is pinned
// here is what the reader compares and what the editor receives: which
// lenses are shown and in what order, what each card says (its name, its
// badge, its stops, its summary), that tapping a card hands PlanEdit the
// exact inputs to rebuild *that* plan (seed, lens, avoid-list, title), that
// Regenerate moves the seed and grows the avoid-list, and that it holds
// the old set on screen until the new set's words are in — or the cap
// fires. Also the thin, empty and dropped-pin lines.
//
// The planner is mocked, not run. The real `planTrips` is pure, but its
// output depends on scoring, opening hours and the clock; this screen's
// behaviour is about what it does with *whatever* comes back — how many,
// in which order, with which legs and costs, with which pins dropped — and
// a stub keyed on the seed lets each test say exactly that. What the
// planner is *asked* is asserted separately, which is the half of the
// contract this screen owns. `narratableOf` and `NARRATION_HOLD_MS` stay
// real; only the network-facing narration cache is replaced.

import React from 'react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '../uitest/render';
import { addDays, fromISO, todayISO } from '../lib/day';
import { dateline } from '../lib/format';
import { narratableOf, NARRATION_HOLD_MS, type Narration } from '../lib/assist';
import type { Place } from '../lib/types';
import type { Nav, RootRoute } from '../nav';

const planTrips = vi.hoisted(() => vi.fn());
const cachedNarration = vi.hoisted(() => vi.fn());
const prefetchNarration = vi.hoisted(() => vi.fn());
const cityState = vi.hoisted(() => ({ current: { city: { id: 'hanoi' } as { id: string } | null } }));
const mine = vi.hoisted(() => ({ current: [] as unknown[] }));

vi.mock('../lib/city', () => ({ useCity: () => cityState.current }));
vi.mock('../lib/i18n', () => ({
  useI18n: () => ({ lang: 'en', setLang: () => {}, t: (en: string) => en }),
}));
vi.mock('../lib/catalog', () => ({ usePlaces: () => ({ data: PLACES }) }));
vi.mock('../lib/save', () => ({ useSave: () => ({ mine: { data: mine.current, reload: vi.fn() } }) }));
vi.mock('../lib/tasteProfile', () => ({
  usePlanProfile: () => ({ taste: null, budgetVnd: 400000 }),
}));
vi.mock('../lib/planner', () => ({ planTrips }));
vi.mock('../lib/assist', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  cachedNarration,
  prefetchNarration,
}));

import PlanOptionsScreen from './PlanOptionsScreen';

const place = (slug: string, name: string, extra: Partial<Place> = {}): Place => ({
  slug, name_en: name, name_vi: name, name_ja: null, category: 'food', is_featured: false,
  vibe_tags: [], neighborhood_en: 'Hoàn Kiếm', neighborhood_vi: null, neighborhood_ja: null,
  address: null, lat: null, lng: null, ...extra,
} as Place);

const CAFE = place('cafe', 'Cộng Café');
const DINNER = place('dinner', 'Bún Chả Hương Liên');
const ROOF = place('roof', 'Sky Bar', { neighborhood_en: 'Tây Hồ' } as Partial<Place>);
const LAKE = place('lake', 'West Lake Walk', { neighborhood_en: 'Tây Hồ' } as Partial<Place>);
const TEMPLE = place('temple', 'Temple of Literature', { neighborhood_en: 'Đống Đa' } as Partial<Place>);
const NOWHERE = place('nowhere', 'Pop-up Stall', { neighborhood_en: null } as Partial<Place>);
const PINNED = place('pinned', 'Collection Pick');
const PLACES = [CAFE, DINNER, ROOF, LAKE, TEMPLE, NOWHERE, PINNED];

type Leg = { mode: 'walk' | 'ride'; km: number; minutes: number } | null;
const stop = (p: Place, arriveMin: number, dwellMin = 60) => ({ place: p, part: 'evening', arriveMin, dwellMin, why: null });
const plan = (lens: string, stops: ReturnType<typeof stop>[], over: Record<string, unknown> = {}) => ({
  lens, title: null, stops, legs: [] as Leg[], costVnd: { food: 0, activity: 0, transport: 0 },
  windowMin: [stops[0]?.arriveMin ?? 0, (stops.at(-1)?.arriveMin ?? 0) + (stops.at(-1)?.dwellMin ?? 0)],
  pinnedDropped: [] as { slug: string; reason: string }[], ...over,
});

// The first set: café → dinner in one district, a walk; the iconic plan
// crosses town by car; the low-key one is a single stop.
const MATCH = plan('match', [stop(CAFE, 18 * 60, 60), stop(DINNER, 19 * 60 + 15, 90)], {
  legs: [{ mode: 'walk', km: 0.35, minutes: 5 }],
  costVnd: { food: 250000, activity: 0, transport: 0 },
  windowMin: [18 * 60, 20 * 60 + 45],
});
const ICONIC = plan('iconic', [stop(TEMPLE, 18 * 60, 60), stop(ROOF, 19 * 60 + 30, 90)], {
  legs: [{ mode: 'ride', km: 4.24, minutes: 18 }],
  costVnd: { food: 900000, activity: 200000, transport: 30000 },
  windowMin: [18 * 60, 21 * 60],
});
const LOWKEY = plan('lowkey', [stop(LAKE, 18 * 60, 90)], { windowMin: [18 * 60, 19 * 60 + 30] });
const FIRST = [MATCH, ICONIC, LOWKEY];
// What seed 8 draws: different places, so the swap is visible.
const SECOND = [
  plan('match', [stop(NOWHERE, 18 * 60, 45)]),
  plan('lowkey', [stop(PINNED, 18 * 60, 60)]),
];

const words = (title: string | null): Narration => ({ title, why: new Map(), fromModel: !!title });

const nav = () => ({ navigate: vi.fn(), goBack: vi.fn() });
const routeWith = (over: object = {}) => ({
  params: {
    company: 'friends', categories: ['cafes', 'eats'], where: 'Old Quarter', district: 'hoan-kiem',
    date: todayISO(), when: 'evening', startMin: 18 * 60, seed: 7, ...over,
  },
}) as unknown as RootRoute<'PlanOptions'>;

const renderScreen = (over: object = {}) => {
  const navigation = nav();
  render(<PlanOptionsScreen navigation={navigation as unknown as Nav} route={routeWith(over)} />);
  return navigation;
};

/** Every badge on screen, top to bottom — which is the order of the lenses. */
const badges = () => screen.queryAllByText(/^(Best match|Iconic views|Low-key)$/).map((el) => el.textContent);
const regen = () => screen.getByRole('button', { name: 'Regenerate' });
const optsOf = (call: number) => planTrips.mock.calls[call][3] as Record<string, unknown>;
const seedsAsked = () => planTrips.mock.calls.map((c) => (c[3] as { seed: number }).seed);

/** A narration answer the test decides when to deliver. */
const deferred = () => {
  let resolve!: (n: Narration) => void;
  const promise = new Promise<Narration>((r) => { resolve = r; });
  return { promise, resolve };
};

beforeEach(() => {
  vi.clearAllMocks();
  planTrips.mockImplementation((_d: unknown, _p: unknown, _c: unknown, o: { seed: number }) =>
    (o.seed === 7 ? FIRST : SECOND));
  cachedNarration.mockImplementation(() => null);
  prefetchNarration.mockImplementation(async () => words(null));
  cityState.current = { city: { id: 'hanoi' } };
  mine.current = [];
});

afterEach(() => { vi.useRealTimers(); });

describe('the header', () => {
  it('calls an evening an evening, and goes back from its back button', () => {
    const navigation = renderScreen();
    expect(screen.getByText('Your evening, three ways')).toBeTruthy();
    // Cards come in lens order, so the subtitle no longer claims a sort.
    expect(screen.getByText('Distances checked · each card a different angle')).toBeTruthy();
    expect(screen.queryByText(/shortest hops/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(navigation.goBack).toHaveBeenCalledTimes(1);
    expect(navigation.navigate).not.toHaveBeenCalled();
  });

  it('calls a day planned from the wizard a day', () => {
    renderScreen({ when: 'day' });
    expect(screen.getByText('Your day, three ways')).toBeTruthy();
    expect(screen.queryByText('Your evening, three ways')).toBeNull();
  });

  it('counts the ways it actually has, and drops the count when there are none', () => {
    planTrips.mockImplementation(() => [MATCH]);
    const { unmount } = render(<PlanOptionsScreen navigation={nav() as unknown as Nav} route={routeWith()} />);
    expect(screen.getByText('Your evening, one way')).toBeTruthy();
    expect(screen.queryByText(/three ways/)).toBeNull();
    unmount();

    planTrips.mockImplementation(() => [MATCH, LOWKEY]);
    const second = render(<PlanOptionsScreen navigation={nav() as unknown as Nav} route={routeWith({ when: 'day' })} />);
    expect(screen.getByText('Your day, two ways')).toBeTruthy();
    expect(screen.queryByText(/three ways/)).toBeNull();
    second.unmount();

    planTrips.mockImplementation(() => []);
    renderScreen();
    expect(screen.getByText('Your evening')).toBeTruthy();
    expect(screen.queryByText(/ways?$/)).toBeNull();
  });

  it('puts the date first and the place after it, and never the company', () => {
    const date = addDays(todayISO(), 3);
    renderScreen({ date });
    expect(screen.getByText(`${dateline('en', fromISO(date)!)} · Old Quarter`)).toBeTruthy();
    expect(screen.queryByText(/friends/)).toBeNull();
  });

  it('dates a past or missing day as today', () => {
    renderScreen({ date: '2000-01-01', where: null });
    expect(screen.getByText(dateline('en', fromISO(todayISO())!))).toBeTruthy();
    expect(planTrips.mock.calls[0][0]).toMatchObject({ date: todayISO() });
  });
});

describe('the cards', () => {
  it('shows every lens the planner returned, in its order, with the first starred', () => {
    renderScreen();
    expect(badges()).toEqual(['Best match', 'Iconic views', 'Low-key']);
    // Only the recommended plan wears the star.
    expect(document.querySelectorAll('[data-icon="star"]')).toHaveLength(1);
  });

  it('puts the highlight and the star on the same card, the match lens, wherever it lands', () => {
    planTrips.mockImplementation(() => [LOWKEY, MATCH, ICONIC]);
    renderScreen();
    const best = screen.getAllByTestId('plan-card-best');
    expect(best).toHaveLength(1);
    // The highlighted card is the second one, and it holds the star.
    expect(best[0].textContent).toContain('Best match');
    expect(best[0].querySelectorAll('[data-icon="star"]')).toHaveLength(1);
    expect(document.querySelectorAll('[data-icon="star"]')).toHaveLength(1);
  });

  it('highlights nothing when the match lens is absent', () => {
    planTrips.mockImplementation(() => [ICONIC, LOWKEY]);
    renderScreen();
    expect(screen.queryAllByTestId('plan-card-best')).toHaveLength(0);
  });

  it('exposes each card to VoiceOver as a button named for its title and badge', () => {
    const navigation = renderScreen();
    expect(screen.getByRole('button', { name: 'Hoàn Kiếm, Best match' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Đống Đa +1 area, Iconic views' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Tây Hồ, Low-key' }));
    expect(navigation.navigate).toHaveBeenCalledWith('PlanEdit', expect.objectContaining({ lens: 'lowkey' }));
  });

  it('keeps the planner order rather than sorting by lens', () => {
    planTrips.mockImplementation(() => [LOWKEY, MATCH]);
    renderScreen();
    expect(badges()).toEqual(['Low-key', 'Best match']);
  });

  it('prints each stop with its time, district and dwell, and the leg out of it', () => {
    renderScreen();
    expect(screen.getByText('Cộng Café')).toBeTruthy();
    expect(screen.getByText('19:15')).toBeTruthy();
    expect(screen.getByText('Hoàn Kiếm · 90 min')).toBeTruthy();
    expect(screen.getByText('350 m · ≈ 5 min')).toBeTruthy();
    expect(screen.getByText('4.2 km · ≈ 18 min')).toBeTruthy();
    expect(document.querySelectorAll('[data-icon="walk-outline"]')).toHaveLength(1);
    expect(document.querySelectorAll('[data-icon="car-outline"]')).toHaveLength(1);
  });

  it('summarises count, hours, distance and per-person spend, in thousands or millions', () => {
    renderScreen();
    expect(screen.getByText('2 stops · ~3h · 350 m · ~250k ₫')).toBeTruthy();
    // 900k + 200k + 30k.
    expect(screen.getByText('2 stops · ~3h · 4.2 km · ~1.1M ₫')).toBeTruthy();
    // No legs and nothing priced: distance and spend are left out, not zero.
    expect(screen.getByText('1 stop · ~1.5h')).toBeTruthy();
  });

  it('prints a round million without a decimal', () => {
    planTrips.mockImplementation(() => [
      plan('match', [stop(CAFE, 18 * 60)], { costVnd: { food: 1_000_000, activity: 0, transport: 0 } }),
    ]);
    renderScreen();
    expect(screen.getByText('1 stop · ~1h · ~1M ₫')).toBeTruthy();
  });

  it('drops a leg nobody measured rather than guessing one', () => {
    planTrips.mockImplementation(() => [
      plan('match', [stop(CAFE, 18 * 60), stop(DINNER, 19 * 60 + 15)], { legs: [null] }),
    ]);
    renderScreen();
    expect(screen.queryByText(/≈/)).toBeNull();
    expect(screen.getByText('2 stops · ~2.5h')).toBeTruthy();
  });

  it('heads a card with its areas when no model has named it', () => {
    renderScreen();
    // One district stays put; two districts say "+1 area"; a lone other
    // district names itself.
    expect(screen.getByText('Hoàn Kiếm')).toBeTruthy();
    expect(screen.getByText('Đống Đa +1 area')).toBeTruthy();
    expect(screen.getByText('Tây Hồ')).toBeTruthy();
  });

  it('names the outing when none of its places has a district', () => {
    planTrips.mockImplementation(() => [plan('match', [stop(NOWHERE, 18 * 60)])]);
    renderScreen();
    expect(screen.getByText('An outing')).toBeTruthy();
  });

  it('prefers the planner title, then the cached narration title, over the areas', () => {
    planTrips.mockImplementation(() => [{ ...MATCH, title: 'Planner name' }, ICONIC, LOWKEY]);
    cachedNarration.mockImplementation((stops: { slug: string }[]) =>
      (stops[0].slug === 'temple' ? words('Temples and a rooftop') : stops[0].slug === 'cafe' ? words('Ignored') : null));
    renderScreen();
    expect(screen.getByText('Planner name')).toBeTruthy();
    expect(screen.queryByText('Ignored')).toBeNull();
    expect(screen.getByText('Temples and a rooftop')).toBeTruthy();
    expect(screen.queryByText('Đống Đa +1 area')).toBeNull();
    expect(screen.getByText('Tây Hồ')).toBeTruthy();
    expect(cachedNarration).toHaveBeenCalledWith(narratableOf(ICONIC.stops as never), 'en');
  });

  it('says per-person once under the cards, not on each', () => {
    renderScreen();
    expect(screen.getAllByText(/Costs are estimated for one person\./)).toHaveLength(1);
    expect(screen.getByText('Costs are estimated for one person. Tap one to nudge its times and save it.')).toBeTruthy();
  });
});

describe('fewer than three, and none', () => {
  it('says there is only one way, and does not pad', () => {
    planTrips.mockImplementation(() => [MATCH]);
    renderScreen();
    expect(screen.getByText('Only one way to do this with what is open here.')).toBeTruthy();
    expect(badges()).toEqual(['Best match']);
  });

  it('counts two ways as two', () => {
    planTrips.mockImplementation(() => [MATCH, LOWKEY]);
    renderScreen();
    expect(screen.getByText('Only 2 ways to do this with what is open here.')).toBeTruthy();
  });

  it('says nothing about thinness when there are three', () => {
    renderScreen();
    expect(screen.queryByText(/^Only /)).toBeNull();
  });

  it('shows the empty card with no footnote, and still offers Regenerate', () => {
    planTrips.mockImplementation(() => []);
    renderScreen();
    expect(screen.getByText('Nothing here matches those answers now. Try Regenerate, or change what you asked for.')).toBeTruthy();
    expect(screen.queryByText(/Costs are estimated/)).toBeNull();
    expect(screen.queryByText(/^Only /)).toBeNull();
    expect(badges()).toEqual([]);
    expect(regen()).toBeTruthy();
    expect(prefetchNarration).not.toHaveBeenCalled();
  });
});

describe('what the planner is asked', () => {
  it('passes the draft, the catalog, the city and the reader profile', () => {
    renderScreen();
    expect(planTrips).toHaveBeenCalledWith(
      expect.objectContaining({ categories: ['cafes', 'eats'], district: 'hoan-kiem', when: 'evening', from: [] }),
      PLACES,
      'hanoi',
      { seed: 7, startMin: 18 * 60, pinned: [], avoid: [], taste: null, budgetVnd: 400000 },
    );
  });

  it('asks with no city when none is chosen', () => {
    cityState.current = { city: null };
    renderScreen();
    expect(planTrips.mock.calls[0][2]).toBeNull();
  });

  it('pins the members of only the collections the reader built from', () => {
    mine.current = [
      { slug: 'weekend', members: [PINNED, CAFE] },
      { slug: 'other', members: [ROOF] },
    ];
    renderScreen({ from: ['weekend'] });
    expect(optsOf(0).pinned).toEqual([PINNED, CAFE]);
  });

  it('resolves a collection without members through the catalog, in its sort order', () => {
    mine.current = [{
      slug: 'weekend',
      collection_places: [
        { sort_order: 2, places: { slug: 'roof' } },
        { sort_order: 1, places: { slug: 'lake' } },
        { sort_order: 3, places: { slug: 'gone' } },
      ],
    }];
    renderScreen({ from: ['weekend'] });
    expect(optsOf(0).pinned).toEqual([LAKE, ROOF]);
  });
});

describe('pinned places that did not make it', () => {
  it('names the hour only when the hour is the whole of it', () => {
    planTrips.mockImplementation(() => [{ ...MATCH, pinnedDropped: [{ slug: 'pinned', reason: 'closed' }] }]);
    renderScreen();
    expect(screen.getByText('Some places from your collections are not open at this hour.')).toBeTruthy();
    expect(screen.queryByText(/did not fit/)).toBeNull();
  });

  it('says the quieter thing when any other reason is in the mix', () => {
    planTrips.mockImplementation(() => [{
      ...MATCH,
      pinnedDropped: [{ slug: 'a', reason: 'closed' }, { slug: 'b', reason: 'slot' }],
    }]);
    renderScreen();
    expect(screen.getByText('Some places from your collections did not fit this plan.')).toBeTruthy();
    expect(screen.queryByText(/not open at this hour/)).toBeNull();
  });

  it('says nothing when every pin made it', () => {
    renderScreen();
    expect(screen.queryByText(/Some places from your collections/)).toBeNull();
  });
});

describe('narration prefetch', () => {
  it('asks once per card, with the answers and the language, while the reader compares', () => {
    renderScreen();
    expect(prefetchNarration).toHaveBeenCalledTimes(3);
    const draft = { company: 'friends', categories: ['cafes', 'eats'], when: 'evening', where: 'Old Quarter' };
    for (const pl of FIRST) {
      expect(prefetchNarration).toHaveBeenCalledWith(narratableOf(pl.stops as never), draft, 'en');
    }
  });
});

describe('picking a card', () => {
  it('opens PlanEdit on that lens with the same seed, the answers and the areas name the card shows', () => {
    const navigation = renderScreen({ from: ['weekend'] });
    fireEvent.click(screen.getByText('Tây Hồ'));
    expect(navigation.navigate).toHaveBeenCalledTimes(1);
    expect(navigation.navigate).toHaveBeenCalledWith('PlanEdit', {
      ...routeWith({ from: ['weekend'] }).params,
      seed: 7, lens: 'lowkey', title: 'Tây Hồ', avoid: [],
    });
  });

  it('carries the card\'s own name so the editor header matches it', () => {
    cachedNarration.mockImplementation((stops: { slug: string }[]) =>
      (stops[0].slug === 'temple' ? words('Temples and a rooftop') : null));
    const navigation = renderScreen();
    fireEvent.click(screen.getByText('Temples and a rooftop'));
    expect(navigation.navigate).toHaveBeenCalledWith('PlanEdit', expect.objectContaining({
      lens: 'iconic', title: 'Temples and a rooftop',
    }));
  });

  it('hands the editor the card\'s fallback name, even the no-district one', () => {
    planTrips.mockImplementation(() => [MATCH, plan('iconic', [stop(NOWHERE, 18 * 60)])]);
    const navigation = renderScreen();
    fireEvent.click(screen.getByText('An outing'));
    expect(navigation.navigate).toHaveBeenLastCalledWith('PlanEdit', expect.objectContaining({
      lens: 'iconic', title: 'An outing',
    }));
    fireEvent.click(screen.getByText('Hoàn Kiếm'));
    expect(navigation.navigate).toHaveBeenLastCalledWith('PlanEdit', expect.objectContaining({
      lens: 'match', title: 'Hoàn Kiếm',
    }));
  });

  it('prefers the planner title for the editor too', () => {
    planTrips.mockImplementation(() => [{ ...MATCH, title: 'Planner name' }]);
    cachedNarration.mockImplementation(() => words('Model name'));
    const navigation = renderScreen();
    fireEvent.click(screen.getByText('Planner name'));
    expect(navigation.navigate).toHaveBeenCalledWith('PlanEdit', expect.objectContaining({
      lens: 'match', title: 'Planner name',
    }));
  });
});

describe('Regenerate', () => {
  it('asks for the next seed, avoiding every slug on screen, and swaps once the words are in', async () => {
    const navigation = renderScreen();
    fireEvent.click(regen());
    await waitFor(() => expect(badges()).toEqual(['Best match', 'Low-key']));
    expect(screen.getByText('Pop-up Stall')).toBeTruthy();
    expect(screen.queryByText('Cộng Café')).toBeNull();
    const last = planTrips.mock.calls.at(-1)![3] as Record<string, unknown>;
    expect(last).toMatchObject({ seed: 8, avoid: ['cafe', 'dinner', 'temple', 'roof', 'lake'] });
    // The editor rebuilds the new set, not the old one.
    fireEvent.click(screen.getByText('Collection Pick'));
    expect(navigation.navigate).toHaveBeenCalledWith('PlanEdit', expect.objectContaining({
      seed: 8, lens: 'lowkey', avoid: ['cafe', 'dinner', 'temple', 'roof', 'lake'],
    }));
  });

  it('grows the avoid-list across taps rather than replacing it', async () => {
    planTrips.mockImplementation((_d: unknown, _p: unknown, _c: unknown, o: { seed: number }) =>
      (o.seed === 7 ? FIRST : o.seed === 8 ? SECOND : [plan('iconic', [stop(CAFE, 18 * 60)])]));
    renderScreen();
    fireEvent.click(regen());
    await waitFor(() => expect(screen.getByText('Pop-up Stall')).toBeTruthy());
    fireEvent.click(regen());
    await waitFor(() => expect(badges()).toEqual(['Iconic views']));
    const last = planTrips.mock.calls.at(-1)![3] as Record<string, unknown>;
    expect(last).toMatchObject({
      seed: 9, avoid: ['cafe', 'dinner', 'temple', 'roof', 'lake', 'nowhere', 'pinned'],
    });
  });

  it('holds the old set and shows busy until the new set is narrated, and ignores a second tap', async () => {
    const answers: ReturnType<typeof deferred>[] = [];
    renderScreen();
    prefetchNarration.mockImplementation(() => { const d = deferred(); answers.push(d); return d.promise; });
    fireEvent.click(regen());
    // RN-web drops `accessibilityState.busy`; what reaches the DOM is the
    // disabled state `busy` drives on the Pressable.
    expect(regen().getAttribute('aria-disabled')).toBe('true');
    // Asked for the two plans of the new set, while the old three stay up.
    expect(answers).toHaveLength(2);
    expect(prefetchNarration).toHaveBeenCalledWith(
      narratableOf(SECOND[0].stops as never), expect.objectContaining({ where: 'Old Quarter' }), 'en',
    );
    expect(badges()).toEqual(['Best match', 'Iconic views', 'Low-key']);
    // A tap while busy asks for nothing new (the button is disabled, so
    // the screen's own `if (pending)` guard is belt and braces).
    fireEvent.click(regen());
    expect(seedsAsked().filter((s) => s === 9)).toHaveLength(0);

    await act(async () => { answers[0].resolve(words(null)); });
    expect(badges()).toEqual(['Best match', 'Iconic views', 'Low-key']);
    await act(async () => { answers[1].resolve(words(null)); });
    await waitFor(() => expect(badges()).toEqual(['Best match', 'Low-key']));
    expect(regen().getAttribute('aria-disabled')).not.toBe('true');
  });

  it('lands the new cards with the names their narration brought', async () => {
    const named = new Set<string>();
    cachedNarration.mockImplementation((stops: { slug: string }[]) =>
      (named.has(stops[0].slug) ? words(`Named ${stops[0].slug}`) : null));
    prefetchNarration.mockImplementation(async (stops: { slug: string }[]) => {
      named.add(stops[0].slug);
      return words(`Named ${stops[0].slug}`);
    });
    renderScreen();
    fireEvent.click(regen());
    await waitFor(() => expect(screen.getByText('Named nowhere')).toBeTruthy());
    expect(screen.getByText('Named pinned')).toBeTruthy();
  });

  it('gives up waiting at the narration cap and swaps anyway', async () => {
    vi.useFakeTimers();
    renderScreen();
    prefetchNarration.mockImplementation(() => new Promise(() => {}));
    fireEvent.click(regen());
    await act(async () => { vi.advanceTimersByTime(NARRATION_HOLD_MS - 100); });
    expect(badges()).toEqual(['Best match', 'Iconic views', 'Low-key']);
    await act(async () => { vi.advanceTimersByTime(200); });
    expect(badges()).toEqual(['Best match', 'Low-key']);
  });

  it('settles at once when the new set is empty', async () => {
    planTrips.mockImplementation((_d: unknown, _p: unknown, _c: unknown, o: { seed: number }) =>
      (o.seed === 7 ? FIRST : []));
    renderScreen();
    fireEvent.click(regen());
    await waitFor(() => expect(screen.getByText(/^Nothing here matches/)).toBeTruthy());
    expect(badges()).toEqual([]);
  });
});
