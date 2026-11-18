// @vitest-environment jsdom
//
// When the switches are read: as the app opens, as whoever the phone
// remembers; and again each time who is signed in changes — as somebody
// on a sign in, as nobody on a sign out — and not on a render that
// changed nothing.

import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, render } from '../uitest/render';

const state = vi.hoisted(() => ({ me: null as string | null }));
vi.mock('./auth', () => ({ useSession: () => ({ session: state.me ? { user: { id: state.me } } : null }) }));
const client = vi.hoisted(() => ({ is: 'the client' }));
vi.mock('./supabase', () => ({ supabase: client }));
const load = vi.hoisted(() => vi.fn(async (_c: unknown, _signedIn?: boolean) => {}));
vi.mock('./flags', () => ({ appFlags: { load } }));

import { FlagsSync } from './flagsSync';

beforeEach(() => { vi.clearAllMocks(); state.me = null; });
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
