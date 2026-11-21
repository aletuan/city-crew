// @vitest-environment jsdom
//
// The line on a saved trip that says iOS will not let the phone remind the
// reader (21 Nov 2026): drawn only where iOS refused, only where a reminder
// would have been planted, and a way into the phone's Settings.

import { Linking } from 'react-native';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '../uitest/render';

const pref = vi.hoisted(() => ({ state: null as string | null }));
vi.mock('../lib/i18n', () => ({ useI18n: () => ({ t: (en: string) => en }) }));
vi.mock('../lib/reminderPref', () => ({ useReminderPref: () => pref }));

import TripReminderNote from './TripReminderNote';

// Far enough ahead that the clock never decides these.
const trip = (owner_id: string) => ({ id: 't1', owner_id, day: '2999-01-02', title: 'Pho night', trip_stops: [] });
const invite = (status: string) => ({ trip_id: 't1', invitee_id: 'me', status });

beforeEach(() => { pref.state = 'blocked'; });

describe('TripReminderNote', () => {
  it.each([null, 'ask', 'on', 'off'])('says nothing while the permission is %s', (state) => {
    pref.state = state;
    render(<TripReminderNote trip={trip('me')} invites={[]} me="me" />);
    expect(screen.queryByTestId('trip-reminder-note')).toBeNull();
  });

  it('shows to the planner where iOS refused', () => {
    render(<TripReminderNote trip={trip('me')} invites={[]} me="me" />);
    expect(screen.getByText('Your phone won’t remind you about this trip.')).toBeTruthy();
  });

  it('shows to a guest who said yes, and not to one who has only been asked', () => {
    const { unmount } = render(<TripReminderNote trip={trip('host')} invites={[invite('accepted')]} me="me" />);
    expect(screen.getByTestId('trip-reminder-note')).toBeTruthy();
    unmount();
    render(<TripReminderNote trip={trip('host')} invites={[invite('pending')]} me="me" />);
    expect(screen.queryByTestId('trip-reminder-note')).toBeNull();
  });

  it('says nothing about a trip that is over', () => {
    render(<TripReminderNote trip={{ ...trip('me'), day: '2000-01-02' }} invites={[]} me="me" />);
    expect(screen.queryByTestId('trip-reminder-note')).toBeNull();
  });

  it('opens the phone’s Settings, and survives one that will not', () => {
    const open = vi.fn(async () => {});
    (Linking as unknown as { openSettings?: () => Promise<void> }).openSettings = open;
    const { unmount } = render(<TripReminderNote trip={trip('me')} invites={[]} me="me" />);
    fireEvent.click(screen.getByTestId('trip-reminder-note'));
    expect(open).toHaveBeenCalledTimes(1);
    unmount();
    (Linking as unknown as { openSettings?: () => Promise<void> }).openSettings = async () => { throw new Error('no'); };
    render(<TripReminderNote trip={trip('me')} invites={[]} me="me" />);
    expect(() => fireEvent.click(screen.getByTestId('trip-reminder-note'))).not.toThrow();
  });
});
