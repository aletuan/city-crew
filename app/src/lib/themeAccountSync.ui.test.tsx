// @vitest-environment jsdom
//
// The theme following the account: the four rules in the module's header,
// each as a sign-in, and the two things it must leave alone — a sign-out,
// and a look this build has not heard of.

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '../uitest/render';

const world = vi.hoisted(() => ({
  userId: undefined as string | null | undefined,
  pref: 'system' as string,
  look: 'standard' as string,
  ready: true,
  remote: null as string | null,
  tab: 'Explore' as string | undefined,
}));
const setPref = vi.hoisted(() => vi.fn());
const data = vi.hoisted(() => ({
  fetchTheme: vi.fn(async () => world.remote),
  saveTheme: vi.fn(async () => {}),
}));

vi.mock('./auth', () => {
  const m = { useAuth: () => ({ userId: world.userId }) };
  const all = () => (m as { useAuth: () => object }).useAuth();
  return { ...m, useSession: all, useProfile: all, useAuthActions: all, useAuthEvent: () => {} };
});
vi.mock('./theme', () => ({
  useScheme: () => ({ pref: world.pref, look: world.look, ready: world.ready, setPref }),
}));
vi.mock('./data', () => data);
vi.mock('../nav', () => ({
  navRef: {
    isReady: () => world.tab !== undefined,
    getRootState: () => ({ index: 0, routes: [{ name: world.tab }] }),
  },
}));

import { ThemeAccountSync } from './themeAccountSync';

const signedIn = async (id = 'me') => {
  world.userId = id;
  const r = render(<ThemeAccountSync />);
  await waitFor(() => expect(data.fetchTheme).toHaveBeenCalledWith(id));
  return r;
};
const settle = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  world.userId = undefined;
  world.pref = 'system';
  world.look = 'standard';
  world.ready = true;
  world.remote = null;
  world.tab = 'Explore';
  setPref.mockClear();
  data.fetchTheme.mockClear();
  data.saveTheme.mockClear();
});

describe('on signing in', () => {
  // Rule 4: never chose → the device's theme becomes the account's.
  it('gives an account that never chose the device\u2019s theme, and restarts nothing', async () => {
    world.pref = 'dark';
    await signedIn();
    await waitFor(() => expect(data.saveTheme).toHaveBeenCalledWith('me', 'dark'));
    expect(setPref).not.toHaveBeenCalled();
  });

  // Rule 2, a ground: put on at once, nowhere to come back to.
  it('puts on the account\u2019s ground at once', async () => {
    world.remote = 'light';
    await signedIn();
    await waitFor(() => expect(setPref).toHaveBeenCalledWith('light', undefined));
    expect(data.saveTheme).not.toHaveBeenCalled();
  });

  // Rule 2, a look: a restart, back to the tab the reader is on, and no
  // sheet.
  it('restarts into the account\u2019s look, back to the tab the reader is on', async () => {
    world.remote = 'cosmic';
    world.tab = 'Collections';
    await signedIn();
    await waitFor(() => expect(setPref).toHaveBeenCalledWith('cosmic', { tab: 'Collections' }));
  });

  it('restarts to wherever the launch lands when the navigator cannot say', async () => {
    world.remote = 'cosmic';
    world.tab = undefined;
    await signedIn();
    await waitFor(() => expect(setPref).toHaveBeenCalledWith('cosmic', undefined));
  });

  it('changes nothing when the account already wears what the device does', async () => {
    world.pref = 'wine';
    world.look = 'wine';
    world.remote = 'wine';
    await signedIn();
    await settle();
    expect(setPref).not.toHaveBeenCalled();
    expect(data.saveTheme).not.toHaveBeenCalled();
  });

  // A newer build's look: not put on, and not overwritten with Auto.
  it('leaves a theme this build does not know alone, both ways', async () => {
    world.remote = 'aurora';
    await signedIn();
    await settle();
    expect(setPref).not.toHaveBeenCalled();
    expect(data.saveTheme).not.toHaveBeenCalled();
  });

  it('reads once per account, not once per render', async () => {
    world.remote = 'light';
    const { rerender } = await signedIn();
    rerender(<ThemeAccountSync />);
    rerender(<ThemeAccountSync />);
    await settle();
    expect(data.fetchTheme).toHaveBeenCalledTimes(1);
  });

  it('waits for the stored theme to be read before comparing', async () => {
    world.ready = false;
    world.userId = 'me';
    world.remote = 'light';
    const { rerender } = render(<ThemeAccountSync />);
    await settle();
    expect(data.fetchTheme).not.toHaveBeenCalled();
    world.ready = true;
    rerender(<ThemeAccountSync />);
    await waitFor(() => expect(setPref).toHaveBeenCalledWith('light', undefined));
  });
});

describe('on signing out, and on a switch', () => {
  // Rule 3: nothing. The device keeps the look it has.
  it('changes nothing on a sign-out', async () => {
    world.remote = 'light';
    const { rerender } = await signedIn();
    await waitFor(() => expect(setPref).toHaveBeenCalledTimes(1));
    world.userId = null;
    rerender(<ThemeAccountSync />);
    await settle();
    expect(setPref).toHaveBeenCalledTimes(1);
    expect(data.fetchTheme).toHaveBeenCalledTimes(1);
  });

  it('reads the next account\u2019s theme after a switch', async () => {
    world.remote = 'light';
    const { rerender } = await signedIn('a');
    world.userId = null;
    rerender(<ThemeAccountSync />);
    world.userId = 'b';
    world.remote = 'honey';
    rerender(<ThemeAccountSync />);
    await waitFor(() => expect(setPref).toHaveBeenCalledWith('honey', { tab: 'Explore' }));
    expect(data.fetchTheme).toHaveBeenCalledTimes(2);
  });
});
