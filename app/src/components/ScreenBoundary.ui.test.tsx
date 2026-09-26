// @vitest-environment jsdom
//
// The two catches that stand between a render error and a blank phone.
// Pinned here: a working screen is left alone; a broken one is replaced by
// a message and nothing else; "Try again" really draws the screen again;
// "Back" appears only where there is somewhere to go back to; and the last
// catch reopens the app, falling back to a redraw where it cannot, in the
// reader's own language.
import React from 'react';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, screen, waitFor } from '../uitest/render';
import { AppBoundary, ScreenBoundary } from './ScreenBoundary';

const updates = vi.hoisted(() => ({ reloadAsync: vi.fn(async () => {}) }));
vi.mock('expo-updates', () => ({ channel: null, ...updates }));

// React writes each caught error to `console.error` on its way past. That
// is React working, not the test failing.
let quiet: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
  updates.reloadAsync.mockReset();
  updates.reloadAsync.mockResolvedValue(undefined);
});
afterEach(async () => {
  quiet.mockRestore();
  await AsyncStorage.setItem('citycrew.lang', 'en');
});

/** Throws for as long as `broken.on` is true — so a test can mend it. */
const broken = { on: true };
function Fragile() {
  if (broken.on) throw new Error('undefined is not an object');
  return <div>the screen</div>;
}

const root = () => ({ canGoBack: vi.fn(() => false), goBack: vi.fn() });
const pushed = () => ({ canGoBack: vi.fn(() => true), goBack: vi.fn() });

describe('ScreenBoundary', () => {
  beforeEach(() => { broken.on = true; });

  it('leaves a screen that works alone', () => {
    broken.on = false;
    render(<ScreenBoundary navigation={root()}><Fragile /></ScreenBoundary>);
    expect(screen.getByText('the screen')).toBeTruthy();
    expect(screen.queryByText('This screen ran into a problem')).toBeNull();
  });

  it('replaces a screen that throws with the message, never with the error', () => {
    render(<ScreenBoundary navigation={root()}><Fragile /></ScreenBoundary>);
    expect(screen.getByText('This screen ran into a problem')).toBeTruthy();
    expect(screen.getByText('The rest of the app still works. Try again, or switch to another tab.')).toBeTruthy();
    // The reader can do nothing with the engine's words; they never show.
    expect(screen.queryByText(/undefined is not an object/)).toBeNull();
  });

  it('offers no way back from the first screen of a tab, because there is none', () => {
    render(<ScreenBoundary navigation={root()}><Fragile /></ScreenBoundary>);
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
  });

  it('draws the screen again on "Try again", and it comes back if it can', () => {
    render(<ScreenBoundary navigation={root()}><Fragile /></ScreenBoundary>);
    broken.on = false;
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(screen.getByText('the screen')).toBeTruthy();
  });

  // A screen that fails every time costs one frame and the same message,
  // never a crash: the redraw is caught again.
  it('lands on the message again when the screen still throws', () => {
    render(<ScreenBoundary navigation={root()}><Fragile /></ScreenBoundary>);
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(screen.getByText('This screen ran into a problem')).toBeTruthy();
  });

  it('on a pushed screen, says so and goes back from either button', () => {
    const nav = pushed();
    render(<ScreenBoundary navigation={nav}><Fragile /></ScreenBoundary>);
    expect(screen.getByText('The rest of the app still works. Try again, or go back to the previous screen.')).toBeTruthy();
    const backs = screen.getAllByRole('button', { name: 'Back' });
    // The round one in the corner, where every screen keeps it, and the
    // word under "Try again".
    expect(backs).toHaveLength(2);
    fireEvent.click(backs[0]);
    fireEvent.click(backs[1]);
    expect(nav.goBack).toHaveBeenCalledTimes(2);
  });
});

describe('AppBoundary', () => {
  beforeEach(() => { broken.on = true; });

  it('leaves the app alone while it works', () => {
    broken.on = false;
    render(<AppBoundary><Fragile /></AppBoundary>);
    expect(screen.getByText('the screen')).toBeTruthy();
  });

  it('reopens the app in place when everything has failed', async () => {
    render(<AppBoundary><Fragile /></AppBoundary>);
    expect(screen.getByText('City Crew ran into a problem')).toBeTruthy();
    expect(screen.getByText('Everything you saved is still there. Reopen the app to carry on.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Reopen the app' }));
    await waitFor(() => expect(updates.reloadAsync).toHaveBeenCalledTimes(1));
  });

  // A development client refuses `reloadAsync`. A redraw is the same
  // thing as far as a render error goes, so the button still does
  // something rather than nothing.
  it('draws everything again where the app cannot be reloaded', async () => {
    updates.reloadAsync.mockRejectedValueOnce(new Error('not supported'));
    render(<AppBoundary><Fragile /></AppBoundary>);
    broken.on = false;
    fireEvent.click(screen.getByRole('button', { name: 'Reopen the app' }));
    await waitFor(() => expect(screen.getByText('the screen')).toBeTruthy());
  });

  // The provider the app reads sits inside this boundary and may be what
  // broke, so the message brings its own — which still knows the language
  // the reader chose.
  it('speaks the language the reader chose, with its own copy of the provider', async () => {
    await AsyncStorage.setItem('citycrew.lang', 'vi');
    render(<AppBoundary><Fragile /></AppBoundary>);
    expect(await screen.findByText('City Crew gặp lỗi')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Mở lại app' })).toBeTruthy();
  });
});

// The boundaries only protect what they are fitted to, and `App.tsx` has
// no test of its own. So this reads it, the way `icons.test.ts` reads
// source: a sixth stack added without `screenLayout` would leave every
// screen in it with no catch at all, and nothing else would notice.
describe('the wiring', () => {
  const APP = join(__dirname, '..', '..', 'App.tsx');
  const app = readFileSync(APP, 'utf8');

  it('fits a catch to every stack in the app', () => {
    const stacks = app.match(/<Stack\.Navigator\b[^>]*>/g) ?? [];
    expect(stacks.length).toBeGreaterThan(0);
    for (const tag of stacks) expect(tag).toContain('screenLayout={screenLayout}');
  });

  it('keeps the last catch around the providers', () => {
    expect(app).toMatch(/<AppBoundary>[\s\S]*<AuthProvider>[\s\S]*<\/AuthProvider>[\s\S]*<\/AppBoundary>/);
  });

  // The two checks above read one file. That is enough only while one
  // file makes navigators; if another starts to, this fails and says
  // which, so the checks can be pointed at it too.
  it('has no navigator made anywhere but App.tsx', () => {
    const walk = (dir: string): string[] => readdirSync(dir).flatMap((name) => {
      const f = join(dir, name);
      return statSync(f).isDirectory() ? walk(f) : [f];
    });
    const makers = walk(join(__dirname, '..'))
      .filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f))
      .filter((f) => /create(NativeStack|Stack|BottomTab)Navigator\(/.test(readFileSync(f, 'utf8')));
    expect(makers).toEqual([]);
  });
});
