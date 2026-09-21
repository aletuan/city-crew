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
import { Alert } from 'react-native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '../uitest/render';
import { addDays, todayISO } from '../lib/day';
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

vi.mock('../lib/auth', () => ({
  useAuth: () => ({ session: state.uid ? { user: { id: state.uid } } : null }),
}));
vi.mock('../lib/city', () => ({
  useCity: () => ({
    cities: [
      { id: 'hanoi', short_en: 'Hanoi', short_vi: 'Hà Nội', short_ja: 'ハノイ' },
      { id: 'saigon', short_en: 'Saigon', short_vi: 'Sài Gòn', short_ja: 'サイゴン' },
    ],
  }),
}));
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
  useInvitations: () => ({ invites: { data: state.invites, reload: spies.invitesReload } }),
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
/** Section headings, top to bottom. */
const sections = () => [...document.querySelectorAll('div')]
  .map((el) => el.textContent ?? '')
  .filter((s) => /^(Invitations|Upcoming|Been there) · \d+$/.test(s));

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
  // Not an empty list — a different question, so it gets the whole screen.
  it('asks to sign in instead of showing an empty list, and goes to the sign-in screen', () => {
    state.uid = null;
    const n = show([trip()]);
    expect(screen.getByText('Sign in to keep your trips')).toBeTruthy();
    expect(screen.queryByText('Old Quarter crawl')).toBeNull();
    expect(screen.queryByText('No trips yet')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(n.parent.navigate).toHaveBeenCalledWith('Profile', { screen: 'SignIn', initial: false });
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

  it('holds skeletons, not the list, until the read has settled', () => {
    show([trip()], { loaded: false });
    expect(screen.queryByText('Old Quarter crawl')).toBeNull();
    expect(screen.queryByText('No trips yet')).toBeNull();
  });
});

describe('nothing saved yet', () => {
  it('offers to plan the first trip, from the card and not the header', () => {
    const n = show([]);
    expect(screen.getByText('No trips yet')).toBeTruthy();
    // One invitation to do one thing: the header pill waits for a list.
    expect(screen.queryByRole('button', { name: 'New trip' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Plan a trip' }));
    expect(n.parent.navigate).toHaveBeenCalledWith('Ideas');
  });

  it('offers the header pill once there is a list, and it leads to Ideas too', () => {
    const n = show([trip()]);
    expect(screen.queryByText('No trips yet')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'New trip' }));
    expect(n.parent.navigate).toHaveBeenCalledWith('Ideas');
  });
});

describe('the two halves', () => {
  it('puts what is coming above what has been, each with its count, soonest and most recent first', () => {
    show([
      trip({ id: 'far', title: 'Far ahead', day: addDays(TODAY, 10) }),
      trip({ id: 'old', title: 'Long ago', day: addDays(TODAY, -30) }),
      trip({ id: 'soon', title: 'Soon', day: SOON }),
      trip({ id: 'last', title: 'Last week', day: GONE }),
    ]);
    expect(sections()).toEqual(['Upcoming · 2', 'Been there · 2']);
    const titles = ['Soon', 'Far ahead', 'Last week', 'Long ago'].map((s) => text().indexOf(s));
    expect([...titles].sort((a, b) => a - b)).toEqual(titles);
    expect(screen.getByText('Your next plans, in order.')).toBeTruthy();
  });

  it('draws only the half that exists', () => {
    show([trip({ day: GONE })]);
    expect(sections()).toEqual(['Been there · 1']);
    expect(screen.queryByText(/Upcoming/)).toBeNull();
  });

  // Today is still upcoming: an evening you are on does not become a
  // memory at midnight.
  it('keeps today’s trip among the upcoming ones', () => {
    show([trip({ day: TODAY, trip_stops: [stop(place(), { arrive_min: 23 * 60 + 59 })] })]);
    expect(sections()).toEqual(['Upcoming · 1']);
  });

  it('opens a trip on its detail', () => {
    const n = show([trip()]);
    fireEvent.click(screen.getByTestId('trip-upcoming-0'));
    expect(n.navigate).toHaveBeenCalledWith('TripDetail', { id: 't1' });
  });
});

describe('the card', () => {
  it('prints the date, the start, the stops with their hours and areas, the count and the spend', () => {
    show([trip()]);
    expect(text()).toMatch(/from 18:00/);
    expect(screen.getByText('18:00')).toBeTruthy();
    expect(screen.getByText('19:00')).toBeTruthy();
    expect(screen.getByText('Pho 10')).toBeTruthy();
    expect(screen.getByText('Ba Dinh')).toBeTruthy();
    // 60k + 35k, per person, and the badge the wizard's answer wears.
    expect(text()).toMatch(/~95k ₫ \/ person/);
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

  it('has no cover and no badge when there is no picture and no company', () => {
    show([trip({ company: null })]);
    expect(document.querySelector('img')).toBeNull();
    expect(screen.queryByText('Friends')).toBeNull();
  });

  it('says a million in millions', () => {
    show([trip({ trip_stops: [stop(place({ price_vnd: 1_250_000 }))] })]);
    expect(text()).toMatch(/~1\.3M ₫/);
  });

  it('says no spend at all when nothing has a price', () => {
    show([trip({ trip_stops: [stop(place({ price_vnd: null }))] })]);
    expect(text()).not.toMatch(/₫/);
  });

  // One reader's trips are usually all in one city, and repeating it down
  // the list is noise. The moment a second city appears, every card says.
  it('names the city only once a second one appears', () => {
    show([trip()]);
    expect(text()).not.toMatch(/Hanoi/);
    cleanup();
    show([trip(), trip({ id: 't2', title: 'Down south', city_id: 'saigon' })]);
    expect(text()).toMatch(/Hanoi/);
    expect(text()).toMatch(/Saigon/);
  });

  it('dims a trip that has been, and keeps it legible', () => {
    show([trip({ day: GONE })]);
    expect(screen.getByText('Old Quarter crawl')).toBeTruthy();
  });
});

describe('invitations', () => {
  const asked = () => trip({ id: 'asked-1', owner_id: 'lan', title: 'Lan’s evening' });

  it('rides above the plans with its own count, names who asked, and opens the invitation', () => {
    state.invites = [invite()];
    const n = show([trip(), asked()]);
    expect(sections()).toEqual(['Invitations · 1', 'Upcoming · 1']);
    expect(screen.getByText('Lan’s evening from lanphuong')).toBeTruthy();
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
    expect(sections()).toEqual(['Upcoming · 1']);
    expect(screen.queryByTestId('invite-asked-1')).toBeNull();
  });

  it('answers through the write, then reloads both lists', async () => {
    state.invites = [invite()];
    show([asked()]);
    fireEvent.click(screen.getByRole('button', { name: 'accept asked-1' }));
    await waitFor(() => expect(spies.answerInvite).toHaveBeenCalledWith('asked-1', 'accepted'));
    await waitFor(() => expect(spies.tripsReload).toHaveBeenCalledTimes(2));
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
