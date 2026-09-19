// @vitest-environment jsdom
//
// Which ground the app stands on, and who decides.
//
// Three things are worth pinning here and nothing else is. First, the
// stored word is the *setting*, not the ground: `'system'` survives a
// relaunch and is re-read as a deferral, not resolved once into a colour.
// Second, `'system'` reaches the window as `'unspecified'` — React
// Native's word for "stop overriding" — because anything else would keep
// the app's own override in place and the phone's switch would do
// nothing. Third, the phone's switch has to move the React state too: the
// blur tint, the status bar and the ambient glow are not dynamic colours
// and would otherwise stay on last night's ground until the next render.
//
// `Platform.OS` is forced to `'ios'`: `apply` is a no-op everywhere else,
// and the test would pass on an empty function without it.

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, render, screen, waitFor } from '../uitest/render';

const rn = vi.hoisted(() => ({
  set: vi.fn<(s: string) => void>(),
  get: vi.fn<() => string | null>(() => 'light'),
  listeners: [] as ((p: { colorScheme: string | null }) => void)[],
}));
vi.mock('react-native', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  Platform: { OS: 'ios', select: (o: Record<string, unknown>) => o.ios ?? o.default },
  Appearance: {
    setColorScheme: rn.set,
    getColorScheme: rn.get,
    addChangeListener: (fn: (p: { colorScheme: string | null }) => void) => {
      rn.listeners.push(fn);
      return { remove: () => { rn.listeners = rn.listeners.filter((f) => f !== fn); } };
    },
  },
}));

import { ThemeProvider, useScheme } from './theme';

const KEY = 'citycrew.scheme';

function Probe() {
  const { scheme, pref, setPref, ready } = useScheme();
  return (
    <>
      <span data-testid="scheme">{scheme}</span>
      <span data-testid="pref">{pref}</span>
      <span data-testid="ready">{String(ready)}</span>
      <button type="button" onClick={() => setPref('system')}>auto</button>
      <button type="button" onClick={() => setPref('light')}>light</button>
      <button type="button" onClick={() => setPref('dark')}>dark</button>
    </>
  );
}

const mount = () => render(<ThemeProvider><Probe /></ThemeProvider>);
const settled = () => waitFor(() => expect(screen.getByTestId('ready').textContent).toBe('true'));

/** The phone's own switch, as the platform delivers it. */
const phoneTurns = (to: 'dark' | 'light') => act(() => {
  rn.get.mockReturnValue(to);
  rn.listeners.forEach((fn) => fn({ colorScheme: to }));
});

beforeEach(async () => {
  rn.set.mockClear();
  rn.get.mockReset().mockReturnValue('light');
  rn.listeners = [];
  await AsyncStorage.removeItem(KEY);
});

describe('a fresh install', () => {
  // The decision this setting was added to make: nobody is asked, and the
  // app arrives in the ground the rest of the phone is already in.
  it('follows the phone without being told to', async () => {
    mount();
    await settled();
    expect(screen.getByTestId('pref').textContent).toBe('system');
    expect(screen.getByTestId('scheme').textContent).toBe('light');
    expect(rn.set).toHaveBeenCalledWith('unspecified');
  });

  it('stands on dark when the platform will not say', async () => {
    rn.get.mockReturnValue(null);
    mount();
    await settled();
    expect(screen.getByTestId('scheme').textContent).toBe('dark');
  });
});

describe('what the device remembers', () => {
  it.each(['dark', 'light'] as const)('reads back an explicit %s and overrides the window', async (stored) => {
    await AsyncStorage.setItem(KEY, stored);
    mount();
    await settled();
    expect(screen.getByTestId('pref').textContent).toBe(stored);
    expect(screen.getByTestId('scheme').textContent).toBe(stored);
    expect(rn.set).toHaveBeenCalledWith(stored);
  });

  // The regression that would silently undo the feature: storing the
  // resolved colour instead of the deferral. Then a phone switched to
  // dark overnight would still open light, and the setting would read
  // "Light" although nobody chose it.
  it('reads back a deferral as a deferral', async () => {
    await AsyncStorage.setItem(KEY, 'system');
    rn.get.mockReturnValue('dark');
    mount();
    await settled();
    expect(screen.getByTestId('pref').textContent).toBe('system');
    expect(screen.getByTestId('scheme').textContent).toBe('dark');
  });

  it('treats a word it does not know as the default', async () => {
    await AsyncStorage.setItem(KEY, 'sepia');
    mount();
    await settled();
    expect(screen.getByTestId('pref').textContent).toBe('system');
  });

  it('writes the choice, not the ground it resolved to', async () => {
    mount();
    await settled();
    act(() => { screen.getByText('dark').click(); });
    expect(await AsyncStorage.getItem(KEY)).toBe('dark');
    act(() => { screen.getByText('auto').click(); });
    expect(await AsyncStorage.getItem(KEY)).toBe('system');
  });
});

describe('the phone changes its mind', () => {
  it('repaints while the app is deferring to it', async () => {
    await AsyncStorage.setItem(KEY, 'system');
    mount();
    await settled();
    expect(screen.getByTestId('scheme').textContent).toBe('light');
    phoneTurns('dark');
    expect(screen.getByTestId('scheme').textContent).toBe('dark');
  });

  // Someone who picked a ground picked it for good reason — sunset is not
  // an argument against it.
  it('is ignored while a ground was chosen by hand', async () => {
    await AsyncStorage.setItem(KEY, 'light');
    mount();
    await settled();
    phoneTurns('dark');
    expect(screen.getByTestId('scheme').textContent).toBe('light');
  });

  // ...but the change is still remembered, so handing the window back
  // lands on the right ground in the same frame rather than after the
  // next time the phone happens to change.
  it('is caught up with the moment the window is handed back', async () => {
    await AsyncStorage.setItem(KEY, 'light');
    mount();
    await settled();
    phoneTurns('dark');
    act(() => { screen.getByText('auto').click(); });
    expect(screen.getByTestId('scheme').textContent).toBe('dark');
    expect(rn.set).toHaveBeenLastCalledWith('unspecified');
  });
});
