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
//
// The look (Coffee, Rose) is a fourth thing: kept in `Settings`, which the
// runner has no copy of, so a stand-in keeps it in a plain object — and
// leaving that out stands in for the web build, which cannot keep one.

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, render, screen, waitFor } from '../uitest/render';

const rn = vi.hoisted(() => ({
  kept: {} as Record<string, unknown>,
  settings: true,
  reload: vi.fn(),
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
  get Settings() {
    return rn.settings
      ? { get: (k: string) => rn.kept[k], set: (v: Record<string, unknown>) => { Object.assign(rn.kept, v); } }
      : undefined;
  },
  DevSettings: { reload: rn.reload },
}));
const updates = vi.hoisted(() => ({ reloadAsync: vi.fn(async () => {}) }));
vi.mock('expo-updates', () => updates);

import { ThemeProvider, useScheme } from './theme';

const KEY = 'citycrew.scheme';

function Probe() {
  const { scheme, pref, setPref, look, looks, ready, resume, claimResume } = useScheme();
  const [claimed, setClaimed] = React.useState<string>('');
  return (
    <>
      <span data-testid="scheme">{scheme}</span>
      <span data-testid="pref">{pref}</span>
      <span data-testid="look">{look}</span>
      <span data-testid="looks">{String(looks)}</span>
      <span data-testid="ready">{String(ready)}</span>
      <span data-testid="resume">{resume ? `${resume.tab}/${resume.sheet ?? '-'}/${resume.y ?? '-'}` : 'none'}</span>
      <span data-testid="claimed">{claimed}</span>
      <button type="button" onClick={() => setClaimed(JSON.stringify(claimResume()))}>claim</button>
      <button type="button" onClick={() => setPref('navy', { tab: 'Profile', sheet: 'theme', y: 420 })}>navy, from Profile</button>
      <button type="button" onClick={() => setPref('system')}>auto</button>
      <button type="button" onClick={() => setPref('light')}>light</button>
      <button type="button" onClick={() => setPref('dark')}>dark</button>
      <button type="button" onClick={() => setPref('coffee')}>coffee</button>
      <button type="button" onClick={() => setPref('rose')}>rose</button>
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
  rn.kept = {};
  rn.settings = true;
  rn.reload.mockClear();
  updates.reloadAsync.mockReset().mockResolvedValue(undefined);
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

describe('another look', () => {
  const LOOK = 'citycrew.look';
  const text = (id: string) => screen.getByTestId(id).textContent;

  // The colours are built once at import, so a look is a restart: kept
  // first, where the next launch's import will find it, then reloaded.
  it('keeps the look and the setting, then restarts into them', async () => {
    mount();
    await settled();
    rn.set.mockClear();
    act(() => { screen.getByText('coffee').click(); });
    await waitFor(() => expect(updates.reloadAsync).toHaveBeenCalledTimes(1));
    expect(rn.kept[LOOK]).toBe('coffee');
    expect(await AsyncStorage.getItem(KEY)).toBe('coffee');
    // Nothing repaints on the way out: the window pinned dark over the
    // standard colours would be a frame of neither.
    expect(rn.set).not.toHaveBeenCalled();
    expect(text('pref')).toBe('system');
  });

  // A development client refuses `reloadAsync`.
  it('falls back to the packager’s reload where the update one is refused', async () => {
    updates.reloadAsync.mockRejectedValue(new Error('not in development'));
    mount();
    await settled();
    act(() => { screen.getByText('rose').click(); });
    await waitFor(() => expect(rn.reload).toHaveBeenCalledTimes(1));
  });

  // Where the reader was rides in beside the look, for the launch after
  // the restart; a choice made from nowhere in particular keeps nothing.
  it('keeps where the reader was, beside the look, when told', async () => {
    const RETURN = 'citycrew.look.return';
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(1_700_000_000_000));
    mount();
    await settled();
    act(() => { screen.getByText('navy, from Profile').click(); });
    await waitFor(() => expect(updates.reloadAsync).toHaveBeenCalledTimes(1));
    expect(rn.kept[LOOK]).toBe('navy');
    expect(JSON.parse(rn.kept[RETURN] as string)).toEqual({ tab: 'Profile', sheet: 'theme', y: 420, at: 1_700_000_000_000 });
    vi.useRealTimers();
  });

  it('keeps no return for a look chosen from nowhere', async () => {
    mount();
    await settled();
    act(() => { screen.getByText('coffee').click(); });
    await waitFor(() => expect(updates.reloadAsync).toHaveBeenCalledTimes(1));
    expect(rn.kept['citycrew.look.return']).toBeUndefined();
  });

  // The launch after: the return is read once off the store, offered to
  // the navigator, and handed to the screen that reopens the sheet once.
  it('reads the return back on the next launch, and hands it over once', async () => {
    rn.kept[LOOK] = 'navy';
    rn.kept['citycrew.look.return'] = JSON.stringify({ tab: 'Profile', sheet: 'theme', y: 300, at: Date.now() - 2000 });
    mount();
    await settled();
    expect(text('resume')).toBe('Profile/theme/300');
    expect(rn.kept['citycrew.look.return']).toBe('');
    act(() => { screen.getByText('claim').click(); });
    expect(JSON.parse(text('claimed')!)).toEqual(expect.objectContaining({ tab: 'Profile', sheet: 'theme', y: 300 }));
    act(() => { screen.getByText('claim').click(); });
    expect(text('claimed')).toBe('null');
  });

  it('has nothing to resume on an ordinary launch', async () => {
    mount();
    await settled();
    expect(text('resume')).toBe('none');
    act(() => { screen.getByText('claim').click(); });
    expect(text('claimed')).toBe('null');
  });

  it.each([['coffee', 'dark'], ['rose', 'light']] as const)('wears %s on its own ground, whatever the phone says', async (look, ground) => {
    rn.kept[LOOK] = look;
    await AsyncStorage.setItem(KEY, look);
    rn.get.mockReturnValue(ground === 'dark' ? 'light' : 'dark');
    mount();
    await settled();
    expect(text('look')).toBe(look);
    expect(text('scheme')).toBe(ground);
    expect(rn.set).toHaveBeenLastCalledWith(ground);
    phoneTurns(ground === 'dark' ? 'light' : 'dark');
    expect(text('scheme')).toBe(ground);
  });

  // Leaving a look is a restart too, back into the standard one.
  it('restarts out of a look into the standard one', async () => {
    rn.kept[LOOK] = 'coffee';
    await AsyncStorage.setItem(KEY, 'coffee');
    mount();
    await settled();
    act(() => { screen.getByText('light').click(); });
    await waitFor(() => expect(updates.reloadAsync).toHaveBeenCalledTimes(1));
    expect(rn.kept[LOOK]).toBe('standard');
    expect(await AsyncStorage.getItem(KEY)).toBe('light');
  });

  // The look lost, or kept by a build that knew another: put right for
  // next time, and not restarted into on a launch nobody asked to restart.
  it('mends a look that disagrees with the setting, without restarting', async () => {
    rn.kept[LOOK] = 'coffee';
    await AsyncStorage.setItem(KEY, 'dark');
    mount();
    await settled();
    expect(rn.kept[LOOK]).toBe('standard');
    expect(text('pref')).toBe('dark');
    expect(updates.reloadAsync).not.toHaveBeenCalled();
  });

  it('leaves a look that agrees alone', async () => {
    rn.kept[LOOK] = 'rose';
    await AsyncStorage.setItem(KEY, 'rose');
    mount();
    await settled();
    expect(rn.kept[LOOK]).toBe('rose');
  });

  // The web build: nowhere to keep a look, so a restart would come back
  // as it left. Nothing is offered, and nothing happens if it is asked.
  it('offers no look, and restarts into none, where one cannot be kept', async () => {
    rn.settings = false;
    mount();
    await settled();
    expect(text('looks')).toBe('false');
    act(() => { screen.getByText('coffee').click(); });
    expect(updates.reloadAsync).not.toHaveBeenCalled();
    expect(await AsyncStorage.getItem(KEY)).toBeNull();
    expect(text('pref')).toBe('system');
  });

  it('can keep one on iOS', async () => {
    mount();
    await settled();
    expect(text('looks')).toBe('true');
    expect(text('look')).toBe('standard');
  });
});
