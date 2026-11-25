// @vitest-environment jsdom
//
// When the switches are read: as the app opens, as whoever the phone
// remembers; and again each time who is signed in changes — as somebody
// on a sign in, as nobody on a sign out — and not on a render that
// changed nothing.

import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, render, waitFor } from '../uitest/render';

const state = vi.hoisted(() => ({ me: null as string | null }));
vi.mock('./auth', () => ({ useSession: () => ({ session: state.me ? { user: { id: state.me } } : null }) }));
const client = vi.hoisted(() => ({ is: 'the client' }));
vi.mock('./supabase', () => ({ supabase: client }));
const load = vi.hoisted(() => vi.fn(async (_c: unknown, _signedIn?: boolean) => false));
const restore = vi.hoisted(() => vi.fn((_saved: unknown) => {}));
const snapshot = vi.hoisted(() => vi.fn(() => ({ checkin_photos: true })));
vi.mock('./flags', () => ({ appFlags: { load, restore, snapshot } }));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { FLAGS_KEY, FlagsSync } from './flagsSync';

beforeEach(async () => {
  vi.clearAllMocks();
  load.mockImplementation(async () => false);
  state.me = null;
  await AsyncStorage.removeItem(FLAGS_KEY);
});
afterEach(cleanup);

it('reads as nobody when the app opens signed out, and draws nothing', () => {
  const { container } = render(<FlagsSync />);
  expect(load).toHaveBeenCalledExactlyOnceWith(client, false);
  expect(container.innerHTML).toBe('');
});

it('reads as somebody when the phone remembers who', () => {
  state.me = 'u1';
  render(<FlagsSync />);
  expect(load).toHaveBeenCalledExactlyOnceWith(client, true);
});

it('reads again on a sign in, on a change of account, and on a sign out — and not otherwise', () => {
  const { rerender } = render(<FlagsSync />);
  rerender(<FlagsSync />);
  expect(load).toHaveBeenCalledTimes(1);
  state.me = 'u1';
  rerender(<FlagsSync />);
  expect(load).toHaveBeenLastCalledWith(client, true);
  state.me = 'u2';
  rerender(<FlagsSync />);
  expect(load).toHaveBeenCalledTimes(3);
  state.me = null;
  rerender(<FlagsSync />);
  expect(load).toHaveBeenCalledTimes(4);
  expect(load).toHaveBeenLastCalledWith(client, false);
});

// The last answer kept on the phone (owner, 25 Nov 2026).
it('puts the last launch’s answer back as it opens', async () => {
  await AsyncStorage.setItem(FLAGS_KEY, JSON.stringify({ checkin_photos: true }));
  render(<FlagsSync />);
  await waitFor(() => expect(restore).toHaveBeenCalledWith({ checkin_photos: true }));
});

it('puts nothing back on a first launch, or from a blob it cannot read', async () => {
  render(<FlagsSync />);
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
  cleanup();
  await AsyncStorage.setItem(FLAGS_KEY, '{not json');
  render(<FlagsSync />);
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
  expect(restore).not.toHaveBeenCalled();
});

it('keeps an answer the table gave, and nothing when it gave none', async () => {
  render(<FlagsSync />);
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
  expect(await AsyncStorage.getItem(FLAGS_KEY)).toBeNull();
  cleanup();
  load.mockImplementation(async () => true);
  render(<FlagsSync />);
  await waitFor(async () => expect(await AsyncStorage.getItem(FLAGS_KEY)).toBe('{"checkin_photos":true}'));
});
