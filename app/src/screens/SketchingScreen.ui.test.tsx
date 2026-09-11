// @vitest-environment jsdom
//
// The wait between the wizard and the three plans. What is pinned here is
// the contract with the two things the screen waits on and the one it
// hands over to: what the planner is asked (draft, catalog, city, the
// fixed seed, the pinned places), what the narration prefetch is asked for
// each plan, how the five steps advance (not at all while the catalog
// loads, on the reading floor after that, holding on the last until the
// words settle or the cap fires), what the feed under the steps says at
// each step, that it leaves with `replace` and the exact answers plus the
// seed, and that it never leaves after the reader has — nor twice. Also
// the dead end: no plans, no prefetch, the suggestion line, the way back.
//
// The planner and the network-facing narration cache are mocked; the
// sequence (`lib/sketch`), the formatting and `narratableOf` stay real,
// because what they print is what the reader reads. Timers are fake: the
// whole screen is a clock, and a real one would make every test slow and
// every failure a flake.

import React from 'react';
import { AccessibilityInfo } from 'react-native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '../uitest/render';
import { narratableOf, NARRATION_HOLD_MS, type Narration } from '../lib/assist';
import { SKETCH_STEPS, STEP_FLOOR_MS } from '../lib/sketch';
import { dateline } from '../lib/format';
import { fromISO, todayISO } from '../lib/day';
import type { Place } from '../lib/types';
import type { Nav, RootRoute } from '../nav';

const planTrips = vi.hoisted(() => vi.fn());
const prefetchNarration = vi.hoisted(() => vi.fn());
const legsOf = vi.hoisted(() => vi.fn());
const catalog = vi.hoisted(() => ({ current: { data: [] as unknown[], loading: false } }));
const cityState = vi.hoisted(() => ({ current: { city: { id: 'hanoi' } as { id: string } | null } }));
const mine = vi.hoisted(() => ({ current: [] as unknown[] }));
// One object for the run, as the real hook's memo hands back: a fresh one
// per render would re-plan on every render and restart the words' cap.
const profile = vi.hoisted(() => ({ taste: { cafes: 2 }, budgetVnd: 400000 }));

vi.mock('../lib/i18n', () => ({
  useI18n: () => ({ lang: 'en', setLang: () => {}, t: (en: string) => en }),
}));
vi.mock('../lib/catalog', () => ({ usePlaces: () => catalog.current }));
vi.mock('../lib/city', () => ({ useCity: () => cityState.current }));
vi.mock('../lib/save', () => ({ useSave: () => ({ mine: { data: mine.current, reload: vi.fn() } }) }));
vi.mock('../lib/tasteProfile', () => ({
  usePlanProfile: () => profile,
}));
vi.mock('../lib/planner', () => ({ planTrips }));
vi.mock('../lib/travel', () => ({ legsOf }));
vi.mock('../lib/assist', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  prefetchNarration,
}));

import SketchingScreen from './SketchingScreen';

const ALL_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  .map((d) => `${d}: Open 24 hours`);

const place = (slug: string, name: string, extra: Partial<Place> = {}): Place => ({
  slug, name_en: name, name_vi: name, name_ja: null, category: 'food', categories: ['eats'],
  is_featured: false, vibe_tags: [], neighborhood_en: 'Hoàn Kiếm', neighborhood_vi: null,
  neighborhood_ja: null, address: null, lat: null, lng: null, opening_hours: null, ...extra,
} as Place);

const CAFE = place('cafe', 'Cộng Café', { categories: ['cafes'], opening_hours: ALL_WEEK } as Partial<Place>);
const DINNER = place('dinner', 'Bún Chả Hương Liên', { opening_hours: ALL_WEEK } as Partial<Place>);
const ROOF = place('roof', 'Sky Bar', { categories: ['views'] } as Partial<Place>);
const PINNED = place('pinned', 'Collection Pick');
const PLACES = [CAFE, DINNER, ROOF, PINNED];

const stop = (p: Place, arriveMin: number, dwellMin = 60) => ({ place: p, part: 'evening', arriveMin, dwellMin, why: null });
const plan = (lens: string, stops: ReturnType<typeof stop>[], windowMin: [number, number]) => ({
  lens, title: null, stops, legs: [], costVnd: { food: 0, activity: 0, transport: 0 }, windowMin, pinnedDropped: [],
});
const MATCH = plan('match', [stop(CAFE, 18 * 60), stop(DINNER, 19 * 60 + 15, 90)], [18 * 60, 20 * 60 + 45]);
const ICONIC = plan('iconic', [stop(ROOF, 18 * 60, 90)], [18 * 60, 19 * 60 + 30]);
const PLANS = [MATCH, ICONIC];

const NOW = new Date('2026-09-11T08:00:00Z');
const words = (): Narration => ({ title: null, why: new Map(), fromModel: false });

const deferred = () => {
  let resolve!: (n: Narration) => void;
  let reject!: (e: Error) => void;
  const promise = new Promise<Narration>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};

const nav = () => ({ navigate: vi.fn(), goBack: vi.fn(), replace: vi.fn() });
const paramsWith = (over: object = {}) => ({
  company: 'friends', categories: ['cafes', 'eats'], where: 'Old Quarter', district: 'hoan-kiem',
  date: todayISO(), when: 'evening', startMin: 18 * 60, from: [], ...over,
});

const renderScreen = (over: object = {}) => {
  const navigation = nav();
  const route = { params: paramsWith(over) } as unknown as RootRoute<'Sketching'>;
  const view = render(<SketchingScreen navigation={navigation as unknown as Nav} route={route} />);
  return { navigation, route, ...view };
};

/** Let the clock run, and the promises that settle along the way.
 *  In slices, each its own `act`: a step's timer is set by the effect of
 *  the render the previous timer caused, and React only commits that
 *  render when an `act` scope closes. */
const tick = async (ms: number) => {
  // A zero-length slice first, so answers already settled (an instant
  // prefetch) commit at the moment they land rather than a slice later.
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  for (let left = ms; left > 0; left -= 50) {
    await act(async () => { await vi.advanceTimersByTimeAsync(Math.min(50, left)); });
  }
};

/** How many step marks are the gradient disc that means done. */
const doneCount = () => document.querySelectorAll('[data-stub="LinearGradient"] > [data-icon="checkmark"]').length;
/** The text currently in the feed's bright slot and its dimmed seat. */
const feedTexts = () => [...document.querySelectorAll('[data-icon$="-outline"]')]
  .map((el) => el.parentElement?.nextElementSibling?.textContent ?? '');
const settledLine = () => document.querySelector('[data-icon="checkmark"] + div')?.textContent ?? null;
/** The mark beside a step label: the element before the label. */
const markOf = (label: string) => screen.getByText(label).previousElementSibling as HTMLElement;

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ now: NOW });
  planTrips.mockImplementation(() => PLANS);
  prefetchNarration.mockImplementation(async () => words());
  legsOf.mockImplementation(() => [{ mode: 'walk', km: 0.35, minutes: 5 }]);
  catalog.current = { data: PLACES, loading: false };
  cityState.current = { city: { id: 'hanoi' } };
  mine.current = [];
});

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('what it asks', () => {
  it('asks the planner for the draft, the catalog, the city and the seed fixed at arrival', async () => {
    renderScreen({ atLat: 21.03, atLng: 105.85 });
    expect(planTrips).toHaveBeenCalled();
    const [draft, places, cityId, opts] = planTrips.mock.calls[0];
    expect(draft).toEqual({
      company: null, categories: ['cafes', 'eats'], district: 'hoan-kiem',
      at: { lat: 21.03, lng: 105.85 }, date: todayISO(), when: 'evening', from: [],
    });
    expect(places).toBe(PLACES);
    expect(cityId).toBe('hanoi');
    expect(opts).toEqual({ seed: NOW.getTime(), startMin: 18 * 60, pinned: [], taste: { cafes: 2 }, budgetVnd: 400000 });
    // A later render does not redraw: every call carries the same seed.
    await tick(STEP_FLOOR_MS * 2);
    expect(new Set(planTrips.mock.calls.map((c) => (c[3] as { seed: number }).seed))).toEqual(new Set([NOW.getTime()]));
  });

  it('plans with no city as null, and with the places of the collections it was seeded from', () => {
    cityState.current = { city: null };
    mine.current = [
      { slug: 'mine', members: [PINNED] },
      { slug: 'other', members: [ROOF] },
    ];
    renderScreen({ from: ['mine'] });
    const [, , cityId, opts] = planTrips.mock.calls[0];
    expect(cityId).toBeNull();
    expect((opts as { pinned: Place[] }).pinned).toEqual([PINNED]);
  });

  it('does not plan, ask for words or advance while the catalog is still loading', async () => {
    catalog.current = { data: [], loading: true };
    const { navigation, rerender, route } = renderScreen();
    expect(planTrips).not.toHaveBeenCalled();
    await tick(NARRATION_HOLD_MS * 2);
    expect(prefetchNarration).not.toHaveBeenCalled();
    expect(doneCount()).toBe(0);
    expect(navigation.replace).not.toHaveBeenCalled();
    // The skeleton stands in the box until there is a fact to show.
    expect(document.querySelectorAll('[data-icon$="-outline"]').length).toBe(0);

    catalog.current = { data: PLACES, loading: false };
    rerender(<SketchingScreen navigation={navigation as unknown as Nav} route={route} />);
    expect(planTrips).toHaveBeenCalledTimes(1);
    await tick(STEP_FLOOR_MS);
    expect(doneCount()).toBe(1);
  });

  it('asks for the words of every plan, with the answers the model names plans from', () => {
    renderScreen({ when: 'day' });
    expect(prefetchNarration).toHaveBeenCalledTimes(2);
    PLANS.forEach((pl, i) => {
      expect(prefetchNarration.mock.calls[i]).toEqual([
        narratableOf(pl.stops),
        { company: 'friends', categories: ['cafes', 'eats'], when: 'day', where: 'Old Quarter' },
        'en',
      ]);
    });
  });
});

describe('while it waits', () => {
  it('names the evening, the date, the half and the place, and the categories it knows', () => {
    renderScreen({ categories: ['cafes', 'mystery'] });
    expect(screen.getByText('Sketching your evening…')).toBeTruthy();
    expect(screen.getByText(`${dateline('en', fromISO(todayISO())!)} · Evening · Old Quarter`)).toBeTruthy();
    // An unknown key is dropped rather than printed as a raw slug.
    expect(screen.getByText('Cafés')).toBeTruthy();
    expect(screen.getByText('You can edit everything afterwards.')).toBeTruthy();
    expect(screen.getByText('Plan a trip')).toBeTruthy();
    for (const st of SKETCH_STEPS) expect(screen.getByText(st.en)).toBeTruthy();
  });

  it('calls a day a day, and prints no category line when none is known', () => {
    renderScreen({ when: 'day', where: '', categories: ['mystery'] });
    expect(screen.getByText('Sketching your day…')).toBeTruthy();
    expect(screen.getByText(`${dateline('en', fromISO(todayISO())!)} · Day`)).toBeTruthy();
    expect(screen.queryByText('Mystery')).toBeNull();
  });

  it('advances one step per reading floor and reports a finding under each', async () => {
    renderScreen();
    expect(doneCount()).toBe(0);
    expect(feedTexts()).toEqual([]);

    await tick(STEP_FLOOR_MS - 1);
    expect(doneCount()).toBe(0);
    await tick(1);
    expect(doneCount()).toBe(1);
    // Two of the four places post hours, and both are open all day.
    expect(feedTexts()).toEqual(['2 places open at 18:00']);
    expect(settledLine()).toBeNull();

    await tick(STEP_FLOOR_MS);
    expect(doneCount()).toBe(2);
    expect(feedTexts()).toEqual(['Starting at Cộng Café']);
    expect(settledLine()).toBe('2 places open at 18:00');

    await tick(STEP_FLOOR_MS);
    expect(feedTexts()).toEqual(['350 m to the next stop, about 5 min']);
    expect(settledLine()).toBe('Starting at Cộng Café');
    expect(legsOf).toHaveBeenCalledWith([CAFE, DINNER]);

    await tick(STEP_FLOOR_MS);
    expect(doneCount()).toBe(4);
    expect(feedTexts()).toEqual(['Your day runs 18:00–20:45']);
  });

  it('takes the starting hour from the first plan when the answers carry none', async () => {
    renderScreen({ startMin: undefined });
    await tick(STEP_FLOOR_MS);
    expect(feedTexts()).toEqual(['2 places open at 18:00']);
  });

  it('closes the running mark into a still ring when the reader asked for less motion', async () => {
    vi.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    renderScreen();
    await tick(0);
    // Still: no track and no travelling arc inside the mark.
    expect(markOf(SKETCH_STEPS[0].en).children.length).toBe(0);
    await tick(STEP_FLOOR_MS * 2);
    expect(feedTexts()).toEqual(['Starting at Cộng Café']);
    expect(settledLine()).toBe('2 places open at 18:00');
  });

  it('draws the running mark as a turning arc over its track otherwise', () => {
    renderScreen();
    expect(markOf(SKETCH_STEPS[0].en).children.length).toBe(2);
    // Pending steps are an empty outline.
    expect(markOf(SKETCH_STEPS[1].en).children.length).toBe(0);
  });
});

describe('leaving', () => {
  const allSteps = STEP_FLOOR_MS * SKETCH_STEPS.length;

  it('replaces itself with PlanOptions, carrying the answers and the seed', async () => {
    const { navigation, route } = renderScreen();
    await tick(allSteps - 1);
    expect(navigation.replace).not.toHaveBeenCalled();
    await tick(1);
    expect(navigation.replace).toHaveBeenCalledTimes(1);
    expect(navigation.replace).toHaveBeenCalledWith('PlanOptions', { ...route.params, seed: NOW.getTime() });
    expect(navigation.navigate).not.toHaveBeenCalled();
    expect(navigation.goBack).not.toHaveBeenCalled();
  });

  it('holds the last step until the words settle, then gives it one more floor', async () => {
    const ask = deferred();
    prefetchNarration.mockImplementation(() => ask.promise);
    const { navigation } = renderScreen();
    await tick(allSteps + 3000);
    expect(doneCount()).toBe(SKETCH_STEPS.length - 1);
    expect(navigation.replace).not.toHaveBeenCalled();

    await act(async () => { ask.resolve(words()); });
    await tick(STEP_FLOOR_MS - 1);
    expect(navigation.replace).not.toHaveBeenCalled();
    await tick(1);
    expect(navigation.replace).toHaveBeenCalledTimes(1);
  });

  it('waits for every plan\'s words, not just the first', async () => {
    const first = deferred();
    const second = deferred();
    prefetchNarration.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const { navigation } = renderScreen();
    await act(async () => { first.resolve(words()); });
    await tick(allSteps + 1000);
    expect(navigation.replace).not.toHaveBeenCalled();
    await act(async () => { second.resolve(words()); });
    await tick(STEP_FLOOR_MS);
    expect(navigation.replace).toHaveBeenCalledTimes(1);
  });

  it('stops holding at the cap when the words never come', async () => {
    prefetchNarration.mockImplementation(() => new Promise(() => {}));
    const { navigation } = renderScreen();
    await tick(NARRATION_HOLD_MS);
    expect(doneCount()).toBe(SKETCH_STEPS.length - 1);
    await tick(STEP_FLOOR_MS - 1);
    expect(navigation.replace).not.toHaveBeenCalled();
    await tick(1);
    expect(navigation.replace).toHaveBeenCalledTimes(1);
  });

  it('treats a failed ask as an answer and moves on without the cap', async () => {
    const ask = deferred();
    prefetchNarration.mockImplementation(() => ask.promise);
    const { navigation } = renderScreen();
    await act(async () => { ask.reject(new Error('model down')); });
    await tick(allSteps);
    expect(navigation.replace).toHaveBeenCalledTimes(1);
  });

  it('holds again when the plans change under a settled hold', async () => {
    // The saved lists land after the catalog: the pins change, so the
    // plans do, and the words settled for the first set say nothing about
    // the second.
    const late = deferred();
    prefetchNarration
      .mockImplementationOnce(async () => words())
      .mockImplementationOnce(async () => words())
      .mockImplementation(() => late.promise);
    const { navigation, rerender, route } = renderScreen({ from: ['mine'] });
    await tick(STEP_FLOOR_MS * 2);
    expect(prefetchNarration).toHaveBeenCalledTimes(2);

    mine.current = [{ slug: 'mine', members: [PINNED] }];
    planTrips.mockImplementation(() => [plan('match', [stop(PINNED, 18 * 60)], [18 * 60, 19 * 60])]);
    rerender(<SketchingScreen navigation={navigation as unknown as Nav} route={route} />);
    expect(prefetchNarration).toHaveBeenCalledTimes(3);

    await tick(allSteps + 2000);
    expect(navigation.replace).not.toHaveBeenCalled();
    await act(async () => { late.resolve(words()); });
    await tick(STEP_FLOOR_MS);
    expect(navigation.replace).toHaveBeenCalledTimes(1);
  });

  it('leaves once, even when the screen re-renders on its way out', async () => {
    const { navigation, rerender, route } = renderScreen();
    await tick(allSteps);
    expect(navigation.replace).toHaveBeenCalledTimes(1);
    // A catalog refresh during the transition: the plans go and come back.
    catalog.current = { data: PLACES, loading: true };
    rerender(<SketchingScreen navigation={navigation as unknown as Nav} route={route} />);
    catalog.current = { data: PLACES, loading: false };
    rerender(<SketchingScreen navigation={navigation as unknown as Nav} route={route} />);
    await tick(STEP_FLOOR_MS);
    expect(navigation.replace).toHaveBeenCalledTimes(1);
  });

  it('never navigates after the reader has left mid-step', async () => {
    const { navigation, unmount } = renderScreen();
    await tick(STEP_FLOOR_MS * 2);
    unmount();
    await tick(allSteps * 2);
    expect(navigation.replace).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('never navigates after the reader has left during the hold, when the words land late', async () => {
    const ask = deferred();
    prefetchNarration.mockImplementation(() => ask.promise);
    const { navigation, unmount } = renderScreen();
    await tick(allSteps);
    unmount();
    await act(async () => { ask.resolve(words()); });
    await tick(NARRATION_HOLD_MS * 2);
    expect(navigation.replace).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('the dead end', () => {
  const allSteps = STEP_FLOOR_MS * SKETCH_STEPS.length;

  it('runs the steps, asks for no words, then says so and offers a category the city has', async () => {
    planTrips.mockImplementation(() => []);
    const { navigation } = renderScreen({ categories: ['eats'] });
    expect(prefetchNarration).not.toHaveBeenCalled();
    expect(screen.queryByText('Nothing to build a day from')).toBeNull();

    await tick(allSteps);
    expect(screen.getByText('Nothing to build a day from')).toBeTruthy();
    expect(screen.queryByText('Sketching your evening…')).toBeNull();
    // Cafés and Views are both in the catalog once; the tie goes by key.
    expect(screen.getByText(
      'Nothing in this city matches those choices for that hour. Cafés has places open — try adding it.',
    )).toBeTruthy();
    expect(screen.queryByText('You can edit everything afterwards.')).toBeNull();
    // The skeleton box is gone: nothing is on its way.
    expect(document.querySelectorAll('[data-icon$="-outline"]').length).toBe(0);
    expect(doneCount()).toBe(SKETCH_STEPS.length);
    expect(navigation.replace).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Change the answers' }));
    expect(navigation.goBack).toHaveBeenCalledTimes(1);
    expect(navigation.navigate).not.toHaveBeenCalled();
    await tick(allSteps);
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it('suggests nothing when the city has nothing else to offer', async () => {
    planTrips.mockImplementation(() => []);
    renderScreen({ categories: ['eats', 'cafes', 'views'] });
    await tick(allSteps);
    expect(screen.getByText(
      'Nothing in this city matches those choices for that hour. Try another day or another part of it.',
    )).toBeTruthy();
  });
});
