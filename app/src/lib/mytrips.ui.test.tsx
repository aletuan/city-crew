// @vitest-environment jsdom
//
// The trips provider's promises, rendered.
//
// The point of the provider is in its first line — every trip, fetched
// once for the whole app — and the promises are the ones every provider
// in lib makes: held until auth decides who is asking, the last session's
// list painted before the network answers, a fresh answer always winning,
// and one reload landing in the list every screen draws. A delete that
// reloads one screen's copy and leaves the list behind it stale is the
// bug this file exists to keep dead.

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, screen, waitFor } from '../uitest/render';
import { cacheKey, packCache } from './data/cache';
import type { Trip } from './data';

const world = vi.hoisted(() => ({
  ready: true,
  session: { user: { id: 'u1' } } as { user: { id: string } } | null,
  trips: [] as unknown[],
}));
// A copy per call, the way a network answer is a fresh array every time.
const fetchMyTrips = vi.hoisted(() => vi.fn(async () => [...world.trips]));

vi.mock('./auth', () => ({ useAuth: () => ({ ready: world.ready, session: world.session }) }));
vi.mock('./data', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  fetchMyTrips,
}));

import { MyTripsProvider, useMyTrips } from './mytrips';

const trip = (id: string) => ({ id, title: id } as unknown as Trip);

/** Two consumers, because "one copy" is the claim under test: what one
 *  screen reloads, the other must already be drawing. */
function Probe({ name }: { name: string }) {
  const trips = useMyTrips();
  return (
    <>
      <span data-testid={`${name}-count`}>{String(trips.data.length)}</span>
      <span data-testid={`${name}-cache`}>{String(trips.fromCache)}</span>
      <button type="button" onClick={() => trips.reload()}>{`${name}-reload`}</button>
    </>
  );
}

const mount = () => render(
  <MyTripsProvider>
    <Probe name="tab" />
    <Probe name="detail" />
  </MyTripsProvider>,
);

beforeEach(() => {
  world.ready = true;
  world.session = { user: { id: 'u1' } };
  world.trips = [trip('t1')];
  fetchMyTrips.mockClear();
});

describe('who is asking', () => {
  it('holds the question until auth has decided', async () => {
    world.ready = false;
    mount();
    await waitFor(() => expect(screen.getByTestId('tab-count').textContent).toBe('0'));
    expect(fetchMyTrips).not.toHaveBeenCalled();
  });

  // Signed out is an answer, not a held question — but it is answered
  // here, without a round trip a guest has no business paying for.
  it('answers a guest with an empty list, off the network', async () => {
    world.session = null;
    mount();
    await waitFor(() => expect(screen.getByTestId('tab-count').textContent).toBe('0'));
    expect(fetchMyTrips).not.toHaveBeenCalled();
  });
});

describe('the launch snapshot', () => {
  it('paints the last session first, then lets the network win', async () => {
    world.session = { user: { id: 'u2' } };
    world.trips = [trip('t1'), trip('t2')];
    await AsyncStorage.setItem(
      cacheKey('mytrips', 'all', 'u2'),
      packCache([trip('old')], Date.now()),
    );
    let free!: (rows: Trip[]) => void;
    fetchMyTrips.mockImplementationOnce(() => new Promise((res) => { free = res; }));

    mount();
    await waitFor(() => expect(screen.getByTestId('tab-cache').textContent).toBe('true'));
    expect(screen.getByTestId('tab-count').textContent).toBe('1');

    free(world.trips as Trip[]);
    await waitFor(() => expect(screen.getByTestId('tab-count').textContent).toBe('2'));
    expect(screen.getByTestId('tab-cache').textContent).toBe('false');
  });
});

describe('one copy', () => {
  it('a reload on one screen lands in the list every screen draws', async () => {
    mount();
    await waitFor(() => expect(screen.getByTestId('detail-count').textContent).toBe('1'));

    world.trips = [trip('t1'), trip('t2')];
    fireEvent.click(screen.getByText('detail-reload'));
    await waitFor(() => expect(screen.getByTestId('detail-count').textContent).toBe('2'));
    expect(screen.getByTestId('tab-count').textContent).toBe('2');
  });
});
