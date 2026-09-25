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
// And the catalog that never came: a network fault, not a dead end.
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
import { DECK_HOLD_MS, SKETCH_STEPS, STEP_FLOOR_MS } from '../lib/sketch';
import { shortDateline } from '../lib/format';
import { fromISO, todayISO } from '../lib/day';
import type { Place } from '../lib/types';
import type { Nav, RootRoute } from '../nav';

const planTrips = vi.hoisted(() => vi.fn());
const prefetchNarration = vi.hoisted(() => vi.fn());
const legsOf = vi.hoisted(() => vi.fn());
const catalog = vi.hoisted(() => ({
  current: { data: [] as unknown[], loading: false, error: null as Error | null, reload: (() => {}) as () => void },
}));
type FakeCity = { id: string; tz?: string; short_en?: string; short_vi?: string; short_ja?: string | null };
const cityState = vi.hoisted(() => ({ current: { city: { id: 'hanoi' } as FakeCity | null } }));
const mine = vi.hoisted(() => ({ current: [] as unknown[] }));
// One object for the run, as the real hook's memo hands back: a fresh one
// per render would re-plan on every render and restart the words' cap.
const profile = vi.hoisted(() => ({ taste: { cafes: 2 }, budgetVnd: 400000 }));

// A 390pt phone, because the chip row's arithmetic asks the window how
// wide it is and `react-native-web` would otherwise answer with jsdom's
// 1024 — a window no reader has, and one where every category fits.
vi.mock('react-native', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  useWindowDimensions: () => ({ width: 390, height: 844, scale: 3, fontScale: 1 }),
}));

vi.mock('../lib/i18n', () => ({
  useI18n: () => ({ lang: 'en', setLang: () => {}, t: (en: string) => en }),
}));
vi.mock('../lib/catalog', () => ({ usePlaces: () => catalog.current }));
vi.mock('../lib/city', () => ({ useCity: () => cityState.current }));
vi.mock('../lib/save', () => ({ useSave: () => ({ mine: { data: mine.current, reload: vi.fn() } }) }));
vi.mock('../lib/tasteProfile', () => ({
  usePlanProfile: () => profile,
}));
// The deck's timeline, stood in for — for quiet, not for safety.
//
// Safety is `uitest/setup.tsx`, which stands the Supabase client in for
// every test and is asserted by `uitest/network.test.ts`. This file is
// why that guard exists: left real, `reportDeck` reached the real client
// and filed a row, and every run of this suite — CI's included —
// inserted its fixtures into the production `deck_traces` table.
//
// What is left here is the noise. `DECK_TRACE` is hand-held on while the
// deck is being measured, so the real recorder writes a `[deck]` line
// per event to the console, and a screen that walks three plans writes
// seventeen of them per test.
vi.mock('../lib/decktrace', () => ({
  deckTrace: { start: vi.fn(), log: vi.fn(), events: () => [] },
  reportDeck: { reset: vi.fn(), report: vi.fn() },
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
  neighborhood_ja: null, address: null, lat: null, lng: null, opening_hours: null,
  // The cast below hides every field left out, and this one stopped
  // being safe to leave out when the screen started drawing covers:
  // `coverOf` spreads it, so a place without it throws rather than
  // reporting no photo. Real rows always carry the array.
  place_photos: [], ...extra,
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
/**
 * Both of the feed's slots, in the order they are drawn: the dimmed seat
 * first where there is one, then the bright slot.
 *
 * Every row carries the glyph of the fact it states, which is what makes
 * one query enough. It used to be two, because the settled row wore a
 * tick instead of its own glyph and had to be found by it.
 *
 * Scoped to the box, because the glyph is no longer unique to it: the
 * categories above the steps are chips now, and a category's glyph is
 * the same shape of name as a finding's.
 */
const feedTexts = () => [...(document.querySelector('[data-testid="findings"]')
  ?.querySelectorAll('[data-icon$="-outline"]') ?? [])]
  .map((el) => el.parentElement?.nextElementSibling?.textContent ?? '');
/** The bright slot — the fact the screen is stating now. */
const currentLine = () => feedTexts().at(-1) ?? null;
/** The dimmed seat above it, or null while nothing has settled into it. */
const settledLine = () => { const rows = feedTexts(); return rows.length > 1 ? rows[0] : null; };
/** A step row is two columns: the mark and its rail, then the label and
 *  its rule. The label sits inside the second, so everything here starts
 *  from the label's own column. */
const colOf = (label: string) => screen.getByText(label).parentElement!;
/** The mark beside a step label — the first thing in the column before it. */
const markOf = (label: string) =>
  colOf(label).previousElementSibling!.firstElementChild as HTMLElement;
/** The connector under a step's mark, when it has one. */
const railOf = (label: string) => colOf(label).previousElementSibling!.children[1] ?? null;
/** The hairline under a step's label, when it has one. */
const ruleOf = (label: string) => colOf(label).children[1] ?? null;

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ now: NOW });
  planTrips.mockImplementation(() => PLANS);
  prefetchNarration.mockImplementation(async () => words());
  legsOf.mockImplementation(() => [{ mode: 'walk', km: 0.35, minutes: 5 }]);
  catalog.current = { data: PLACES, loading: false, error: null, reload: vi.fn() };
  // Short names too: the facts card falls back to the city's own when
  // the reader gave no place at all.
  cityState.current = { city: { id: 'hanoi', short_en: 'Hanoi', short_vi: 'Hà Nội' } };
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
      at: { lat: 21.03, lng: 105.85 }, atName: null, date: todayISO(), when: 'evening', from: [],
    });
    expect(places).toBe(PLACES);
    expect(cityId).toBe('hanoi');
    expect(opts).toEqual({ seed: NOW.getTime(), startMin: 18 * 60, pinned: [], taste: { cafes: 2 }, budgetVnd: 400000, tz: 'Asia/Ho_Chi_Minh' });
    // A later render does not redraw: every call carries the same seed.
    await tick(STEP_FLOOR_MS * 2);
    expect(new Set(planTrips.mock.calls.map((c) => (c[3] as { seed: number }).seed))).toEqual(new Set([NOW.getTime()]));
  });

  // The planner asks `openState` about seven on Saturday, and builds
  // that instant on the zone it is given — the city's, so a Melbourne
  // evening is not read on Vietnam's clock.
  it('asks the planner on the city’s clock', () => {
    cityState.current = { city: { id: 'melbourne', tz: 'Australia/Melbourne' } };
    renderScreen();
    expect((planTrips.mock.calls[0][3] as { tz: string }).tz).toBe('Australia/Melbourne');
  });

  // Regenerate has no machinery of its own: it sends the reader back here
  // with the next seed and everything already offered, and this screen is
  // the one that waits for the plans and their words. So both have to
  // reach the planner, and a first visit — which has neither — has to go
  // on drawing its own seed.
  it('takes the seed Regenerate gives it rather than drawing one', () => {
    renderScreen({ seed: 4242 });
    expect((planTrips.mock.calls[0][3] as { seed: number }).seed).toBe(4242);
  });

  it('avoids what a previous set already offered', () => {
    renderScreen({ seed: 4242, avoid: ['cafe', 'roof'] });
    expect((planTrips.mock.calls[0][3] as { avoid: string[] }).avoid).toEqual(['cafe', 'roof']);
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
    catalog.current = { data: [], loading: true, error: null, reload: vi.fn() };
    const { navigation, rerender, route } = renderScreen();
    expect(planTrips).not.toHaveBeenCalled();
    await tick(NARRATION_HOLD_MS * 2);
    expect(prefetchNarration).not.toHaveBeenCalled();
    expect(doneCount()).toBe(0);
    expect(navigation.replace).not.toHaveBeenCalled();
    // The skeleton stands in the box until there is a fact to show.
    expect(feedTexts()).toEqual([]);

    catalog.current = { data: PLACES, loading: false, error: null, reload: vi.fn() };
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
  // The date and its half are two ranks now rather than one line joined
  // by a separator, which is what retires the hand-chosen break: each
  // cell sizes itself, so there is no line left to overflow.
  it('names the date, the half and the place as separate ranks', () => {
    renderScreen({ categories: ['cafes', 'mystery'] });
    expect(screen.getByText(shortDateline('en', fromISO(todayISO())!))).toBeTruthy();
    expect(screen.getByText('Evening')).toBeTruthy();
    expect(screen.getByText('Old Quarter')).toBeTruthy();
    // Joined, it is gone: the separator was the thing being replaced.
    expect(screen.queryByText(/ · Evening$/)).toBeNull();
    // An unknown key is dropped rather than printed as a raw slug.
    expect(screen.getByText('Cafés')).toBeTruthy();
    expect(screen.getByText('Plan a trip')).toBeTruthy();
    for (const st of SKETCH_STEPS) expect(screen.getByText(st.en)).toBeTruthy();
  });

  // "Sketching your evening…" is gone: it repeated the screen's own
  // header in the same weight, and the one fact it carried that the
  // header does not — day or evening — is the date cell's second line.
  it('says nothing about sketching, and lets the card carry the half', () => {
    renderScreen();
    expect(screen.queryByText(/^Sketching/)).toBeNull();
    expect(screen.getByText('Evening')).toBeTruthy();
  });

  it('calls a day a day, and prints no category chip when none is known', () => {
    renderScreen({ when: 'day', where: '', categories: ['mystery'] });
    expect(screen.getByText('Day')).toBeTruthy();
    expect(screen.getByText(shortDateline('en', fromISO(todayISO())!))).toBeTruthy();
    expect(screen.queryByText('Mystery')).toBeNull();
  });

  // `where` is absent whenever the reader picked no district, dropped no
  // pin and has not granted location — `canPlan` does not ask for a
  // place, so that plan runs and the planner searches the whole city.
  // The cell says so rather than going missing.
  it('names the city and the width of the search when no place was given', () => {
    renderScreen({ where: null });
    expect(screen.getByText('Hanoi')).toBeTruthy();
    expect(screen.getByText('Anywhere in the city')).toBeTruthy();
  });

  // The one case left with nothing to say: no place and no city either.
  it('draws the date alone when there is no city to fall back on', () => {
    cityState.current = { city: null };
    renderScreen({ where: null });
    expect(screen.getByText(shortDateline('en', fromISO(todayISO())!))).toBeTruthy();
    expect(screen.queryByText('Anywhere in the city')).toBeNull();
  });

  // `p.where` arrives joined and sometimes carries its own separator. The
  // cell splits on it rather than printing it, so the default reads as
  // two ranks the way a district reads as one.
  it('splits a where that carries its own separator', () => {
    renderScreen({ where: 'Around Melbourne · Near you' });
    expect(screen.getByText('Around Melbourne')).toBeTruthy();
    expect(screen.getByText('Near you')).toBeTruthy();
    expect(screen.queryByText('Around Melbourne · Near you')).toBeNull();
  });

  // Nine categories exist and nothing caps the choosing, so the row is
  // bounded by what fits rather than by a number. On a 390pt phone that
  // is two chips and a count once the count itself needs room: three
  // chips are 276pt of the 318 a card leaves, and the pill wants 50 more.
  it('draws what fits and counts the rest', () => {
    renderScreen({ categories: ['cafes', 'eats', 'views', 'nature', 'nightlife'] });
    expect(screen.getByText('Cafés')).toBeTruthy();
    expect(screen.getByText('Eats')).toBeTruthy();
    expect(screen.queryByText('Views')).toBeNull();
    expect(screen.queryByText('Nature')).toBeNull();
    expect(screen.queryByText('Nightlife')).toBeNull();
    expect(screen.getByText('+3')).toBeTruthy();
  });

  // And the common case keeps all of them, because with no pill to make
  // room for, three fit. A fixed cap would have been right here and wrong
  // in the test above.
  it('counts nothing when three is all there is', () => {
    renderScreen({ categories: ['cafes', 'eats', 'views'] });
    expect(screen.getByText('Cafés')).toBeTruthy();
    expect(screen.getByText('Eats')).toBeTruthy();
    expect(screen.getByText('Views')).toBeTruthy();
    expect(screen.queryByText(/^\+/)).toBeNull();
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
    expect(currentLine()).toBe('2 places open at 18:00');
    expect(settledLine()).toBeNull();

    await tick(STEP_FLOOR_MS);
    expect(doneCount()).toBe(2);
    expect(currentLine()).toBe('Starting at Cộng Café');
    expect(settledLine()).toBe('2 places open at 18:00');

    await tick(STEP_FLOOR_MS);
    expect(currentLine()).toBe('350 m to the next stop, about 5 min');
    expect(settledLine()).toBe('Starting at Cộng Café');
    expect(legsOf).toHaveBeenCalledWith([CAFE, DINNER]);

    await tick(STEP_FLOOR_MS);
    expect(doneCount()).toBe(4);
    expect(currentLine()).toBe('Your day runs 18:00–20:45');
  });

  // Measured, not reasoned. The deck filed its own timeline and it showed
  // the first set of photographs being replaced 557ms into the first
  // option — no option change to announce it, and the set it replaced
  // coming back two seconds later as the third of three. Four sets of
  // pictures for three plans, one of them a repeat.
  //
  // `planTrips` re-runs whenever the catalog, the saved lists or the
  // taste profile land, and all three arrive asynchronously; the note on
  // the narration hold has named that since before this screen drew
  // anything. What was new was that the pictures were paying for it too.
  it('walks the plans it started with, not the ones that land mid-hold', async () => {
    const LATER = place('later', 'Late Arrival', { opening_hours: ALL_WEEK } as Partial<Place>);
    const { navigation, rerender, route } = renderScreen();
    expect(screen.getByText('Cộng Café')).toBeTruthy();

    // The saved lists land and the day is drawn again, differently.
    planTrips.mockImplementation(() => [plan('match', [stop(LATER, 18 * 60)], [18 * 60, 19 * 60])]);
    catalog.current = { data: [...PLACES, LATER], loading: false, error: null, reload: vi.fn() };
    rerender(<SketchingScreen navigation={navigation as unknown as Nav} route={route} />);
    // Past the hold and past the swap the hold releases, which is
    // staggered and then waits on the word's dip.
    await tick(DECK_HOLD_MS + 500);

    // The deck is still walking the set it opened with.
    expect(screen.queryByText('Late Arrival')).toBeNull();
    expect(screen.getByText('Sky Bar')).toBeTruthy();
  });

  // The ring that used to stand here said the screen was working. Three
  // covers say what it is working on, which is the same wait spent
  // looking at your own day.
  it('shows the plan it has drawn, one card a place, three at most', () => {
    renderScreen();
    // `PLANS[0]` has two stops, so two cards — not a padded three.
    expect(screen.getByText('Cộng Café')).toBeTruthy();
    expect(screen.getByText('Bún Chả Hương Liên')).toBeTruthy();
    // The second plan's stop is not in the deck; this is one plan's day.
    expect(screen.queryByText('Sky Bar')).toBeNull();
  });

  // One plan at a time. It used to draw `plans[0]` and stop there, which
  // spoiled the first card of the screen after it and never mentioned
  // that two more ways existed.
  it('walks the deck from one plan to the next on its own clock', async () => {
    renderScreen();
    // `PLANS` is two: the first has Cộng Café and Bún Chả, the second Sky Bar.
    expect(screen.getByText('Cộng Café')).toBeTruthy();
    expect(screen.queryByText('Sky Bar')).toBeNull();

    await tick(DECK_HOLD_MS + 500);
    expect(screen.getByText('Sky Bar')).toBeTruthy();
    expect(screen.queryByText('Cộng Café')).toBeNull();
  });

  it('holds the deck on the first plan when the reader asked for less motion', async () => {
    vi.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    renderScreen();
    await tick(DECK_HOLD_MS + 500);
    // Content that changes itself is what that setting exists to stop.
    expect(screen.getByText('Cộng Café')).toBeTruthy();
    expect(screen.queryByText('Sky Bar')).toBeNull();
  });

  it('caps the deck at three, however many stops the plan has', () => {
    planTrips.mockImplementation(() => [plan('match', [
      stop(CAFE, 18 * 60), stop(DINNER, 19 * 60), stop(ROOF, 20 * 60), stop(PINNED, 21 * 60),
    ], [18 * 60, 22 * 60])]);
    renderScreen();
    expect(screen.getByText('Cộng Café')).toBeTruthy();
    expect(screen.getByText('Bún Chả Hương Liên')).toBeTruthy();
    expect(screen.getByText('Sky Bar')).toBeTruthy();
    // A fourth would shrink all of them below reading size, so the plan
    // keeps the stop and the deck does not show it.
    expect(screen.queryByText('Collection Pick')).toBeNull();
  });

  it("draws the place's cover when it has one", () => {
    const shot = { photo_uri: 'https://example.test/cafe.jpg', is_cover: true, is_hidden: false, sort_order: 0 };
    planTrips.mockImplementation(() => [
      plan('match', [stop({ ...CAFE, place_photos: [shot] } as Place, 18 * 60)], [18 * 60, 19 * 60]),
    ]);
    renderScreen();
    const img = document.querySelector('img');
    expect(img?.getAttribute('src')).toBe(shot.photo_uri);
  });

  it('takes the starting hour from the first plan when the answers carry none', async () => {
    renderScreen({ startMin: undefined });
    await tick(STEP_FLOOR_MS);
    expect(currentLine()).toBe('2 places open at 18:00');
  });

  // Five circles down a card read as five things. A line through them
  // reads as one thing happening in order, which is what is happening.
  it('joins the step marks with a rail, and stops it at the last', () => {
    renderScreen();
    for (const st of SKETCH_STEPS.slice(0, -1)) {
      expect(railOf(st.en), `${st.key} should reach the next mark`).toBeTruthy();
    }
    // Nothing below the final step for a rail to reach.
    expect(railOf(SKETCH_STEPS[SKETCH_STEPS.length - 1].en)).toBeNull();
  });

  // The rail and the rule are two separators in one row, so they are
  // given different axes and different colours: the rail is the thread
  // through the sequence, the rule is only the row's floor. The rule is
  // inset to the label, so the thread runs past it rather than being
  // crossed out at every step.
  it('floors every step but the last with a rule, inset beside the rail', () => {
    renderScreen();
    for (const st of SKETCH_STEPS.slice(0, -1)) {
      expect(ruleOf(st.en), `${st.key} should be floored`).toBeTruthy();
    }
    expect(ruleOf(SKETCH_STEPS[SKETCH_STEPS.length - 1].en)).toBeNull();
  });

  it('closes the running mark into a still ring when the reader asked for less motion', async () => {
    vi.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    renderScreen();
    await tick(0);
    // Still: no track and no travelling arc inside the mark.
    expect(markOf(SKETCH_STEPS[0].en).children.length).toBe(0);
    await tick(STEP_FLOOR_MS * 2);
    expect(currentLine()).toBe('Starting at Cộng Café');
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

  // The deck and the stages are on different clocks on purpose, so the
  // one thing that keeps a plan from never being shown is this: the
  // screen waits for whichever of the two finishes last. Two plans take
  // less than the stages do, so it takes four to see the gate hold.
  it('waits for the deck to finish its plans, not only for the stages', async () => {
    const four = [MATCH, ICONIC, MATCH, ICONIC];
    planTrips.mockImplementation(() => four);
    const { navigation } = renderScreen();
    await tick(allSteps);
    // Stages done; the deck is still two plans from the end.
    expect(navigation.replace).not.toHaveBeenCalled();
    await tick(DECK_HOLD_MS * 3);
    expect(navigation.replace).toHaveBeenCalledTimes(1);
  });

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

  // The next screen rebuilds the plans from pure inputs, so it needs every
  // input that produced them. The seed alone is not enough after a
  // Regenerate: the same seed without the avoid-list is a different draw.
  it('carries a Regenerate’s seed and avoid-list on to PlanOptions', async () => {
    const avoid = ['cafe', 'roof'];
    const { navigation } = renderScreen({ seed: 4242, avoid });
    await tick(allSteps);
    expect(navigation.replace).toHaveBeenCalledWith(
      'PlanOptions', expect.objectContaining({ seed: 4242, avoid }),
    );
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
    catalog.current = { data: PLACES, loading: true, error: null, reload: vi.fn() };
    rerender(<SketchingScreen navigation={navigation as unknown as Nav} route={route} />);
    catalog.current = { data: PLACES, loading: false, error: null, reload: vi.fn() };
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
    // The skeleton box is gone: nothing is on its way.
    expect(feedTexts()).toEqual([]);
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

describe('when the catalog could not load', () => {
  const allSteps = STEP_FLOOR_MS * SKETCH_STEPS.length;

  it('says the places did not load and offers a retry, not the dead end', async () => {
    planTrips.mockImplementation(() => []);
    const reload = vi.fn();
    catalog.current = { data: [], loading: false, error: new Error('offline'), reload };
    const { navigation } = renderScreen();

    await tick(allSteps);
    expect(screen.getByText("Couldn't load places")).toBeTruthy();
    expect(screen.getByText('Check your connection and try again. Your answers are kept.')).toBeTruthy();
    expect(screen.queryByText('Nothing to build a day from')).toBeNull();
    expect(screen.queryByText(/Nothing in this city matches/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Change the answers' })).toBeNull();
    // The steps stop where the work stopped: nothing past reading the picks is done.
    expect(doneCount()).toBe(0);
    expect(navigation.replace).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('carries on to the plans once a retry brings the catalog in', async () => {
    catalog.current = { data: [], loading: false, error: new Error('offline'), reload: vi.fn() };
    const { navigation, rerender, route } = renderScreen();
    await tick(allSteps);
    expect(screen.getByText("Couldn't load places")).toBeTruthy();

    catalog.current = { data: PLACES, loading: false, error: null, reload: vi.fn() };
    rerender(<SketchingScreen navigation={navigation as unknown as Nav} route={route} />);
    expect(screen.queryByText("Couldn't load places")).toBeNull();
    await tick(allSteps + STEP_FLOOR_MS);
    expect(navigation.replace).toHaveBeenCalledWith('PlanOptions', expect.objectContaining({ where: 'Old Quarter' }));
  });

  it('plans from what is cached when a refresh fails', async () => {
    catalog.current = { data: PLACES, loading: false, error: new Error('offline'), reload: vi.fn() };
    const { navigation } = renderScreen();
    expect(screen.queryByText("Couldn't load places")).toBeNull();
    await tick(allSteps + STEP_FLOOR_MS);
    expect(navigation.replace).toHaveBeenCalledTimes(1);
  });
});
