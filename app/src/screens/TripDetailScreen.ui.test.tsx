// @vitest-environment jsdom
//
// A saved trip, read back. What is pinned here is what the reader relies
// on without thinking about it: every stop the trip kept is printed —
// including one the catalog has since dropped — each named stop opens its
// place, the money splits into food and everything else, the way out to
// Google Maps goes where it says, and the red button at the bottom does the
// right thing for the right person. An owner deletes; a guest leaves. Both
// are behind a confirmation, and neither should strand the reader on a
// screen for a trip that no longer exists.
//
// `TripCrew` and `InviteSheet` are stood in for by props-recorders: they
// have tests of their own, and what this screen owes them is the right
// props — who owns the trip, whose invites, whether inviting is allowed.

import React from 'react';
import { Alert, Linking } from 'react-native';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '../uitest/render';
import type { Nav, RootRoute } from '../nav';
import type { Place } from '../lib/types';
import type { Trip, TripStopRow } from '../lib/data';

const deleteTrip = vi.hoisted(() => vi.fn(async (_id: string) => {}));
const answerInvite = vi.hoisted(() => vi.fn(async (_id: string, _a: string) => {}));
const sendInvites = vi.hoisted(() => vi.fn(async (_t: string, _me: string, _ids: string[]) => {}));
const withdrawInvites = vi.hoisted(() => vi.fn(async (_t: string, _ids: string[]) => {}));
const cancelTripReminder = vi.hoisted(() => vi.fn(async (_id: string) => {}));
const tripsReload = vi.hoisted(() => vi.fn());
const invitesReload = vi.hoisted(() => vi.fn());

const state = vi.hoisted(() => ({
  me: 'u1' as string | null,
  loaded: true,
  trips: [] as unknown[],
  invites: [] as { trip_id: string; invitee: string; status: string }[],
  crewCounts: {} as Record<string, number | null>,
  credit: false,
  ships: [] as { requester: string; addressee: string; status: string }[],
}));

const crewProps = vi.hoisted(() => ({ last: null as null | Record<string, unknown> }));
const sheetProps = vi.hoisted(() => ({ last: null as null | Record<string, unknown> }));

vi.mock('../lib/auth', () => ({
  useAuth: () => ({
    session: state.me ? { user: { id: state.me } } : null,
    profile: { avatar_url: 'me.jpg' },
  }),
}));
vi.mock('../lib/i18n', () => ({
  useI18n: () => ({ lang: 'en', setLang: () => {}, t: (en: string) => en }),
}));
vi.mock('../lib/useFlag', () => ({ useFlag: () => state.credit }));
vi.mock('../lib/mytrips', () => ({
  useMyTrips: () => ({ loaded: state.loaded, data: state.trips, reload: tripsReload }),
}));
vi.mock('../lib/crew', () => ({
  useCrew: () => ({
    ships: { data: state.ships },
    people: { host: { avatar_url: 'host.jpg' } },
    mutual: {},
  }),
}));
vi.mock('../lib/invitations', () => ({
  useInvitations: () => ({
    invites: { data: state.invites, reload: invitesReload },
    crewCounts: state.crewCounts,
  }),
}));
vi.mock('../lib/data', () => ({ deleteTrip, answerInvite, sendInvites, withdrawInvites }));
// The real one reaches `expo-notifications`, a native module.
vi.mock('../lib/reminders', () => ({ cancelTripReminder }));

vi.mock('../components/TripCrew', async () => {
  const { Pressable, Text } = await import('react-native');
  return {
    default: (p: Record<string, unknown> & { canInvite: boolean; onInvite: () => void }) => {
      crewProps.last = p;
      return p.canInvite
        ? <Pressable accessibilityRole="button" onPress={p.onInvite}><Text>Invite</Text></Pressable>
        : null;
    },
  };
});
vi.mock('../components/InviteSheet', async () => {
  const { Pressable, Text } = await import('react-native');
  return {
    default: (p: Record<string, unknown> & {
      open: boolean; onSend: (a: string[], b: string[]) => void; onClose: () => void;
    }) => {
      sheetProps.last = p;
      if (!p.open) return null;
      return (
        <>
          <Text>Invite sheet</Text>
          <Pressable accessibilityRole="button" onPress={() => p.onSend(['f1'], ['f2'])}>
            <Text>Send</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={p.onClose}><Text>Close</Text></Pressable>
        </>
      );
    },
  };
});

import TripDetailScreen from './TripDetailScreen';

// `setup.tsx` mocks `react-native/Libraries/Alert/Alert`, but under the
// web alias the screen's `Alert` is `react-native-web`'s, which that mock
// never reaches — so the spy is put on the object the screen actually holds.
const alert = vi.spyOn(Alert, 'alert').mockImplementation(() => {});

const nav = () => ({
  navigate: vi.fn(), goBack: vi.fn(), replace: vi.fn(), popToTop: vi.fn(),
}) as unknown as Nav;
const route = (id = 't1') => ({ params: { id } }) as RootRoute<'TripDetail'>;

const place = (over: Partial<Place> = {}): Place => ({
  slug: 'pho-10', name_en: 'Pho 10', name_vi: 'Phở 10', name_ja: null,
  category: 'food', categories: ['eats'], is_featured: false,
  neighborhood_en: 'Hoan Kiem', price_vnd: 60_000,
  lat: 21.0285, lng: 105.8542, google_place_id: 'g-pho', place_photos: [],
  ...over,
} as unknown as Place);

const stop = (places: Place | null, over: Partial<TripStopRow> = {}): TripStopRow => ({
  sort_order: 0, arrive_min: null, dwell_min: null, why: null, why_lang: null, places, ...over,
});

const trip = (over: Partial<Trip> = {}): Trip => ({
  id: 't1', owner_id: 'u1', city_id: 'hanoi', title: 'Old Quarter crawl',
  company: 'friends', categories: [], district: null, day: '2026-09-12',
  when_part: 'day', generated_by: 'model',
  trip_stops: [
    stop(place(), { arrive_min: 9 * 60, dwell_min: 45, why: 'Best broth in town.', why_lang: 'en' }),
    stop(place({
      slug: 'museum', name_en: 'Fine Arts Museum', categories: ['culture'], price_vnd: 40_000,
      neighborhood_en: 'Ba Dinh', lat: 21.0307, lng: 105.8368, google_place_id: 'g-mus',
    }), { sort_order: 1, arrive_min: 10 * 60, dwell_min: 90, why: 'Bảo tàng đẹp.', why_lang: 'vi' }),
    stop(place({
      slug: 'cafe', name_en: 'Cafe Giang', categories: ['cafes'], price_vnd: 35_000,
      neighborhood_en: 'Hoan Kiem', lat: 21.0333, lng: 105.8540, google_place_id: 'g-cafe',
    }), { sort_order: 2, arrive_min: 12 * 60, dwell_min: 30 }),
  ],
  ...over,
} as unknown as Trip);

const show = (id?: string) => {
  const navigation = nav();
  render(<TripDetailScreen navigation={navigation} route={route(id)} />);
  return navigation;
};

/** Press a button in the last alert shown, by its label. */
const pressInAlert = (label: string) => {
  const buttons = alert.mock.calls.at(-1)![2] as { text: string; onPress?: () => void }[];
  buttons.find((b) => b.text === label)!.onPress?.();
};

beforeEach(() => {
  vi.clearAllMocks();
  alert.mockImplementation(() => {});
  deleteTrip.mockImplementation(async () => {});
  answerInvite.mockImplementation(async () => {});
  sendInvites.mockImplementation(async () => {});
  withdrawInvites.mockImplementation(async () => {});
  state.me = 'u1';
  state.loaded = true;
  state.trips = [trip()];
  state.invites = [];
  state.crewCounts = {};
  state.credit = false;
  state.ships = [];
  crewProps.last = null;
  sheetProps.last = null;
});

describe('before the trip is there', () => {
  it('says it is loading while the list has not arrived yet', () => {
    state.loaded = false;
    state.trips = [];
    show();
    expect(screen.getByText('Loading…')).toBeTruthy();
    expect(screen.queryByText('That trip is no longer here.')).toBeNull();
  });

  it('says the trip is gone once the list has loaded without it', () => {
    state.trips = [trip({ id: 'other' })];
    const navigation = show('t1');
    expect(screen.getByText('That trip is no longer here.')).toBeTruthy();
    expect(screen.queryByText('Old Quarter crawl')).toBeNull();
    // No delete or leave on a trip that is not there.
    expect(screen.queryByText('Delete this trip')).toBeNull();
    expect(screen.queryByText('Leave this trip')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(navigation.goBack).toHaveBeenCalled();
  });
});

describe('the itinerary', () => {
  it('prints the title, the date and the hours from first arrival to last departure', () => {
    show();
    expect(screen.getByText('Old Quarter crawl')).toBeTruthy();
    // 12:00 arrival plus a 30-minute dwell at the last stop.
    expect(screen.getByText('Saturday, September 12 · 09:00–12:30')).toBeTruthy();
  });

  it('falls back to the raw day and no hours when it cannot read them', () => {
    state.trips = [trip({
      day: 'someday',
      trip_stops: [stop(place()), stop(place({ slug: 'b', name_en: 'B' }))],
    })];
    show();
    expect(screen.getByText('someday')).toBeTruthy();
  });

  it('prints every stop with its time, area, dwell and sentence', () => {
    show();
    expect(screen.getByText('Pho 10')).toBeTruthy();
    expect(screen.getByText('Fine Arts Museum')).toBeTruthy();
    expect(screen.getByText('Cafe Giang')).toBeTruthy();
    expect(screen.getByText('09:00')).toBeTruthy();
    expect(screen.getByText('10:00')).toBeTruthy();
    expect(screen.getByText('Hoan Kiem · 45 min')).toBeTruthy();
    expect(screen.getByText('Ba Dinh · 90 min')).toBeTruthy();
    expect(screen.getByText('Best broth in town.')).toBeTruthy();
  });

  it('marks a sentence written in another language, and only that one', () => {
    show();
    expect(screen.getByText(/· VI/)).toBeTruthy();
    expect(screen.queryByText(/· EN/)).toBeNull();
  });

  it('keeps a delisted stop as a gap that opens nothing, with a dash for no time', () => {
    state.trips = [trip({
      trip_stops: [stop(place()), stop(null, { why: 'Gone now.' })],
    })];
    show();
    expect(screen.getByText('No longer listed')).toBeTruthy();
    expect(screen.getByText('Gone now.')).toBeTruthy();
    expect(screen.getAllByText('—')).toHaveLength(2);
    // The named stop opens; the gap has no button behind it.
    expect(screen.getByRole('button', { name: 'Open Pho 10' })).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /^Open (?!in Google Maps)/ })).toHaveLength(1);
  });

  it('opens a stop’s place by its slug', () => {
    const navigation = show();
    fireEvent.click(screen.getByRole('button', { name: 'Open Fine Arts Museum' }));
    expect(navigation.navigate).toHaveBeenCalledWith('PlaceDetail', { slug: 'museum' });
  });

  it('prints the journey into each stop after the first, and none into a delisted one', () => {
    show();
    // Two legs for three stops, each "distance · ≈ N min".
    expect(screen.getAllByText(/^\d.* (m|km) · ≈ \d+ min$/)).toHaveLength(2);
  });

  it('prints no journey where one end has no coordinates', () => {
    state.trips = [trip({
      trip_stops: [stop(place()), stop(place({ slug: 'x', name_en: 'X', lat: null, lng: null } as Partial<Place>))],
    })];
    show();
    expect(screen.queryByText(/· ≈ \d+ min$/)).toBeNull();
  });
});

describe('the money', () => {
  it('splits food from everything else and states the per-person total', () => {
    show();
    // Pho 60k + café 35k are food; the museum's 40k is not.
    expect(screen.getByText('95k ₫')).toBeTruthy();
    expect(screen.getByText('40k ₫')).toBeTruthy();
    expect(screen.getByText('3 stops · per person')).toBeTruthy();
    expect(screen.getByText(/^~\d/)).toBeTruthy();
    expect(screen.getByText('Rides between stops are in the total.')).toBeTruthy();
  });

  it('prints a million and over in M, and one stop in the singular', () => {
    state.trips = [trip({
      trip_stops: [stop(place({ categories: ['culture'], price_vnd: 1_250_000 }))],
    })];
    show();
    expect(screen.getByText('1.3M ₫')).toBeTruthy();
    expect(screen.getByText('0k ₫')).toBeTruthy();
    expect(screen.getByText('1 stop · per person')).toBeTruthy();
  });
});

describe('the way out to Google Maps', () => {
  it('opens the whole day as a route', () => {
    const open = vi.spyOn(Linking, 'openURL').mockResolvedValue(true);
    show();
    expect(screen.getByText('Open the route')).toBeTruthy();
    expect(screen.getByText('Google Maps')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Open the route/ }));
    const url = open.mock.calls[0][0];
    expect(url).toMatch(/^https:\/\/www\.google\.com\/maps\/dir\//);
    expect(url).toContain('origin_place_id=g-pho');
    expect(url).toContain('destination_place_id=g-cafe');
  });

  it('says so when Google will not take every stop', () => {
    const many = Array.from({ length: 12 }, (_, i) => stop(place({
      slug: `p${i}`, name_en: `Place ${i}`, lat: 21 + i / 1000, lng: 105.85, google_place_id: `g${i}`,
    })));
    state.trips = [trip({ trip_stops: many })];
    show();
    // Nine waypoints plus both ends: one of the twelve is dropped.
    expect(screen.getByText('Google Maps · first 11 only')).toBeTruthy();
  });

  it('opens the one place when only one stop can be placed', () => {
    const open = vi.spyOn(Linking, 'openURL').mockResolvedValue(true);
    state.trips = [trip({
      trip_stops: [stop(place()), stop(null)],
    })];
    show();
    expect(screen.queryByText('Open the route')).toBeNull();
    expect(screen.getByText('Open in Google Maps')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Open in Google Maps/ }));
    expect(open.mock.calls[0][0]).toMatch(/maps\/search\/.*query_place_id=g-pho/);
  });

  it('draws no row when no stop can be placed', () => {
    state.trips = [trip({
      trip_stops: [stop(place({ lat: null, lng: null } as Partial<Place>)), stop(null)],
    })];
    show();
    expect(screen.queryByText('Open the route')).toBeNull();
    expect(screen.queryByText('Open in Google Maps')).toBeNull();
  });
});

describe('the gallery', () => {
  const photo = (uri: string, attribution: string | null = null) => ({
    photo_uri: uri, is_cover: true, is_hidden: false, sort_order: 0, attribution_name: attribution,
  });

  it('draws one page per stop, a photo or an emoji, and its credit when the switch is on', () => {
    state.credit = true;
    state.trips = [trip({
      trip_stops: [
        stop(place({ place_photos: [photo('https://img/pho.jpg', 'Photo by Lan')] })),
        stop(place({ slug: 'b', name_en: 'B', emoji: '🍜' } as Partial<Place>)),
        stop(null),
      ],
    })];
    const { container } = render(<TripDetailScreen navigation={nav()} route={route()} />);
    expect(container.querySelector('img[src="https://img/pho.jpg"]')).toBeTruthy();
    expect(screen.getByText('🍜')).toBeTruthy();
    expect(screen.getByText('📍')).toBeTruthy();
    expect(screen.getByText('Photo by Lan')).toBeTruthy();
  });

  it('draws no credit when the switch is off', () => {
    state.trips = [trip({
      trip_stops: [stop(place({ place_photos: [photo('https://img/pho.jpg', 'Photo by Lan')] }))],
    })];
    show();
    expect(screen.queryByText('Photo by Lan')).toBeNull();
  });

  it('draws no gallery when no stop has a picture', () => {
    const { container } = render(<TripDetailScreen navigation={nav()} route={route()} />);
    expect(container.querySelector('img')).toBeNull();
    expect(screen.queryByText('📍')).toBeNull();
  });
});

describe('who is coming', () => {
  it('hands the crew row the owner’s own invites and lets them invite', () => {
    state.invites = [
      { trip_id: 't1', invitee: 'f1', status: 'pending' },
      { trip_id: 'other', invitee: 'f9', status: 'pending' },
    ];
    show();
    expect(crewProps.last).toMatchObject({
      mine: true, canInvite: true, hostAvatar: null, myAvatar: 'me.jpg',
      invites: [{ trip_id: 't1', invitee: 'f1', status: 'pending' }],
    });
  });

  it('offers no invite on a solo trip', () => {
    state.trips = [trip({ company: 'solo' })];
    show();
    expect(crewProps.last).toMatchObject({ mine: true, canInvite: false });
    expect(screen.queryByRole('button', { name: 'Invite' })).toBeNull();
  });

  it('shows a guest the host and the batched headcount, and no invites of anyone else', () => {
    state.me = 'guest';
    state.trips = [trip({ owner_id: 'host' })];
    state.invites = [{ trip_id: 't1', invitee: 'guest', status: 'accepted' }];
    state.crewCounts = { t1: 4 };
    show();
    expect(crewProps.last).toMatchObject({
      mine: false, canInvite: false, invites: [], hostAvatar: 'host.jpg', headCount: 4,
    });
  });

  it('sends ticked friends, withdraws unticked ones, then closes and reloads', async () => {
    state.ships = [{ requester: 'u1', addressee: 'f1', status: 'accepted' }];
    show();
    expect(screen.queryByText('Invite sheet')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Invite' }));
    expect(screen.getByText('Invite sheet')).toBeTruthy();
    expect(sheetProps.last).toMatchObject({ company: 'friends', friendIds: ['f1'] });

    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(screen.queryByText('Invite sheet')).toBeNull());
    expect(sendInvites).toHaveBeenCalledWith('t1', 'u1', ['f1']);
    expect(withdrawInvites).toHaveBeenCalledWith('t1', ['f2']);
    expect(sendInvites.mock.invocationCallOrder[0])
      .toBeLessThan(withdrawInvites.mock.invocationCallOrder[0]);
    expect(invitesReload).toHaveBeenCalled();
    expect(alert).not.toHaveBeenCalled();
  });

  it('says why a send failed and keeps the sheet open', async () => {
    sendInvites.mockRejectedValueOnce(new Error('offline'));
    show();
    fireEvent.click(screen.getByRole('button', { name: 'Invite' }));
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(alert).toHaveBeenCalledWith('Could not send', 'offline'));
    expect(withdrawInvites).not.toHaveBeenCalled();
    expect(screen.getByText('Invite sheet')).toBeTruthy();
    expect(invitesReload).not.toHaveBeenCalled();
    // And the sheet is usable again rather than stuck on "sending".
    await waitFor(() => expect(sheetProps.last).toMatchObject({ sending: false }));
  });

  it('closes the sheet without sending', () => {
    show();
    fireEvent.click(screen.getByRole('button', { name: 'Invite' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByText('Invite sheet')).toBeNull();
    expect(sendInvites).not.toHaveBeenCalled();
  });
});

describe('delete, for the owner', () => {
  it('asks first, naming the trip, and does nothing on cancel', () => {
    show();
    expect(screen.queryByText('Leave this trip')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Delete this trip/ }));
    expect(alert).toHaveBeenCalledWith(
      'Delete this trip?',
      '"Old Quarter crawl" will be gone for good.',
      expect.any(Array),
    );
    pressInAlert('Cancel');
    expect(deleteTrip).not.toHaveBeenCalled();
    expect(cancelTripReminder).not.toHaveBeenCalled();
  });

  it('on confirm, cancels the reminder, deletes, goes back, then reloads the list', async () => {
    const navigation = show();
    fireEvent.click(screen.getByRole('button', { name: /Delete this trip/ }));
    await act(async () => pressInAlert('Delete'));
    expect(cancelTripReminder).toHaveBeenCalledWith('t1');
    expect(deleteTrip).toHaveBeenCalledWith('t1');
    await waitFor(() => expect(navigation.goBack).toHaveBeenCalled());
    expect(tripsReload).toHaveBeenCalled();
    expect(answerInvite).not.toHaveBeenCalled();
  });

  it('says why a delete failed and stays on the trip', async () => {
    deleteTrip.mockRejectedValueOnce(new Error('network down'));
    const navigation = show();
    fireEvent.click(screen.getByRole('button', { name: /Delete this trip/ }));
    await act(async () => pressInAlert('Delete'));
    await waitFor(() => expect(alert).toHaveBeenLastCalledWith('Could not delete', 'network down'));
    expect(navigation.goBack).not.toHaveBeenCalled();
    expect(tripsReload).not.toHaveBeenCalled();
  });
});

describe('leave, for a guest', () => {
  beforeEach(() => {
    state.me = 'guest';
    state.trips = [trip({ owner_id: 'host' })];
  });

  it('offers leave rather than delete', () => {
    show();
    expect(screen.getByText('Leave this trip')).toBeTruthy();
    expect(screen.queryByText('Delete this trip')).toBeNull();
  });

  it('treats a signed-out reader as a guest, never an owner', () => {
    state.me = null;
    state.trips = [trip()];
    show();
    expect(screen.getByText('Leave this trip')).toBeTruthy();
    expect(crewProps.last).toMatchObject({ mine: false });
  });

  it('asks first, and on confirm declines, goes back and reloads both lists', async () => {
    const navigation = show();
    fireEvent.click(screen.getByRole('button', { name: /Leave this trip/ }));
    expect(alert).toHaveBeenCalledWith(
      'Leave this trip?',
      '"Old Quarter crawl" will leave your list, and the planner will see you can\'t make it.',
      expect.any(Array),
    );
    expect(answerInvite).not.toHaveBeenCalled();
    await act(async () => pressInAlert('Leave'));
    expect(answerInvite).toHaveBeenCalledWith('t1', 'declined');
    await waitFor(() => expect(navigation.goBack).toHaveBeenCalled());
    expect(tripsReload).toHaveBeenCalled();
    expect(invitesReload).toHaveBeenCalled();
    expect(deleteTrip).not.toHaveBeenCalled();
    expect(cancelTripReminder).not.toHaveBeenCalled();
  });

  it('says why leaving failed and stays on the trip', async () => {
    answerInvite.mockRejectedValueOnce(new Error('nope'));
    const navigation = show();
    fireEvent.click(screen.getByRole('button', { name: /Leave this trip/ }));
    await act(async () => pressInAlert('Leave'));
    await waitFor(() => expect(alert).toHaveBeenLastCalledWith('Could not leave', 'nope'));
    expect(navigation.goBack).not.toHaveBeenCalled();
  });
});
