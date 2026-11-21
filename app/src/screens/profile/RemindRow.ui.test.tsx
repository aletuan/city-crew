// @vitest-environment jsdom
//
// Profile's row for trip reminders (21 Nov 2026): not drawn on a guess, a
// switch where pressing it can work, and a way into iOS Settings where
// only the reader can.

import { Linking } from 'react-native';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '../../uitest/render';

const pref = vi.hoisted(() => ({ state: null as string | null, setOn: vi.fn(async (_on: boolean) => {}) }));
vi.mock('../../lib/i18n', () => ({ useI18n: () => ({ t: (en: string) => en }) }));
vi.mock('../../lib/reminderPref', () => ({ useReminderPref: () => pref }));

import { RemindRow } from './RemindRow';

beforeEach(() => { vi.clearAllMocks(); pref.state = null; });

describe('RemindRow', () => {
  it('is not drawn until the phone and the storage have answered', () => {
    render(<RemindRow />);
    expect(screen.queryByTestId('profile-reminders')).toBeNull();
  });

  it.each([['on', true], ['off', false], ['ask', false]])('is a switch when %s, and %s as it stands', (state, on) => {
    pref.state = state;
    render(<RemindRow />);
    expect(screen.getByText('Trip reminders')).toBeTruthy();
    expect(screen.getByRole('switch', { name: 'Trip reminders' })).toBeTruthy();
    expect((screen.getByRole('switch') as HTMLInputElement).checked).toBe(on);
  });

  it('turns them on with a press on a switch that is off, and off with one that is on', () => {
    pref.state = 'ask';
    const { unmount } = render(<RemindRow />);
    fireEvent.click(screen.getByRole('switch'));
    expect(pref.setOn).toHaveBeenLastCalledWith(true);
    unmount();
    pref.state = 'on';
    render(<RemindRow />);
    fireEvent.click(screen.getByRole('switch'));
    expect(pref.setOn).toHaveBeenLastCalledWith(false);
  });

  it('is no switch where iOS refused, but a row that opens the phone’s Settings', () => {
    pref.state = 'blocked';
    const open = vi.fn(async () => {});
    (Linking as unknown as { openSettings?: () => Promise<void> }).openSettings = open;
    render(<RemindRow />);
    expect(screen.queryByRole('switch')).toBeNull();
    expect(screen.getByText('Off in Settings')).toBeTruthy();
    fireEvent.click(screen.getByTestId('profile-reminders'));
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('does not fail on a phone that will not open Settings', () => {
    pref.state = 'blocked';
    (Linking as unknown as { openSettings?: () => Promise<void> }).openSettings = async () => { throw new Error('no'); };
    render(<RemindRow />);
    expect(() => fireEvent.click(screen.getByTestId('profile-reminders'))).not.toThrow();
  });
});
