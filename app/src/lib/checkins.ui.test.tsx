// @vitest-environment jsdom
//
// The check-ins provider's promises, rendered: held until auth decides
// who is asking, a guest answered off the network, the last session's
// list painted before the network answers, and one reload landing in
// the list every screen draws — the seam the first phone found.

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, screen, waitFor } from '../uitest/render';
import { cacheKey, packCache } from './data/cache';
import type { Checkin } from './checkin';

const world = vi.hoisted(() => ({
  ready: true,
  session: { user: { id: 'u1' } } as { user: { id: string } } | null,
  rows: [] as unknown[],
}));
const fetchMyCheckins = vi.hoisted(() => vi.fn(async () => [...world.rows]));

vi.mock('./auth', () => ({ useAuth: () => ({ ready: world.ready, session: world.session }) }));
vi.mock('./data', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  fetchMyCheckins,
}));

import { CheckinsProvider, useMyCheckins } from './checkins';

const visit = (id: string): Checkin => ({ id, place_slug: id, city_id: 'hanoi', at: '2026-10-08T03:00:00Z' });

/** Two consumers — the pill and the profile — because "one copy" is the
 *  claim under test: what one reloads, the other must already draw. */
function Probe({ name }: { name: string }) {
  const visits = useMyCheckins();
  return (
    <>
      <span data-testid={`${name}-count`}>{String(visits.data.length)}</span>
      <span data-testid={`${name}-cache`}>{String(visits.fromCache)}</span>
      <button type="button" onClick={() => visits.reload()}>{`${name}-reload`}</button>
    </>
  );
}
const mount = () => render(
  <CheckinsProvider>
    <Probe name="pill" />
    <Probe name="profile" />
  </CheckinsProvider>,
);

beforeEach(async () => {
  world.ready = true;
  world.session = { user: { id: 'u1' } };
  world.rows = [visit('a')];
  fetchMyCheckins.mockClear();
  for (const uid of ['u1', 'u2']) await AsyncStorage.removeItem(cacheKey('checkins', 'all', uid));
});

describe('who is asking', () => {
  it('holds the question until auth has decided', async () => {
    world.ready = false;
    mount();
    await waitFor(() => expect(screen.getByTestId('pill-count').textContent).toBe('0'));
    expect(fetchMyCheckins).not.toHaveBeenCalled();
  });
  it('answers a guest with an empty list, off the network', async () => {
    world.session = null;
    mount();
    await waitFor(() => expect(screen.getByTestId('pill-count').textContent).toBe('0'));
    expect(fetchMyCheckins).not.toHaveBeenCalled();
  });
  it('asks for the account on the session', async () => {
    mount();
    await waitFor(() => expect(fetchMyCheckins).toHaveBeenCalledWith('u1'));
  });
});

describe('the launch snapshot', () => {
  it('paints the last session first, then lets the network win', async () => {
    world.session = { user: { id: 'u2' } };
    world.rows = [visit('a'), visit('b')];
    await AsyncStorage.setItem(cacheKey('checkins', 'all', 'u2'), packCache([visit('old')], Date.now()));
    let free!: (rows: Checkin[]) => void;
    fetchMyCheckins.mockImplementationOnce(() => new Promise((res) => { free = res; }));
    mount();
    await waitFor(() => expect(screen.getByTestId('pill-cache').textContent).toBe('true'));
    expect(screen.getByTestId('pill-count').textContent).toBe('1');
    free(world.rows as Checkin[]);
    await waitFor(() => expect(screen.getByTestId('pill-count').textContent).toBe('2'));
    expect(screen.getByTestId('pill-cache').textContent).toBe('false');
  });
});

describe('one copy', () => {
  it('a reload from the pill lands in the count the profile draws', async () => {
    mount();
    await waitFor(() => expect(screen.getByTestId('profile-count').textContent).toBe('1'));
    world.rows = [visit('a'), visit('b'), visit('c')];
    fireEvent.click(screen.getByText('pill-reload'));
    await waitFor(() => expect(screen.getByTestId('pill-count').textContent).toBe('3'));
    expect(screen.getByTestId('profile-count').textContent).toBe('3');
    expect(fetchMyCheckins).toHaveBeenCalledTimes(2);
  });
});
