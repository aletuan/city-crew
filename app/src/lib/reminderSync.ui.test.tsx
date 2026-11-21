// @vitest-environment jsdom
//
// When the sync runs, and against what: only once both lists are answers
// from the network (not the launch's cached copy), with the trips the
// reader is going on, and not again on a render that changed nothing.

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '../uitest/render';

const sync = vi.hoisted(() => vi.fn(async (..._a: unknown[]) => {}));
const cancelAll = vi.hoisted(() => vi.fn(async () => {}));
const pref = vi.hoisted(() => ({ off: false as boolean | null, status: 'granted' as string | null }));
const state = vi.hoisted(() => ({
  trips: { data: [] as unknown[], loading: false, loaded: true, fromCache: false, error: null as Error | null },
  invites: { data: [] as unknown[], loading: false, loaded: true, error: null as Error | null },
}));

vi.mock('./reminders', () => ({ syncTripReminders: sync, cancelAllTripReminders: cancelAll }));
vi.mock('./reminderPref', () => ({ useReminderPref: () => pref, useReminderPrefWatch: () => {} }));
vi.mock('./auth', () => {
  const m = { useAuth: () => ({ session: { user: { id: 'me' } } }) };
  const all = () => (m as { useAuth: () => object }).useAuth();
  return { ...m, useSession: all, useProfile: all, useAuthActions: all, useAuthEvent: () => {} };
});
vi.mock('./i18n', () => ({ useI18n: () => ({ lang: 'en', t: (en: string) => en }) }));
vi.mock('./mytrips', () => ({ useMyTrips: () => state.trips }));
vi.mock('./invitations', () => ({ useInvitations: () => ({ invites: state.invites }) }));

import { ReminderSync } from './reminderSync';

const trip = (id: string, owner_id: string, stops: { arrive_min: number | null }[] = []) =>
  ({ id, owner_id, day: '2026-09-20', title: `Trip ${id}`, trip_stops: stops });

beforeEach(() => {
  vi.clearAllMocks();
  pref.off = false;
  pref.status = 'granted';
  state.trips = { data: [], loading: false, loaded: true, fromCache: false, error: null };
  state.invites = { data: [], loading: false, loaded: true, error: null };
});

describe('ReminderSync', () => {
  it('syncs the trips the reader is going on — planned or accepted, not merely asked', () => {
    state.trips.data = [trip('own', 'me', [{ arrive_min: 18 * 60 }]), trip('yes', 'host'), trip('asked', 'host')];
    state.invites.data = [
      { trip_id: 'yes', invitee_id: 'me', status: 'accepted' },
      { trip_id: 'asked', invitee_id: 'me', status: 'pending' },
    ];
    render(<ReminderSync />);
    expect(sync).toHaveBeenCalledTimes(1);
    const [want, t] = sync.mock.calls[0] as [{ tripId: string; startMin: number | null }[], (en: string) => string];
    expect(want.map((w) => w.tripId)).toEqual(['own', 'yes']);
    // The first stop's hour rides along, for the day-of note.
    expect(want.map((w) => w.startMin)).toEqual([18 * 60, null]);
    expect(t('Tomorrow: Trip own')).toBe('Tomorrow: Trip own');
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

  // The reader's own switch (Account, 21 Nov 2026): off pulls what is
  // planted and plants nothing; and the sync waits to know, so a launch
  // does not plant for the instant before the storage answers.
  it('pulls the notes and plants none while the reader has them switched off', () => {
    state.trips.data = [trip('own', 'me')];
    pref.off = true;
    render(<ReminderSync />);
    expect(cancelAll).toHaveBeenCalledTimes(1);
    expect(sync).not.toHaveBeenCalled();
  });

  it('waits for both the switch and the permission to be known', () => {
    state.trips.data = [trip('own', 'me')];
    pref.off = null;
    const { rerender } = render(<ReminderSync />);
    pref.off = false;
    pref.status = null;
    rerender(<ReminderSync />);
    expect(sync).not.toHaveBeenCalled();
    expect(cancelAll).not.toHaveBeenCalled();
    pref.status = 'granted';
    rerender(<ReminderSync />);
    expect(sync).toHaveBeenCalledTimes(1);
  });

  it('reconciles again when the switch goes on, or the permission is given in Settings', () => {
    state.trips.data = [trip('own', 'me')];
    pref.off = true;
    pref.status = 'granted';
    const { rerender } = render(<ReminderSync />);
    pref.off = false;
    rerender(<ReminderSync />);
    expect(sync).toHaveBeenCalledTimes(1);
    pref.status = 'denied';
    rerender(<ReminderSync />);
    pref.status = 'granted';
    rerender(<ReminderSync />);
    expect(sync).toHaveBeenCalledTimes(3);
  });
});
