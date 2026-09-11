// @vitest-environment jsdom
//
// When the sync runs, and against what: only once both lists are answers
// from the network (not the launch's cached copy), with the trips the
// reader is going on, and not again on a render that changed nothing.

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '../uitest/render';

const sync = vi.hoisted(() => vi.fn(async (..._a: unknown[]) => {}));
const state = vi.hoisted(() => ({
  trips: { data: [] as unknown[], loading: false, loaded: true, fromCache: false, error: null as Error | null },
  invites: { data: [] as unknown[], loading: false, loaded: true, error: null as Error | null },
}));

vi.mock('./reminders', () => ({ syncTripReminders: sync }));
vi.mock('./auth', () => ({ useAuth: () => ({ session: { user: { id: 'me' } } }) }));
vi.mock('./i18n', () => ({ useI18n: () => ({ lang: 'en', t: (en: string) => en }) }));
vi.mock('./mytrips', () => ({ useMyTrips: () => state.trips }));
vi.mock('./invitations', () => ({ useInvitations: () => ({ invites: state.invites }) }));

import { ReminderSync } from './reminderSync';

const trip = (id: string, owner_id: string) => ({ id, owner_id, day: '2026-09-20', title: `Trip ${id}` });

beforeEach(() => {
  vi.clearAllMocks();
  state.trips = { data: [], loading: false, loaded: true, fromCache: false, error: null };
  state.invites = { data: [], loading: false, loaded: true, error: null };
});

describe('ReminderSync', () => {
  it('syncs the trips the reader is going on — planned or accepted, not merely asked', () => {
    state.trips.data = [trip('own', 'me'), trip('yes', 'host'), trip('asked', 'host')];
    state.invites.data = [
      { trip_id: 'yes', invitee_id: 'me', status: 'accepted' },
      { trip_id: 'asked', invitee_id: 'me', status: 'pending' },
    ];
    render(<ReminderSync />);
    expect(sync).toHaveBeenCalledTimes(1);
    const [want, text] = sync.mock.calls[0] as [{ tripId: string }[], (w: { title: string }) => { title: string }];
    expect(want.map((w) => w.tripId)).toEqual(['own', 'yes']);
    expect(text({ title: 'Trip own' }).title).toBe('Tomorrow: Trip own');
  });

  it('waits for the network: not on the cached launch copy, a load in flight, or an error', () => {
    state.trips.fromCache = true;
    const { rerender } = render(<ReminderSync />);
    state.trips = { ...state.trips, fromCache: false, loading: true };
    rerender(<ReminderSync />);
    state.trips = { ...state.trips, loading: false };
    state.invites = { ...state.invites, error: new Error('offline') };
    rerender(<ReminderSync />);
    expect(sync).not.toHaveBeenCalled();
    state.invites = { ...state.invites, error: null };
    rerender(<ReminderSync />);
    expect(sync).toHaveBeenCalledTimes(1);
  });

  it('does not re-read the phone on a render that changed nothing, and does when a trip goes', () => {
    state.trips.data = [trip('own', 'me'), trip('two', 'me')];
    const { rerender } = render(<ReminderSync />);
    state.trips = { ...state.trips, data: [trip('own', 'me'), trip('two', 'me')] };
    rerender(<ReminderSync />);
    expect(sync).toHaveBeenCalledTimes(1);
    state.trips = { ...state.trips, data: [trip('own', 'me')] };
    rerender(<ReminderSync />);
    expect(sync).toHaveBeenCalledTimes(2);
  });
});
