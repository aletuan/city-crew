// @vitest-environment jsdom
//
// The two facts the Account row for trip reminders turns on, held once:
// read at launch and on every return to the foreground, changed by the
// switch, and never raising the permission sheet but for the reader's own
// press.

import React, { useEffect } from 'react';
import { AppState } from 'react-native';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, render, screen } from '../uitest/render';

const os = vi.hoisted(() => ({
  status: 'undetermined' as 'granted' | 'denied' | 'undetermined',
  allow: true,
}));
const asked = vi.hoisted(() => vi.fn(async () => os.allow));
const pulled = vi.hoisted(() => vi.fn(async () => {}));
vi.mock('./reminders', () => ({
  reminderPermission: async () => os.status,
  askReminderPermission: asked,
  cancelAllTripReminders: pulled,
}));

import { resetReminderPref, useReminderPref, useReminderPrefWatch } from './reminderPref';

let last: ReturnType<typeof useReminderPref>;
function Probe() {
  useReminderPrefWatch();
  const got = useReminderPref();
  useEffect(() => { last = got; });
  return <span data-testid="s">{String(got.state)}</span>;
}
const shown = () => screen.getByTestId('s').textContent;
const settle = () => act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });

const handlers: ((s: string) => void)[] = [];
beforeEach(async () => {
  vi.clearAllMocks();
  handlers.length = 0;
  vi.spyOn(AppState, 'addEventListener').mockImplementation((_t, fn) => {
    handlers.push(fn as (s: string) => void);
    return { remove: () => {} } as unknown as ReturnType<typeof AppState.addEventListener>;
  });
  os.status = 'undetermined';
  os.allow = true;
  await AsyncStorage.removeItem('reminders:off');
  vi.mocked(AsyncStorage.removeItem).mockClear();
  vi.mocked(AsyncStorage.setItem).mockClear();
  resetReminderPref();
});

describe('useReminderPref', () => {
  it('is nothing until the phone and the storage have answered, then what they say', async () => {
    render(<Probe />);
    expect(shown()).toBe('null');
    await settle();
    expect(shown()).toBe('ask');
  });

  it('reads the reader’s stored off', async () => {
    os.status = 'granted';
    await AsyncStorage.setItem('reminders:off', '1');
    render(<Probe />);
    await settle();
    expect(shown()).toBe('off');
    expect(last.off).toBe(true);
  });

  it('reads a storage that will not answer as the default, on', async () => {
    os.status = 'granted';
    vi.mocked(AsyncStorage.getItem).mockRejectedValueOnce(new Error('no'));
    render(<Probe />);
    await settle();
    expect(shown()).toBe('on');
  });

  it('reads again on every return to the foreground, and not on the way out', async () => {
    os.status = 'denied';
    render(<Probe />);
    await settle();
    expect(shown()).toBe('blocked');
    // Switched on in iOS Settings, and the app brought back.
    os.status = 'granted';
    await act(async () => { handlers.forEach((h) => h('background')); });
    await settle();
    expect(shown()).toBe('blocked');
    await act(async () => { handlers.forEach((h) => h('active')); });
    await settle();
    expect(shown()).toBe('on');
  });
});

describe('the switch', () => {
  it('raises the sheet when never asked, and is on once allowed, with the stored off cleared', async () => {
    await AsyncStorage.setItem('reminders:off', '1');
    render(<Probe />);
    await settle();
    expect(shown()).toBe('ask');
    await act(async () => { await last.setOn(true); });
    expect(asked).toHaveBeenCalledTimes(1);
    expect(shown()).toBe('on');
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('reminders:off');
  });

  it('is blocked when the sheet is refused: the phone will not ask again', async () => {
    render(<Probe />);
    await settle();
    os.allow = false;
    os.status = 'denied';
    await act(async () => { await last.setOn(true); });
    expect(shown()).toBe('blocked');
    expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
  });

  it('pulls every planted note when switched off, and remembers it on this phone', async () => {
    os.status = 'granted';
    render(<Probe />);
    await settle();
    expect(shown()).toBe('on');
    await act(async () => { await last.setOn(false); });
    expect(shown()).toBe('off');
    expect(pulled).toHaveBeenCalledTimes(1);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('reminders:off', '1');
  });

  it('is on again from off without asking the phone: it was allowed all along', async () => {
    os.status = 'granted';
    await AsyncStorage.setItem('reminders:off', '1');
    render(<Probe />);
    await settle();
    await act(async () => { await last.setOn(true); });
    expect(shown()).toBe('on');
  });

  it('survives storage that will not write', async () => {
    os.status = 'granted';
    render(<Probe />);
    await settle();
    vi.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error('full'));
    await act(async () => { await last.setOn(false); });
    expect(shown()).toBe('off');
    vi.mocked(AsyncStorage.removeItem).mockRejectedValueOnce(new Error('full'));
    await act(async () => { await last.setOn(true); });
    expect(shown()).toBe('on');
  });
});
