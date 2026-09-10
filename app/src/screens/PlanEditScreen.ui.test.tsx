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

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '../uitest/render';
import { todayISO } from '../lib/day';
import { derivedTitle, type Narration } from '../lib/assist';
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
const cityState = vi.hoisted(() => ({ current: { city: { id: 'hanoi' } as { id: string } | null } }));
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
vi.mock('../lib/save', () => ({ useSave: () => ({ mine: { data: mine.current, reload: vi.fn() } }) }));
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

const place = (slug: string, name: string, extra: Partial<Place>): Place => ({
  slug, name_en: name, name_vi: name, name_ja: null, category: 'food', is_featured: false,
  vibe_tags: [], neighborhood_en: 'Hoàn Kiếm', neighborhood_vi: null, neighborhood_ja: null,
  address: null, lat: null, lng: null, ...extra,
} as Place);

// Café and dinner a short walk apart; the rooftop across town, so the last
// leg is a ride and costs a fare.
const CAFE = place('cafe', 'Cộng Café', { categories: ['cafes'], lat: 21.0285, lng: 105.8542, price_vnd: 50000, rating: 4.6 } as Partial<Place>);
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

const nav = () => {
  const parent = { navigate: vi.fn() };
  return {
    navigate: vi.fn(), goBack: vi.fn(), popToTop: vi.fn(), getParent: vi.fn(() => parent), parent,
  } as unknown as Nav & { parent: { navigate: ReturnType<typeof vi.fn> } };
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

/** The row's controls carry glyphs but no names, so they are found by glyph
 *  in document order — row `i`'s up arrow is the `i`th chevron-up. */
const press = (glyph: string, i: number) => {
  const el = document.querySelectorAll(`[data-icon="${glyph}"]`)[i];
  if (!el) throw new Error(`no ${glyph} #${i}`);
  fireEvent.click(el);
};
const names = () => Array.from(document.querySelectorAll('[aria-label^="Open "]'))
  .map((el) => el.getAttribute('aria-label')!.slice('Open '.length));
const save = () => fireEvent.click(screen.getByRole('button', { name: /Save to Trips|Saving…/ }));
type Payload = { stops: { placeSlug: string; arriveMin: number; why: string | null; whyLang: string | null }[] } & Record<string, unknown>;
const payload = () => saveTrip.mock.calls[0][0] as Payload;

beforeEach(() => {
  vi.clearAllMocks();
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
    expect(screen.getByText('Hoàn Kiếm · 90 min')).toBeTruthy();
    expect(screen.getByText('4.6')).toBeTruthy();
    expect(screen.getByText('An easy first stop before the crowds.')).toBeTruthy();
    // The model's name for the evening beats the lens name in the params.
    expect(screen.getByText('Coffee, noodles, skyline')).toBeTruthy();
    expect(screen.queryByText('An evening in the Old Quarter')).toBeNull();
    expect(screen.getByText(/Old Quarter/)).toBeTruthy();
  });

  it('summarises count, window and per-person spend including the ride fare', () => {
    renderScreen();
    // 50k + 200k in prices, plus one 15k ride out to the rooftop.
    expect(screen.getByText('3 stops · 18:00–22:00 · ~265k ₫ / person')).toBeTruthy();
    expect(document.querySelectorAll('[data-icon="walk-outline"]')).toHaveLength(1);
    expect(document.querySelectorAll('[data-icon="car-outline"]')).toHaveLength(1);
    expect(screen.getAllByText(/≈ \d+ min/)).toHaveLength(2);
  });

  it('prints a spend of a million or more in millions', () => {
    planTrips.mockImplementation(() => [plan('classic', [stop({ ...CAFE, price_vnd: 1_240_000 } as Place, 18 * 60, 60)])]);
    renderScreen();
    expect(screen.getByText('1 stop · 18:00–19:00 · ~1.2M ₫ / person')).toBeTruthy();
  });

  it('leaves spend out of the summary when nothing costs anything', () => {
    planTrips.mockImplementation(() => [plan('classic', [stop(ROOF, 20 * 60, 60)])]);
    renderScreen();
    expect(screen.getByText('1 stop · 20:00–21:00')).toBeTruthy();
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
      { seed: 7, startMin: 18 * 60, pinned: [PINNED], avoid: ['old-bar'], taste: null, budgetVnd: 400000 },
    );
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
    expect(screen.getByText('0 stops')).toBeTruthy();
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

  it('moves a stop down and up without moving the evening’s start', () => {
    renderScreen();
    press('chevron-down', 0);
    expect(names()).toEqual(['Bún Chả Hương Liên', 'Cộng Café', 'Sky Bar']);
    expect(screen.getByText('18:00')).toBeTruthy();
    press('chevron-up', 2);
    expect(names()).toEqual(['Bún Chả Hương Liên', 'Sky Bar', 'Cộng Café']);
  });

  it('ignores the up arrow on the first stop and the down arrow on the last', () => {
    renderScreen();
    press('chevron-up', 0);
    press('chevron-down', 2);
    expect(names()).toEqual(['Cộng Café', 'Bún Chả Hương Liên', 'Sky Bar']);
  });

  it('removes a stop and the summary follows', () => {
    renderScreen();
    press('close', 2);
    expect(names()).toEqual(['Cộng Café', 'Bún Chả Hương Liên']);
    // The ride went with the rooftop.
    expect(screen.getByText(/^2 stops · 18:00–.* · ~250k ₫ \/ person$/)).toBeTruthy();
    press('close', 0);
    press('close', 0);
    expect(screen.getByText('Nothing left in this plan.')).toBeTruthy();
  });

  it('retires a model title once the order changes but keeps the sentences', async () => {
    const navigation = renderScreen();
    press('chevron-down', 1);
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
    expect(scheduleTripReminder).toHaveBeenCalledWith(
      { id: 'trip-1', day: todayISO() },
      { title: 'Tomorrow: Coffee, noodles, skyline', body: 'Your plan starts in the morning. Sleep well.' },
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
  });

  it('does not write without a city', async () => {
    cityState.current = { city: null };
    renderScreen();
    expect(screen.getByText('Times and order stay editable after saving.')).toBeTruthy();
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

describe('the header and the crew row', () => {
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

  it('points a plan with company at inviting after Save', () => {
    renderScreen();
    expect(screen.getByText('Just you, for now')).toBeTruthy();
    expect(screen.getByText('Save first, then invite')).toBeTruthy();
  });

  it('says nothing about inviting on a solo plan', () => {
    renderScreen({ company: 'solo' });
    expect(screen.getByText('Just you, for now')).toBeTruthy();
    expect(screen.queryByText('Save first, then invite')).toBeNull();
  });
});
