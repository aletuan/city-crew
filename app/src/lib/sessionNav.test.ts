// When a signed-in account ends, every tab's stack goes back to its first
// screen — and nothing else about the navigation tree moves.

import type { NavigationState } from '@react-navigation/native';
import { describe, expect, it } from 'vitest';
import { accountEnded, stacksToRoot } from './sessionNav';

const stack = (key: string, ...names: string[]): NavigationState => ({
  stale: false,
  type: 'stack',
  key,
  index: names.length - 1,
  routeNames: names,
  routes: names.map((name, i) => ({ key: `${name}-${i}`, name })),
});

const tabs = (routes: NavigationState['routes'], index = 0): NavigationState => ({
  stale: false, type: 'tab', key: 'tab-1', index, routeNames: routes.map((r) => r.name), history: [], routes,
});

describe('accountEnded', () => {
  it('is true when an account signs out, or another takes its place', () => {
    expect(accountEnded('a', null)).toBe(true);
    expect(accountEnded('a', 'b')).toBe(true);
  });
  it('is false for a guest signing in — they keep their place', () => {
    expect(accountEnded(null, 'a')).toBe(false);
    expect(accountEnded(undefined, 'a')).toBe(false);
  });
  it('is false while nothing changed, including before the session is known', () => {
    expect(accountEnded('a', 'a')).toBe(false);
    expect(accountEnded(null, null)).toBe(false);
    expect(accountEnded(undefined, null)).toBe(false);
    expect(accountEnded(undefined, undefined)).toBe(false);
  });
  it('is false when the restored session confirms the remembered reader', () => {
    // `Auth.userId` is last launch's reader until the session lands;
    // the same id landing is not an ending.
    expect(accountEnded('a', undefined)).toBe(false);
  });
});

describe('stacksToRoot', () => {
  it('cuts every stack with history back to its first screen, keeping the tab and the keys', () => {
    const root = tabs([
      { key: 'Ideas-1', name: 'Ideas' }, // never opened: no state yet
      { key: 'Explore-1', name: 'Explore', state: stack('s-explore', 'ExploreHome') },
      { key: 'Trips-1', name: 'Trips', state: stack('s-trips', 'TripsHome', 'TripDetail') },
      { key: 'Collections-1', name: 'Collections', state: stack('s-cols', 'CollectionsHome', 'CollectionDetail', 'PlaceDetail') },
      { key: 'Profile-1', name: 'Profile', state: stack('s-profile', 'ProfileHome') },
    ], 4);
    const next = stacksToRoot(root);
    expect(next).not.toBeNull();
    expect(next!.index).toBe(4);
    expect(next!.key).toBe('tab-1');
    expect(next!.routes.map((r) => r.key)).toEqual(root.routes.map((r) => r.key));
    expect(next!.routes[0].state).toBeUndefined();
    expect(next!.routes[1].state).toBe(root.routes[1].state); // untouched, same object
    expect(next!.routes[2].state).toEqual({
      ...stack('s-trips', 'TripsHome', 'TripDetail'), index: 0, routes: [{ key: 'TripsHome-0', name: 'TripsHome' }],
    });
    expect(next!.routes[3].state!.routes).toEqual([{ key: 'CollectionsHome-0', name: 'CollectionsHome' }]);
    expect(next!.routes[3].state!.index).toBe(0);
    expect(next!.routes[3].state!.routeNames).toEqual(['CollectionsHome', 'CollectionDetail', 'PlaceDetail']);
  });

  it('is null when no stack has anywhere to go back to', () => {
    expect(stacksToRoot(tabs([
      { key: 'Ideas-1', name: 'Ideas' },
      { key: 'Explore-1', name: 'Explore', state: stack('s-explore', 'ExploreHome') },
    ]))).toBeNull();
  });

  it('does not mutate what it was given', () => {
    const root = tabs([{ key: 'Trips-1', name: 'Trips', state: stack('s-trips', 'TripsHome', 'TripDetail') }]);
    const before = JSON.stringify(root);
    stacksToRoot(root);
    expect(JSON.stringify(root)).toBe(before);
  });
});
