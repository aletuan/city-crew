// @vitest-environment jsdom
//
// The rule `shouldRefresh` decides is tested in stale.test.ts; this is the
// subscription around it — see `useRefreshOnForeground.tsx`.

import { AppState } from 'react-native';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '../uitest/render';
import { STALE_MS } from './stale';
import { useRefreshOnForeground } from './useRefreshOnForeground';

// The listener the hook registered, and the one `remove` it was handed.
function spyAppState() {
  const remove = vi.fn();
  const box = { fire: (_s: string) => {} };
  const spy = vi.spyOn(AppState, 'addEventListener').mockImplementation((_t, fn) => {
    box.fire = fn as (s: string) => void;
    return { remove } as unknown as ReturnType<typeof AppState.addEventListener>;
  });
  return { box, remove, spy };
}

const NOW = 1_800_000_000_000;
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

describe('useRefreshOnForeground', () => {
  it('reloads a list that has gone stale when the app becomes active', () => {
    vi.useFakeTimers().setSystemTime(NOW);
    const { box } = spyAppState();
    const reload = vi.fn();
    renderHook(() => useRefreshOnForeground({ loading: false, loadedAt: NOW - STALE_MS - 1, reload }));
    box.fire('active');
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('leaves a fresh list alone, and a list already loading', () => {
    vi.useFakeTimers().setSystemTime(NOW);
    const { box } = spyAppState();
    const fresh = vi.fn();
    renderHook(() => useRefreshOnForeground({ loading: false, loadedAt: NOW - 1000, reload: fresh }));
    box.fire('active');
    expect(fresh).not.toHaveBeenCalled();

    const busy = vi.fn();
    renderHook(() => useRefreshOnForeground({ loading: true, loadedAt: null, reload: busy }));
    box.fire('active');
    expect(busy).not.toHaveBeenCalled();
  });

  it('ignores every state but active', () => {
    const { box } = spyAppState();
    const reload = vi.fn();
    renderHook(() => useRefreshOnForeground({ loading: false, loadedAt: null, reload }));
    box.fire('background');
    box.fire('inactive');
    expect(reload).not.toHaveBeenCalled();
  });

  // A `Fetch` is a new object every render. A listener that kept the first
  // one would decide every return on a `loadedAt` that never moved.
  it('decides on the fetch it was last given, subscribing once', () => {
    vi.useFakeTimers().setSystemTime(NOW);
    const { box, spy } = spyAppState();
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderHook(({ f }) => useRefreshOnForeground(f), {
      initialProps: { f: { loading: false, loadedAt: NOW - STALE_MS - 1, reload: first } },
    });
    rerender({ f: { loading: false, loadedAt: NOW - STALE_MS - 1, reload: second } });
    box.fire('active');
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('stops listening on unmount', () => {
    const { remove } = spyAppState();
    const { unmount } = renderHook(() => useRefreshOnForeground({ loading: false, loadedAt: null, reload: vi.fn() }));
    unmount();
    expect(remove).toHaveBeenCalledTimes(1);
  });
});
