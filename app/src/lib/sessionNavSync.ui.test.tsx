// @vitest-environment jsdom
//
// The one mount that resets the tabs when an account ends: that it fires
// on a sign-out and on a switch, with the pruned tree, and stays its hand
// for a guest signing in, for a tree with nothing to cut, and for a
// container that is not ready.

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '../uitest/render';

const world = vi.hoisted(() => ({ userId: 'a' as string | null | undefined }));
const nav = vi.hoisted(() => ({
  ready: true,
  root: null as unknown,
  isReady: vi.fn(() => nav.ready),
  getRootState: vi.fn(() => nav.root),
  resetRoot: vi.fn(),
}));

vi.mock('./auth', () => ({ useAuth: () => ({ userId: world.userId }) }));
vi.mock('../nav', () => ({ navRef: nav }));

import { SessionNavSync } from './sessionNavSync';

const deep = () => ({
  stale: false, type: 'tab', key: 'tab-1', index: 1, routeNames: ['Explore', 'Collections'], history: [],
  routes: [
    { key: 'Explore-1', name: 'Explore' },
    {
      key: 'Collections-1', name: 'Collections',
      state: {
        stale: false, type: 'stack', key: 's-cols', index: 1, routeNames: ['CollectionsHome', 'CollectionDetail'],
        routes: [{ key: 'home-0', name: 'CollectionsHome' }, { key: 'detail-1', name: 'CollectionDetail' }],
      },
    },
  ],
});

beforeEach(() => {
  vi.clearAllMocks();
  world.userId = 'a';
  nav.ready = true;
  nav.root = deep();
});

const mountThen = (next: string | null | undefined) => {
  const r = render(<SessionNavSync />);
  world.userId = next;
  r.rerender(<SessionNavSync />);
};

describe('SessionNavSync', () => {
  it('cuts the stacks back when the account signs out', () => {
    mountThen(null);
    expect(nav.resetRoot).toHaveBeenCalledTimes(1);
    const sent = nav.resetRoot.mock.calls[0][0] as ReturnType<typeof deep>;
    expect(sent.index).toBe(1);
    expect(sent.routes[1].state!.routes).toEqual([{ key: 'home-0', name: 'CollectionsHome' }]);
  });

  it('cuts them when another account takes over', () => {
    mountThen('b');
    expect(nav.resetRoot).toHaveBeenCalledTimes(1);
  });

  it('remembers who was last signed in, so a switch back resets again', () => {
    // a → b → a: two accounts ended, two resets. Comparing against the
    // first account for ever would have called the return of `a` no
    // change at all.
    const r = render(<SessionNavSync />);
    world.userId = 'b';
    r.rerender(<SessionNavSync />);
    nav.root = deep();
    world.userId = 'a';
    r.rerender(<SessionNavSync />);
    expect(nav.resetRoot).toHaveBeenCalledTimes(2);
  });

  it('leaves a guest who signs in exactly where they were', () => {
    world.userId = null;
    const r = render(<SessionNavSync />);
    world.userId = 'b';
    r.rerender(<SessionNavSync />);
    expect(nav.resetRoot).not.toHaveBeenCalled();
  });

  it('does nothing on mount, or on a render that changed nothing', () => {
    const r = render(<SessionNavSync />);
    r.rerender(<SessionNavSync />);
    expect(nav.getRootState).not.toHaveBeenCalled();
    expect(nav.resetRoot).not.toHaveBeenCalled();
  });

  it('sends nothing when every stack is already at its root', () => {
    nav.root = { ...deep(), routes: [{ key: 'Explore-1', name: 'Explore' }] };
    mountThen(null);
    expect(nav.resetRoot).not.toHaveBeenCalled();
  });

  it('waits for nobody: a container that is not ready is left alone', () => {
    nav.ready = false;
    mountThen(null);
    expect(nav.getRootState).not.toHaveBeenCalled();
    expect(nav.resetRoot).not.toHaveBeenCalled();
  });
});
