// @vitest-environment jsdom
//
// An invitation, read before it is answered. What is pinned here is what
// the invitee decides on: who is asking, on which day and between which
// hours, every stop the plan kept (including one the catalog has since
// dropped), the walk between them, what it costs, and how many are coming
// — "and 1 other", never "1 others". Then the two answers: each reaches
// `answerInvite` exactly once for this trip however fast it is tapped,
// reloads both lists the answer changes, and leaves; a refusal from the
// server keeps the reader here with the reason. An invitation already
// answered says so instead of offering buttons that would reach no rows,
// and a trip that is not (or not yet) in the list says which of those it is.

import React from 'react';
import { Alert } from 'react-native';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '../uitest/render';
import type { Nav, RootRoute } from '../nav';
import type { Place } from '../lib/types';
import type { Trip, TripStopRow } from '../lib/data';

const answerInvite = vi.hoisted(() => vi.fn(async (_id: string, _a: string) => {}));
const tripsReload = vi.hoisted(() => vi.fn());
const invitesReload = vi.hoisted(() => vi.fn());

const state = vi.hoisted(() => ({
  lang: 'en' as 'en' | 'vi' | 'ja',
  me: 'u2' as string | null,
  loaded: true,
  error: null as string | null,
  trips: [] as unknown[],
  invites: [] as { trip_id: string; invitee_id: string; inviter_id: string; status: string }[],
  crewCounts: {} as Record<string, number | null>,
  people: {} as Record<string, { full_name?: string | null; handle?: string | null; avatar_url?: string | null }>,
}));

vi.mock('../lib/auth', () => ({
  useAuth: () => ({ session: state.me ? { user: { id: state.me } } : null }),
}));
// English unless a test asks otherwise — the vi/ja strings are checked
// only where a sentence is built rather than looked up.
vi.mock('../lib/i18n', () => ({
  useI18n: () => ({
    lang: state.lang,
    setLang: () => {},
    t: (en: string, vi?: string | null, ja?: string | null) =>
      (state.lang === 'vi' ? vi ?? en : state.lang === 'ja' ? ja ?? en : en),
  }),
}));
vi.mock('../lib/mytrips', () => ({
  useMyTrips: () => ({
    loaded: state.loaded, error: state.error, data: state.trips, reload: tripsReload,
  }),
}));
vi.mock('../lib/crew', () => ({ useCrew: () => ({ people: state.people }) }));
vi.mock('../lib/invitations', () => ({
  useInvitations: () => ({
    invites: { data: state.invites, reload: invitesReload },
    crewCounts: state.crewCounts,
  }),
}));
vi.mock('../lib/data', () => ({ answerInvite }));

import TripInvitationScreen from './TripInvitationScreen';

const alert = vi.spyOn(Alert, 'alert').mockImplementation(() => {});

const nav = () => ({ navigate: vi.fn(), goBack: vi.fn(), replace: vi.fn() }) as unknown as Nav;
const route = (id = 't1') => ({ params: { id } }) as RootRoute<'TripInvitation'>;

const place = (over: Partial<Place> = {}): Place => ({
  slug: 'pho-10', name_en: 'Pho 10', name_vi: 'Phở 10', name_ja: null,
  category: 'food', categories: ['eats'], is_featured: false,
  neighborhood_en: 'Hoan Kiem', neighborhood_vi: 'Hoàn Kiếm', price_vnd: 60_000,
  lat: 21.0285, lng: 105.8542, google_place_id: 'g-pho', place_photos: [],
  ...over,
} as unknown as Place);

const stop = (places: Place | null, over: Partial<TripStopRow> = {}): TripStopRow => ({
  sort_order: 0, arrive_min: null, dwell_min: null, why: null, why_lang: null, places, ...over,
});

const trip = (over: Partial<Trip> = {}): Trip => ({
  id: 't1', owner_id: 'host', city_id: 'hanoi', title: 'Old Quarter crawl',
  company: 'friends', categories: [], district: null, day: '2026-09-12',
  when_part: 'day', generated_by: 'model',
  trip_stops: [
    stop(place(), { arrive_min: 9 * 60, dwell_min: 45 }),
    stop(place({
      slug: 'museum', name_en: 'Fine Arts Museum', name_vi: 'Bảo tàng Mỹ thuật', categories: ['culture'],
      price_vnd: 40_000, neighborhood_en: 'Ba Dinh', lat: 21.0307, lng: 105.8368,
    }), { sort_order: 1, arrive_min: 10 * 60, dwell_min: 90 }),
    stop(place({
      slug: 'cafe', name_en: 'Cafe Giang', categories: ['cafes'], price_vnd: 35_000,
      neighborhood_en: 'Hoan Kiem', lat: 21.0333, lng: 105.8540,
    }), { sort_order: 2, arrive_min: 12 * 60, dwell_min: 30 }),
  ],
  ...over,
} as unknown as Trip);

const invite = (status = 'pending', over = {}) => ({
  trip_id: 't1', invitee_id: 'u2', inviter_id: 'host', status, ...over,
});

const show = (id?: string) => {
  const navigation = nav();
  render(<TripInvitationScreen navigation={navigation} route={route(id)} />);
  return navigation;
};

const yes = () => screen.getByRole('button', { name: /I’m in/ });
const no = () => screen.getByRole('button', { name: /Can’t make it/ });
const text = () => document.body.textContent ?? '';

beforeEach(() => {
  vi.clearAllMocks();
  alert.mockImplementation(() => {});
  answerInvite.mockImplementation(async () => {});
  state.lang = 'en';
  state.me = 'u2';
  state.loaded = true;
  state.error = null;
  state.trips = [trip()];
  state.invites = [invite()];
  state.crewCounts = { t1: 2 };
  state.people = { host: { full_name: 'Linh', handle: 'linh', avatar_url: 'host.jpg' } };
});

describe('before the trip is there', () => {
  it('says it is loading while the list has not arrived yet', () => {
    state.loaded = false;
    state.trips = [];
    show();
    expect(screen.getByText('Loading…')).toBeTruthy();
    expect(screen.queryByText('That invitation is no longer here.')).toBeNull();
    expect(screen.queryByRole('button', { name: /I’m in/ })).toBeNull();
  });

  it('says the invitation is gone once the list has loaded without it, and the back control leaves', () => {
    state.trips = [trip({ id: 'other' })];
    const navigation = show('t1');
    expect(screen.getByText('That invitation is no longer here.')).toBeTruthy();
    expect(screen.getByText('Invitation')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /I’m in/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(navigation.goBack).toHaveBeenCalledTimes(1);
  });

  it('does not tell the reader the invitation is gone when the list failed to load', () => {
    state.trips = [];
    state.error = 'network down';
    show();
    expect(screen.queryByText('That invitation is no longer here.')).toBeNull();
    expect(screen.getByText('Could not load this invitation. Go back and try again.')).toBeTruthy();
  });
});

describe('what the invitee sees', () => {
  it('names the host, the day and the hours the plan spans', () => {
    show();
    expect(screen.getByText('Old Quarter crawl')).toBeTruthy();
    expect(text()).toContain('Linh wants you along');
    expect(text()).toContain('@linh · Saturday, September 12 · 09:00–12:30');
    const img = document.querySelector('img');
    expect(img?.getAttribute('src')).toBe('host.jpg');
  });

  it('falls back to the handle, then to "Someone", and prints the raw day when it cannot be parsed', () => {
    state.people = { host: { full_name: null, handle: 'linh' } };
    const { unmount } = render(<TripInvitationScreen navigation={nav()} route={route()} />);
    expect(text()).toContain('@linh wants you along');
    unmount();
    state.people = {};
    state.trips = [trip({ day: 'someday', trip_stops: [stop(place())] })];
    show();
    expect(text()).toContain('Someone wants you along');
    // No handle and no times: the meta line is the day alone.
    expect(text()).toContain('someday');
    expect(text()).not.toContain('@');
  });

  it('lists every stop with its time, neighbourhood and stay, plus the walk between', () => {
    show();
    for (const name of ['Pho 10', 'Fine Arts Museum', 'Cafe Giang']) expect(screen.getByText(name)).toBeTruthy();
    expect(screen.getByText('09:00')).toBeTruthy();
    expect(screen.getByText('10:00')).toBeTruthy();
    expect(screen.getByText('12:00')).toBeTruthy();
    expect(text()).toContain('Hoan Kiem · 45 min');
    expect(text()).toContain('Ba Dinh · 90 min');
    // Two walks for three stops — none after the last.
    expect(document.querySelectorAll('[data-icon="walk-outline"]')).toHaveLength(2);
    expect(text()).toMatch(/km · ≈ \d+ min/);
  });

  it('sums stops, hours and the cost per person under the plan', () => {
    show();
    expect(text()).toContain('3 stops · 09:00–12:30 · ~165k ₫ / person');
  });

  it('writes a million-dong plan in millions and a single stop in the singular', () => {
    state.trips = [trip({ trip_stops: [stop(place({ price_vnd: 1_250_000 }), { arrive_min: 600 })] })];
    show();
    expect(text()).toContain('1 stop · 10:00–10:00 · ~1.3M ₫ / person');
    expect(document.querySelectorAll('[data-icon="walk-outline"]')).toHaveLength(0);
  });

  it('keeps a stop whose place has gone, with a dash for its time and no cost line for a free plan', () => {
    state.trips = [trip({ trip_stops: [stop(null), stop(place({ price_vnd: 0 }), { arrive_min: 600 })] })];
    show();
    expect(screen.getByText('A place that has since gone')).toBeTruthy();
    expect(screen.getByText('—')).toBeTruthy();
    // Without a first arrival there is no window to print either.
    expect(text()).toContain('2 stops');
    expect(text()).not.toContain('/ person');
    expect(text()).not.toMatch(/\d\d:\d\d–/);
  });

  it('reads a trip with no stops at all', () => {
    state.trips = [trip({ trip_stops: undefined })];
    show();
    expect(text()).toContain('0 stops');
    expect(yes()).toBeTruthy();
  });

  it('shows place names in the reader’s language', () => {
    state.lang = 'vi';
    show();
    expect(screen.getByText('Bảo tàng Mỹ thuật')).toBeTruthy();
    expect(text()).toContain('3 điểm dừng');
  });
});

describe('how many are coming', () => {
  it('says "and 2 others" and counts the reader in', () => {
    show();
    expect(text()).toContain('Linh and 2 others — you’d be 4 in all.');
  });

  it('says "and 1 other", never "1 others"', () => {
    state.crewCounts = { t1: 1 };
    show();
    expect(text()).toContain('Linh and 1 other — you’d be 3 in all.');
    expect(text()).not.toContain('1 others');
  });

  it('says just the host when nobody else has said yes', () => {
    state.crewCounts = { t1: 0 };
    show();
    expect(text()).toContain('Linh — you’d be 2 in all.');
    expect(text()).not.toContain('other');
  });

  it('says "They" when the host has no name on file', () => {
    state.people = {};
    state.crewCounts = { t1: 3 };
    show();
    expect(text()).toContain('They and 3 others — you’d be 5 in all.');
  });

  it('leaves the line out while the count is unknown or failed', () => {
    state.crewCounts = {};
    const { unmount } = render(<TripInvitationScreen navigation={nav()} route={route()} />);
    expect(text()).not.toContain('in all');
    expect(document.querySelector('[data-icon="people-outline"]')).toBeNull();
    unmount();
    state.crewCounts = { t1: null };
    show();
    expect(text()).not.toContain('in all');
  });

  it('builds the same sentence in Vietnamese and Japanese', () => {
    state.lang = 'vi';
    const { unmount } = render(<TripInvitationScreen navigation={nav()} route={route()} />);
    expect(text()).toContain('Linh và 2 người nữa — tính cả bạn là 4.');
    unmount();
    state.lang = 'ja';
    show();
    expect(text()).toContain('Linh と他2人 — あなたを入れて4人。');
  });
});

describe('what it promises', () => {
  it('says the named host keeps the plan, in the singular', () => {
    show();
    expect(text()).toContain('Linh keeps the plan. Accepting puts it in your Trips');
    expect(text()).not.toContain('Linh keep the plan');
  });

  it('says "They keep the plan" when the host has no name', () => {
    state.people = {};
    show();
    expect(text()).toContain('They keep the plan.');
  });

  it('lets the reader leave without answering', () => {
    const navigation = show();
    fireEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(navigation.goBack).toHaveBeenCalledTimes(1);
    expect(answerInvite).not.toHaveBeenCalled();
  });

  it('says declining deletes nothing', () => {
    show();
    expect(text()).toContain('Either answer tells them. Declining does not delete their plan.');
  });
});

describe('answering', () => {
  it('accepting answers this trip, reloads both lists and leaves', async () => {
    const navigation = show();
    fireEvent.click(yes());
    await waitFor(() => expect(navigation.goBack).toHaveBeenCalledTimes(1));
    expect(answerInvite).toHaveBeenCalledTimes(1);
    expect(answerInvite).toHaveBeenCalledWith('t1', 'accepted');
    expect(invitesReload).toHaveBeenCalledTimes(1);
    expect(tripsReload).toHaveBeenCalledTimes(1);
    expect(alert).not.toHaveBeenCalled();
  });

  it('declining answers this trip, reloads both lists and leaves', async () => {
    const navigation = show();
    fireEvent.click(no());
    await waitFor(() => expect(navigation.goBack).toHaveBeenCalledTimes(1));
    expect(answerInvite).toHaveBeenCalledTimes(1);
    expect(answerInvite).toHaveBeenCalledWith('t1', 'declined');
    expect(invitesReload).toHaveBeenCalledTimes(1);
    expect(tripsReload).toHaveBeenCalledTimes(1);
  });

  it('does not leave or reload before the answer has landed', async () => {
    let land!: () => void;
    answerInvite.mockImplementation(() => new Promise<void>((r) => { land = r; }));
    const navigation = show();
    fireEvent.click(yes());
    await Promise.resolve();
    expect(navigation.goBack).not.toHaveBeenCalled();
    expect(tripsReload).not.toHaveBeenCalled();
    await act(async () => { land(); });
    expect(navigation.goBack).toHaveBeenCalledTimes(1);
  });

  it('ignores a second tap on either button while the first answer is in flight', async () => {
    let land!: () => void;
    answerInvite.mockImplementation(() => new Promise<void>((r) => { land = r; }));
    const navigation = show();
    fireEvent.click(yes());
    fireEvent.click(yes());
    fireEvent.click(no());
    expect(answerInvite).toHaveBeenCalledTimes(1);
    await act(async () => { land(); });
    expect(navigation.goBack).toHaveBeenCalledTimes(1);
  });

  it('sends one answer for two taps that land before the screen re-renders', async () => {
    const navigation = show();
    const b = yes();
    // Two taps inside one batch: neither sees the other's `busy` render.
    await act(async () => { b.click(); b.click(); });
    await waitFor(() => expect(navigation.goBack).toHaveBeenCalled());
    expect(answerInvite).toHaveBeenCalledTimes(1);
    expect(navigation.goBack).toHaveBeenCalledTimes(1);
  });

  it('keeps the reader here with the reason when the answer fails, and lets them try again', async () => {
    answerInvite.mockRejectedValueOnce(new Error('row-level security'));
    const navigation = show();
    fireEvent.click(yes());
    await waitFor(() => expect(alert).toHaveBeenCalledWith('Could not answer', 'row-level security'));
    expect(navigation.goBack).not.toHaveBeenCalled();
    expect(tripsReload).not.toHaveBeenCalled();
    expect(invitesReload).not.toHaveBeenCalled();
    fireEvent.click(yes());
    await waitFor(() => expect(navigation.goBack).toHaveBeenCalledTimes(1));
    expect(answerInvite).toHaveBeenCalledTimes(2);
  });

  it('says what was thrown when it is not an Error', async () => {
    answerInvite.mockRejectedValueOnce('offline');
    show();
    fireEvent.click(no());
    await waitFor(() => expect(alert).toHaveBeenCalledWith('Could not answer', 'offline'));
  });
});

describe('an invitation already answered', () => {
  it('says the reader is in, with no buttons to answer again', () => {
    state.invites = [invite('accepted')];
    show();
    expect(screen.getByText('You said you’re in.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /I’m in/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Can’t make it/ })).toBeNull();
    expect(text()).not.toContain('Either answer tells them');
  });

  it('says the reader declined', () => {
    state.invites = [invite('declined')];
    show();
    expect(screen.getByText('You said you can’t make it.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Can’t make it/ })).toBeNull();
  });

  it('reads only the reader’s own row on this trip', () => {
    state.invites = [
      invite('accepted', { invitee_id: 'someone-else' }),
      invite('declined', { trip_id: 'other' }),
      invite('pending', { inviter_id: 'host' }),
    ];
    show();
    expect(yes()).toBeTruthy();
    expect(screen.queryByText(/You said/)).toBeNull();
  });
});

describe('with no session', () => {
  it('matches no invitation row, so nothing reads as already answered', () => {
    state.me = null;
    state.invites = [invite('accepted')];
    show();
    expect(screen.queryByText(/You said/)).toBeNull();
    expect(yes()).toBeTruthy();
  });
});
