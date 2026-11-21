// @vitest-environment jsdom
//
// The trips you saved, rendered for real.
//
// What is pinned: that the tab is a different question signed out; that it
// reloads on its very first focus (the bug the harness's `useFocusEffect`
// mock happens to make provable — it treats mount as the only focus a
// tree that is never blurred can have); that the list splits into what is
// coming and what has been, soonest first and most recent first; that a
// card summarises three stops and defers the rest, prints a gap for a
// place that left the catalog, names the city only when a second one
// appears, and opens the detail; that an invitation rides above the plans
// with its own heading, that answering reaches the write and reloads both
// lists, and that a refusal is said rather than swallowed; and that a
// failed read is the body when there is nothing and a banner when there
// is. The splits (`splitTrips`, `splitByStanding`, `sortInvites`) and the
// formatting stay real; the reads, the write and the invite card are
// stood in for.
//
// This file was one test for half a year, and the screen sat at 41% with
// the aggregate floor never noticing — the case the per-file floor in
// `vitest.config.ts` exists for.

import React from 'react';
import { dropResume, takeResume } from '../lib/resume';
beforeEach(() => { dropResume(); });
import { Alert } from 'react-native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, pullControl, render, screen, textStyleOf, viewStyleOf, waitFor } from '../uitest/render';
import { useScrollToTop } from '@react-navigation/native';
import { addDays, fromISO, todayISO } from '../lib/day';
import { dateline } from '../lib/format';
import type { Trip, TripStopRow } from '../lib/data';
import type { InviteRow } from '../lib/invites';
import type { Place } from '../lib/types';
import type { Nav } from '../nav';

const state = vi.hoisted(() => ({
  uid: 'u1' as string | null,
  trips: { loaded: true, error: null as string | null, data: [] as Trip[] },
  invites: [] as InviteRow[],
  credit: false,
}));
const spies = vi.hoisted(() => ({
  tripsReload: vi.fn(),
  invitesReload: vi.fn(),
  answerInvite: vi.fn(async (_id: string, _said: string) => {}),
}));

vi.mock('../lib/auth', () => {
  const m = {
    useAuth: () => ({ session: state.uid ? { user: { id: state.uid } } : null }),
  };
  const all = () => (m as { useAuth: () => object }).useAuth();
  return { ...m, useSession: all, useProfile: all, useAuthActions: all, useAuthEvent: () => {} };
});
vi.mock('../lib/city', () => {
  const m = {
    useCity: () => ({
      cities: [
        { id: 'hanoi', short_en: 'Hanoi', short_vi: 'Hà Nội', short_ja: 'ハノイ' },
        { id: 'saigon', short_en: 'Saigon', short_vi: 'Sài Gòn', short_ja: 'サイゴン' },
      ],
    }),
  };
  const all = () => (m as { useCity: () => object }).useCity();
  return { ...m, useCurrentCity: all, useCityList: all };
});
vi.mock('../lib/i18n', () => ({
  useI18n: () => ({ lang: 'en', setLang: () => {}, t: (en: string) => en }),
}));
vi.mock('../lib/useFlag', () => ({ useFlag: () => state.credit }));
vi.mock('../lib/mytrips', () => ({
  useMyTrips: () => ({
    ...state.trips, loading: !state.trips.loaded, loadedAt: null, fromCache: false, reload: spies.tripsReload,
  }),
}));
vi.mock('../lib/crew', () => ({
  useCrew: () => ({ people: { lan: { id: 'lan', handle: 'lanphuong', full_name: 'Lan Phương', avatar_url: '' } } }),
}));
vi.mock('../lib/invitations', () => ({
  useInvitations: () => ({ invites: { data: state.invites, loaded: true, loading: false, error: null, reload: spies.invitesReload } }),
}));
vi.mock('../lib/data', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  answerInvite: spies.answerInvite,
}));
// The card is its own component with its own tests; what this screen owes
// it is the right trip, the right sender, and the two answers wired
// through. A stub that exposes exactly those is enough to say so.
vi.mock('../components/InviteCard', async () => {
  const R = await import('react');
  return {
    default: (p: {
      trip: { id: string; title: string }; from: { handle: string } | null; busy: boolean;
      onOpen: () => void; onAnswer: (a: 'accepted' | 'declined') => void;
    }) => R.createElement('div', { 'data-testid': `invite-${p.trip.id}`, 'data-busy': String(p.busy) },
      R.createElement('span', null, `${p.trip.title} from ${p.from?.handle ?? 'someone'}`),
      R.createElement('button', { type: 'button', onClick: p.onOpen }, `open ${p.trip.id}`),
      R.createElement('button', { type: 'button', onClick: () => p.onAnswer('accepted') }, `accept ${p.trip.id}`),
      R.createElement('button', { type: 'button', onClick: () => p.onAnswer('declined') }, `decline ${p.trip.id}`)),
  };
});

import TripsScreen from './TripsScreen';
import { colors, font, space } from '../theme';

const alert = vi.spyOn(Alert, 'alert').mockImplementation(() => {});

const place = (over: Partial<Place> = {}): Place => ({
  slug: 'pho-10', name_en: 'Pho 10', name_vi: 'Phở 10', name_ja: null,
  category: 'food', categories: ['eats'], is_featured: false,
  neighborhood_en: 'Hoan Kiem', price_vnd: 60_000, place_photos: [],
  ...over,
} as unknown as Place);

const stop = (places: Place | null, over: Partial<TripStopRow> = {}): TripStopRow => ({
  sort_order: 0, arrive_min: null, dwell_min: null, why: null, why_lang: null, places, ...over,
});

const TODAY = todayISO();
const SOON = addDays(TODAY, 3);
const GONE = addDays(TODAY, -3);

const trip = (over: Partial<Trip> = {}): Trip => ({
  id: 't1', owner_id: 'u1', city_id: 'hanoi', title: 'Old Quarter crawl',
  company: 'friends', categories: [], district: null, day: SOON,
  when_part: 'evening', generated_by: 'model', created_at: '2026-09-01T00:00:00Z',
  trip_stops: [
    stop(place(), { arrive_min: 18 * 60 }),
    stop(place({ slug: 'cafe', name_en: 'Cafe Giang', neighborhood_en: 'Ba Dinh', price_vnd: 35_000 }), { sort_order: 1, arrive_min: 19 * 60 }),
  ],
  ...over,
} as unknown as Trip);

const invite = (over: Partial<InviteRow> = {}): InviteRow => ({
  trip_id: 'asked-1', invitee_id: 'u1', inviter_id: 'lan', status: 'pending',
  created_at: '2026-09-10T00:00:00Z', ...over,
});

type NavPlus = Nav & { navigate: ReturnType<typeof vi.fn>; parent: { navigate: ReturnType<typeof vi.fn> } };
const nav = (): NavPlus => {
  const parent = { navigate: vi.fn() };
  return {
    navigate: vi.fn(), goBack: vi.fn(), replace: vi.fn(), popToTop: vi.fn(),
    getParent: () => parent, parent,
  } as unknown as NavPlus;
};

const show = (trips: Trip[] = [], over: Partial<typeof state.trips> = {}) => {
  state.trips = { loaded: true, error: null, data: trips, ...over };
  const n = nav();
  render(<TripsScreen navigation={n} />);
  return n;
};
const text = () => document.body.textContent ?? '';
/** A tab by its word; its aria-label carries the figure, when there is one. */
const tab = (name: RegExp) => screen.getByRole('tab', { name });
/** The chosen tab: the web stub drops `selected`, so it is read the way a
 *  reader reads it — the one word set apart from the others (a weight
 *  heavier and in ink, see `WordTabs`), here by its style class. */
const chosen = () => {
  const all = screen.getAllByRole('tab');
  const look = (el: HTMLElement) => el.querySelector('[dir="auto"]')!.className;
  const on = all.filter((el) => all.filter((o) => look(o) === look(el)).length === 1);
  return on.length === 1 ? on[0].getAttribute('aria-label') : undefined;
};
const tabs = () => screen.getAllByRole('tab').map((el) => el.getAttribute('aria-label'));

beforeEach(() => {
  state.uid = 'u1';
  state.invites = [];
  state.credit = false;
  spies.tripsReload.mockClear();
  spies.invitesReload.mockClear();
  spies.answerInvite.mockClear();
  spies.answerInvite.mockImplementation(async () => {});
  alert.mockClear();
});
afterEach(cleanup);

describe('signed out', () => {
  it('lets guests open the planner without starting an authentication flow', () => {
    state.uid = null;
    const n = show([]);
    fireEvent.click(screen.getByRole('button', { name: 'Try planning a trip' }));
    expect(n.parent.navigate).toHaveBeenCalledExactlyOnceWith('Ideas', { screen: 'IdeasHome' });
    expect(takeResume(Date.now())).toBeNull();
  });

  it('offers returning users sign-in and remembers the Trips destination', () => {
    state.uid = null;
    const n = show([trip()]);
    expect(screen.getByText('Where to next?')).toBeTruthy();
    expect(screen.queryByText('Old Quarter crawl')).toBeNull();
    expect(screen.queryByText('No trips yet')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(n.parent.navigate).toHaveBeenCalledWith('Profile', { screen: 'SignIn', initial: false });
    expect(takeResume(Date.now())?.tab).toBe('Trips');
  });
});

describe('the first focus', () => {
  // The regression: this used to be `.not.toHaveBeenCalled()` on the first
  // mount, on purpose — a trip saved in another tab and landed on here for
  // this session's first-ever look at Trips showed the launch snapshot
  // until the reader left and returned.
  it('reloads on the very first focus, not just the second', () => {
    show([], { loaded: false });
    expect(spies.tripsReload).toHaveBeenCalled();
  });

  // Whether a friend has said yes is the one thing another person changes
  // (owner, 21 Nov 2026): it used to wait for the phone to come back from
  // the background.
  it('reads the invitations again on focus, since a friend may have answered', () => {
    show([trip()]);
    expect(spies.invitesReload).toHaveBeenCalled();
  });

  it('holds skeletons, not the list, until the read has settled', () => {
    show([trip()], { loaded: false });
    expect(screen.queryByText('Old Quarter crawl')).toBeNull();
    expect(screen.queryByText('No trips yet')).toBeNull();
  });
});

describe('pulling the list down', () => {
  it('reads the trips and the invitations again', () => {
    show([trip()]);
    spies.tripsReload.mockClear();
    spies.invitesReload.mockClear();
    act(() => { pullControl().onRefresh(); });
    expect(spies.tripsReload).toHaveBeenCalledTimes(1);
    expect(spies.invitesReload).toHaveBeenCalledTimes(1);
  });
});

describe('nothing saved yet', () => {
  it('offers to plan the first trip, from the card and not the header', () => {
    const n = show([]);
    expect(screen.getByText('No trips yet')).toBeTruthy();
    // The owner's sentence (25 Oct 2026), not a count of questions and a
    // tab's name.
    expect(screen.getByText('Pick a few options and the app will suggest a trip that suits you.')).toBeTruthy();
    expect(screen.queryByText(/four questions/)).toBeNull();
    // One invitation to do one thing: the header pill waits for a list.
    expect(screen.queryByRole('button', { name: 'New trip' })).toBeNull();
    // And no switch between three empty rooms.
    expect(screen.queryAllByRole('tab')).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Plan a trip' }));
    expect(n.parent.navigate).toHaveBeenCalledWith('Ideas');
  });

  // Not a bare card on a bare page: the offers Activity makes on its own
  // empty screen, each to the tab or room it names.
  it('offers what a trip is made of under the card, each to where it says', () => {
    const n = show([]);
    expect(screen.getByText('You could try')).toBeTruthy();
    expect(screen.getByTestId('trips-try')).toBeTruthy();
    fireEvent.click(screen.getByTestId('trips-try-explore'));
    expect(n.parent.navigate).toHaveBeenLastCalledWith('Explore');
    fireEvent.click(screen.getByTestId('trips-try-save'));
    expect(n.parent.navigate).toHaveBeenLastCalledWith('Collections', { screen: 'CollectionsHome', params: { tab: 'yours', at: expect.any(Number) } });
    fireEvent.click(screen.getByTestId('trips-try-crew'));
    expect(n.parent.navigate).toHaveBeenLastCalledWith('Profile', { screen: 'Crew', initial: false });
  });

  // The card is the shared one, inside the list's padding and not a
  // second margin in from the title (owner's screenshot, 20 Nov 2026).
  it('draws the shared empty card, with no margin of its own', () => {
    show([]);
    const card = viewStyleOf(screen.getByTestId('trips-empty'));
    expect(card.marginHorizontal ?? 0).toBe(0);
    expect(card.marginLeft ?? 0).toBe(0);
  });

  // The owner's review against the Plan screen (21 Nov 2026): the rows keep
  // the lane every card's rows have, so the chevron is off the edge; the
  // heading is the Plan screen's size; and the glyphs are the outline ones
  // of the tab, with the planner's own paw on the button.
  it('draws the rows in a lane, the heading at the Plan screen’s size, and the tab’s own glyphs', () => {
    show([]);
    expect(viewStyleOf(screen.getByTestId('trips-try')).paddingHorizontal).toBe(space.cardPadding);
    expect(textStyleOf(screen.getByText('You could try'))?.fontSize).toBe(20);
    const empty = screen.getByTestId('trips-empty');
    expect(empty.querySelector('[data-icon="calendar-outline"]')).toBeTruthy();
    expect(empty.querySelector('[data-icon="map"]')).toBeNull();
    expect(empty.querySelector('[data-icon="paw"]')).toBeTruthy();
    expect(empty.querySelector('[data-icon="sparkles"]')).toBeNull();
  });

  it('offers no other things to try once there is a list', () => {
    show([trip()]);
    expect(screen.queryByTestId('trips-try')).toBeNull();
  });

  it('offers the header pill once there is a list, and it leads to Ideas too', () => {
    const n = show([trip()]);
    expect(screen.queryByText('No trips yet')).toBeNull();
    // Quiet: the header's weight, not the gradient (owner, 26 Oct 2026).
    expect(screen.getByRole('button', { name: 'New trip' }).querySelector('[data-stub="LinearGradient"]')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'New trip' }));
    // The header's plus on its disc, lowered to the large title's capitals.
    {
      const plus = screen.getByRole('button', { name: 'New trip' });
      expect(plus.querySelector('[data-icon="add"]')!.getAttribute('data-size')).toBe('22');
      const box = [plus, plus.parentElement!].map((el) => getComputedStyle(el).marginBottom);
      expect(box).toContain('-3px');
    }
    expect(n.parent.navigate).toHaveBeenCalledWith('Ideas');
  });
});

// UX-09: Profile's Trips count lands here with a fresh `at`, and the list
// starts from its top rather than where the reader last left it.
describe('arriving from Profile', () => {
  it('scrolls back to the top on a fresh `at`, and not otherwise', () => {
    state.trips = { loaded: true, error: null, data: [trip({ day: SOON })] };
    const n = nav();
    const { rerender } = render(<TripsScreen navigation={n} />);
    // The innermost one: with a pull wired, the list sits in a wrapper that
    // also carries the scroller's class, and it is the inner node that scrolls.
    const scroller = [...document.querySelectorAll('div')].filter((d) => getComputedStyle(d).overflowY === 'auto' || d.className.includes('overflowY')).at(-1)!;
    scroller.scrollTop = 300;
    rerender(<TripsScreen navigation={n} route={{ params: {} }} />);
    expect(scroller.scrollTop).toBe(300);
    rerender(<TripsScreen navigation={n} route={{ params: { at: 1 } }} />);
    expect(scroller.scrollTop).toBe(0);
    scroller.scrollTop = 300;
    rerender(<TripsScreen navigation={n} route={{ params: { at: 2 } }} />);
    expect(scroller.scrollTop).toBe(0);
  });
});

describe('the tabs', () => {
  it('splits invitations, what is coming and what has been, each with its figure, soonest and most recent first', () => {
    show([
      trip({ id: 'far', title: 'Far ahead', day: addDays(TODAY, 10) }),
      trip({ id: 'old', title: 'Long ago', day: addDays(TODAY, -30) }),
      trip({ id: 'soon', title: 'Soon', day: SOON }),
      trip({ id: 'last', title: 'Last week', day: GONE }),
    ]);
    // Zero draws no pill: Invites says nothing about a count it does not have.
    expect(tabs()).toEqual(['Invites', 'Upcoming (2)', 'Past (2)']);
    expect(chosen()).toBe('Upcoming (2)');
    const ahead = ['Soon', 'Far ahead'].map((s) => text().indexOf(s));
    expect(ahead.every((i) => i >= 0)).toBe(true);
    expect([...ahead].sort((a, b) => a - b)).toEqual(ahead);
    expect(screen.queryByText('Last week')).toBeNull();
    fireEvent.click(tab(/Past/));
    const behind = ['Last week', 'Long ago'].map((s) => text().indexOf(s));
    expect(behind.every((i) => i >= 0)).toBe(true);
    expect([...behind].sort((a, b) => a - b)).toEqual(behind);
    expect(screen.queryByText('Soon')).toBeNull();
    // The old caption headings and the lede over them are gone with the scroll they divided.
    expect(screen.queryByText(/ · \d+$/)).toBeNull();
    expect(screen.queryByText('Your journeys')).toBeNull();
  });

  // UX-10, as tabs: an account whose trips are all behind it opens on
  // them, not on an empty Upcoming that hides the only list there is.
  it('opens on Past when nothing is ahead, and says so on Upcoming', () => {
    show([trip({ day: GONE })]);
    expect(chosen()).toBe('Past (1)');
    expect(tab(/Upcoming/).getAttribute('aria-label')).toBe('Upcoming');
    fireEvent.click(tab(/Upcoming/));
    const none = screen.getByTestId('trips-none-upcoming');
    expect(none.textContent).toBe('No upcoming trips');
    expect(none.querySelector('[data-icon="calendar-outline"]')).toBeTruthy();
    // No second offer to plan: the header's pill is the one.
    expect(none.querySelector('button')).toBeNull();
  });

  it('says how a trip reaches Past while nothing has', () => {
    show([trip({ day: SOON })]);
    expect(chosen()).toBe('Upcoming (1)');
    fireEvent.click(tab(/Past/));
    expect(screen.getByTestId('trips-none-past').textContent).toBe('Trips move here once their day is over');
  });

  it('says where an invitation comes from while none is waiting', () => {
    show([trip()]);
    fireEvent.click(tab(/Invites/));
    const none = screen.getByTestId('trips-none-invites');
    expect(none.textContent).toBe('When a friend invites you on a trip, it shows up here');
    expect(none.querySelector('[data-icon="mail-outline"]')).toBeTruthy();
  });

  // The greeting is decided once: a reload that changes what is in each
  // half does not move the tab under a reader who chose one.
  it('keeps the tab the reader chose across a reload', () => {
    state.trips = { loaded: true, error: null, data: [trip({ day: SOON })] };
    const n = nav();
    const { rerender } = render(<TripsScreen navigation={n} />);
    fireEvent.click(tab(/Past/));
    state.trips = { loaded: true, error: null, data: [trip({ day: GONE })] };
    rerender(<TripsScreen navigation={n} />);
    expect(chosen()).toBe('Past (1)');
  });

  // Today is still upcoming: an evening you are on does not become a
  // memory at midnight.
  it('keeps today’s trip among the upcoming ones', () => {
    show([trip({ day: TODAY, trip_stops: [stop(place(), { arrive_min: 23 * 60 + 59 })] })]);
    expect(tabs()).toEqual(['Invites', 'Upcoming (1)', 'Past']);
  });

  it('opens a trip on its detail', () => {
    const n = show([trip()]);
    fireEvent.click(screen.getByTestId('trip-upcoming-0'));
    expect(n.navigate).toHaveBeenCalledWith('TripDetail', { id: 't1' });
  });

  // A trip already taken opens the same way; only an upcoming one had
  // ever been tapped.
  it('opens a past trip on its detail', () => {
    const n = show([trip({ id: 'old', title: 'Last week', day: GONE })]);
    fireEvent.click(screen.getByTestId('trip-past-0'));
    expect(n.navigate).toHaveBeenCalledWith('TripDetail', { id: 'old' });
  });

  // A day the app cannot read is printed as it was stored, not dropped.
  it('prints a day it cannot read as it is written', () => {
    show([trip({ day: 'sometime' })]);
    expect(text()).toContain('sometime');
  });
});

describe('the card', () => {
  it('prints the date, and the stops with their hours and areas', () => {
    show([trip()]);
    // The first stop's hour is printed once, on the stop, not again on
    // the date's line (owner, 24 Oct 2026).
    expect(text()).not.toMatch(/from 18:00/);
    expect(screen.getByText('18:00')).toBeTruthy();
    expect(screen.getByText('19:00')).toBeTruthy();
    expect(screen.getByText('Pho 10')).toBeTruthy();
    expect(screen.getByText('Ba Dinh')).toBeTruthy();
    // The wizard's answer, beside the date.
    expect(screen.getByText('Friends')).toBeTruthy();
    expect(screen.getByText('View plan')).toBeTruthy();
  });

  // Three stops show whole; a day out shows its shape and says what is
  // missing, and the detail is where the rest lives.
  it('shows three stops and says how many more there are', () => {
    const five = Array.from({ length: 5 }, (_, i) =>
      stop(place({ slug: `s${i}`, name_en: `Stop ${i}` }), { sort_order: i, arrive_min: (9 + i) * 60 }));
    show([trip({ trip_stops: five })]);
    expect(screen.getByText('Stop 2')).toBeTruthy();
    expect(screen.queryByText('Stop 3')).toBeNull();
    expect(screen.getByText('+2 more')).toBeTruthy();
  });

  // A place that left the catalog is a gap, not a silent drop: the reader
  // picked five stops, and a list of four with no explanation is the app
  // losing something in front of them.
  it('draws a gap for a place that is no longer listed, and a dash for a stop with no hour', () => {
    show([trip({ trip_stops: [stop(null), stop(place(), { sort_order: 1 })] })]);
    expect(screen.getByText('No longer listed')).toBeTruthy();
    expect(screen.getAllByText('—')).toHaveLength(2);
    expect(text()).not.toMatch(/from/);
  });

  it('wears the cover, and the photographer’s credit only when the switch is on', () => {
    const shot = place({ place_photos: [{ id: 'p', photo_uri: 'https://cdn/x.jpg', is_cover: true, is_hidden: false, sort_order: 0, attribution_name: 'Bởi Minh' }] });
    show([trip({ trip_stops: [stop(shot)] })]);
    expect(document.querySelector('img')?.getAttribute('src')).toBe('https://cdn/x.jpg');
    expect(screen.queryByText('Bởi Minh')).toBeNull();
    cleanup();
    state.credit = true;
    show([trip({ trip_stops: [stop(shot)] })]);
    expect(screen.getByText('Bởi Minh')).toBeTruthy();
  });

  // UX-11: the title shared its row with the company chip and was cut to
  // one line, so "A morning of coffee in Yên Hòa" read "A morning of
  // coffee in…" — the place, the part that tells 55 trips apart, was the
  // part cut. It gets the row and two lines; the chip goes to the date.
  it('gives the title its own row, up to two lines, and puts the company beside the date', () => {
    show([trip({ title: 'A morning of coffee in Yên Hòa', company: 'friends' })]);
    const title = screen.getByText('A morning of coffee in Yên Hòa');
    const chip = screen.getByText('Friends');
    // react-native-web draws `numberOfLines` as a line clamp.
    expect(title.style.getPropertyValue('-webkit-line-clamp')).toBe('2');
    // The chip's row is the date's, and the title is not in it.
    const row = chip.parentElement!.parentElement!;
    // The date is SOON's, three days from whenever this runs: written as
    // the literal "Tue, 20 Oct" it held for one day, 17 Oct 2026 in Hanoi,
    // and turned CI red at midnight there.
    expect(row.textContent).toBe(`${dateline('en', fromISO(SOON)!)}Friends`);
  });

  // The answer as the date is set, not a badge (owner, 13 Nov 2026): the
  // glyph in the third grey, the word in the date's caption and grey, and
  // no fill, rule or weight around them.
  it('sets the company as the date is set, with no badge round it', () => {
    show([trip({ company: 'couple' })]);
    const company = screen.getByTestId('trip-company');
    // The couple's heart is what says "Hai người" is the couple.
    const glyph = company.querySelector('[data-icon="heart-outline"]')!;
    expect(glyph.getAttribute('data-color')).toBe(String(colors.textTertiary));
    expect(textStyleOf(screen.getByText('Couple'))).toMatchObject({ fontSize: 13, fontWeight: font.regular, color: colors.textSecondary });
    const box = viewStyleOf(company);
    expect([box.backgroundColor, box.borderWidth, box.paddingHorizontal, box.paddingVertical]).toEqual([undefined, undefined, undefined, undefined]);
    expect(box.gap).toBe(5);
  });

  it('has no cover and no badge when there is no picture and no company', () => {
    show([trip({ company: null })]);
    expect(document.querySelector('img')).toBeNull();
    expect(screen.queryByText('Friends')).toBeNull();
  });

  // Neither the count nor the spend (owner, 24 Oct 2026): the stops are
  // printed above, and the spend belongs to the trip's own screen. The
  // default trip's stops are priced, so a spend would have a figure to
  // print.
  it('prints neither how many stops nor what they cost', () => {
    show([trip()]);
    expect(text()).not.toMatch(/₫|per person|\/ person/);
    expect(text()).not.toMatch(/\b\d+ stops?\b/);
    expect(screen.getByText('View plan')).toBeTruthy();
  });

  // The card never names the city, even across two of them. It used to
  // once a second city appeared, and on 7 Oct 2026 the owner read "from
  // 18:00 · Saigon" over a stop whose ward is "Sài Gòn" — the ward of
  // that name since the 2025 merger — as the same word twice. The stops'
  // ward column already says where, stop by stop; the city was the one
  // token on the card the rest of it had made redundant.
  it('never names the city on the card, whichever cities the trips span', () => {
    show([trip()]);
    expect(text()).not.toMatch(/Hanoi/);
    cleanup();
    show([trip(), trip({ id: 't2', title: 'Down south', city_id: 'saigon' })]);
    expect(text()).not.toMatch(/Hanoi/);
    expect(text()).not.toMatch(/Saigon/);
    // The date stays.
    expect(text()).toContain(dateline('en', fromISO(SOON)!));
  });

  it('dims a trip that has been, and keeps it legible', () => {
    show([trip({ day: GONE })]);
    expect(screen.getByText('Old Quarter crawl')).toBeTruthy();
  });
});

describe('invitations', () => {
  const asked = () => trip({ id: 'asked-1', owner_id: 'lan', title: 'Lan’s evening' });

  it('opens on the invitations, with a count, names who asked, and opens the invitation', () => {
    state.invites = [invite()];
    const n = show([trip(), asked()]);
    expect(tabs()).toEqual(['Invites (1)', 'Upcoming (1)', 'Past']);
    expect(chosen()).toBe('Invites (1)');
    expect(screen.getByText('Lan’s evening from lanphuong')).toBeTruthy();
    expect(screen.queryByText('Old Quarter crawl')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'open asked-1' }));
    expect(n.navigate).toHaveBeenCalledWith('TripInvitation', { id: 'asked-1' });
  });

  // "No trips yet" is false while somebody is waiting on an answer.
  it('does not offer a first trip while an invitation is waiting', () => {
    state.invites = [invite()];
    show([asked()]);
    expect(screen.queryByText('No trips yet')).toBeNull();
    expect(screen.getByTestId('invite-asked-1')).toBeTruthy();
  });

  it('shows an accepted invitation among the plans, not on the rail', () => {
    state.invites = [invite({ status: 'accepted' })];
    show([asked()]);
    expect(tabs()).toEqual(['Invites', 'Upcoming (1)', 'Past']);
    expect(chosen()).toBe('Upcoming (1)');
    expect(screen.queryByTestId('invite-asked-1')).toBeNull();
  });

  // The trip the last invitation was now lives on Upcoming.
  it('follows the last accepted invitation to Upcoming, and stays while more are waiting', async () => {
    state.invites = [invite(), invite({ trip_id: 'asked-2', created_at: '2026-09-11T00:00:00Z' })];
    show([asked(), trip({ id: 'asked-2', owner_id: 'lan', title: 'Second' })]);
    fireEvent.click(screen.getByRole('button', { name: 'accept asked-1' }));
    await waitFor(() => expect(spies.invitesReload).toHaveBeenCalledTimes(1));
    expect(chosen()).toBe('Invites (2)');
    cleanup();
    state.invites = [invite()];
    show([asked()]);
    fireEvent.click(screen.getByRole('button', { name: 'accept asked-1' }));
    await waitFor(() => expect(chosen()).toMatch(/^Upcoming/));
  });

  it('stays on an emptied Invites after a decline', async () => {
    state.invites = [invite()];
    show([asked(), trip()]);
    fireEvent.click(screen.getByRole('button', { name: 'decline asked-1' }));
    await waitFor(() => expect(spies.invitesReload).toHaveBeenCalledTimes(1));
    expect(chosen()).toMatch(/^Invites/);
  });

  it('answers through the write, then reloads both lists', async () => {
    state.invites = [invite()];
    show([asked()]);
    // Past the focus reload, which is not the answer's.
    spies.tripsReload.mockClear();
    spies.invitesReload.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'accept asked-1' }));
    await waitFor(() => expect(spies.answerInvite).toHaveBeenCalledWith('asked-1', 'accepted'));
    await waitFor(() => expect(spies.tripsReload).toHaveBeenCalledTimes(1));
    expect(spies.invitesReload).toHaveBeenCalledTimes(1);
  });

  it('marks the card busy while the answer is in flight, and ignores a second answer', async () => {
    let settle!: () => void;
    spies.answerInvite.mockImplementation(() => new Promise<void>((r) => { settle = r; }));
    state.invites = [invite()];
    show([asked()]);
    fireEvent.click(screen.getByRole('button', { name: 'decline asked-1' }));
    expect(screen.getByTestId('invite-asked-1').getAttribute('data-busy')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'accept asked-1' }));
    expect(spies.answerInvite).toHaveBeenCalledTimes(1);
    await act(async () => { settle(); });
    expect(screen.getByTestId('invite-asked-1').getAttribute('data-busy')).toBe('false');
  });

  it('says so when the answer is refused', async () => {
    spies.answerInvite.mockRejectedValueOnce(new Error('the evening is full'));
    state.invites = [invite()];
    show([asked()]);
    spies.invitesReload.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'accept asked-1' }));
    await waitFor(() => expect(alert).toHaveBeenCalled());
    expect(alert.mock.calls[0][0]).toBe('Could not answer');
    expect(alert.mock.calls[0][1]).toBe('the evening is full');
    expect(spies.invitesReload).not.toHaveBeenCalled();
  });
});

describe('a failed read', () => {
  it('is the body, named, when there is nothing to show', () => {
    show([], { error: 'Network request failed' });
    expect(screen.getByTestId('trips-load-fail')).toBeTruthy();
    expect(screen.getByText('You’re offline.')).toBeTruthy();
    expect(screen.queryByText('No trips yet')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    // Once from the focus, once from the button.
    expect(spies.tripsReload).toHaveBeenCalledTimes(2);
  });

  it('is a banner above the list when there is one', () => {
    show([trip()], { error: 'JWT expired' });
    expect(screen.getByTestId('trips-load-banner')).toBeTruthy();
    expect(screen.getByText('Old Quarter crawl')).toBeTruthy();
    expect(screen.queryByText(/JWT/)).toBeNull();
  });
});

// Its tab pressed again at this root scrolls back to the top. The press
// is React Navigation's to hear; what is this screen's is the ref, and a
// ref left off the list would hand over null and scroll nothing.
describe('its tab, pressed again', () => {
  it('hands the scroll to the top the screen’s own list', async () => {
    show();
    const ref = vi.mocked(useScrollToTop).mock.calls.at(-1)?.[0] as { current: unknown };
    expect(ref.current).toHaveProperty('scrollTo');
  });
});
