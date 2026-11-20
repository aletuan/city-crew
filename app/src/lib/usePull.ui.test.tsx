// @vitest-environment jsdom
//
// Reloading on focus and on a pull — see `usePull.ts` for why the trip
// screens have both. The harness's `useFocusEffect` runs its callback at
// mount, the one focus a tree that is never blurred can have.

import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '../uitest/render';
import { useFocusReload, useKeepCurrent, usePull } from './usePull';

const fetchOf = (loading = false) => ({ loading, reload: vi.fn() });

// A focus the test can fire when it likes: the harness's own `useFocusEffect`
// runs at mount and never again, which cannot say what a second focus reads.
const focus = vi.hoisted(() => ({ cb: null as null | (() => void) }));
vi.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb: () => void) => { focus.cb = cb; },
}));

describe('useFocusReload', () => {
  it('reloads every fetch on focus, even one already out', () => {
    const a = fetchOf();
    const b = fetchOf(true);
    renderHook(() => useFocusReload([a, b]));
    act(() => focus.cb!());
    expect(a.reload).toHaveBeenCalledTimes(1);
    expect(b.reload).toHaveBeenCalledTimes(1);
  });

  // A tab stays mounted across many focuses, and what it holds is a new
  // object on every load: a second focus must ask the ones it has now.
  it('asks the fetches it was last given, not the first', () => {
    const a = fetchOf();
    const b = fetchOf();
    const { rerender } = renderHook(({ f }) => useFocusReload(f), { initialProps: { f: [a] } });
    rerender({ f: [b] });
    act(() => focus.cb!());
    expect(a.reload).not.toHaveBeenCalled();
    expect(b.reload).toHaveBeenCalledTimes(1);
  });
});

describe('usePull', () => {
  it('is not spinning until pulled, and pulling reloads everything idle', () => {
    const a = fetchOf();
    const b = fetchOf();
    const { result } = renderHook(() => usePull([a, b]));
    expect(result.current.pulling).toBe(false);
    act(() => result.current.pull());
    expect(a.reload).toHaveBeenCalledTimes(1);
    expect(b.reload).toHaveBeenCalledTimes(1);
  });

  it('leaves a fetch already out alone, and waits for it', () => {
    const idle = fetchOf();
    const out = fetchOf(true);
    const { result } = renderHook(() => usePull([idle, out]));
    act(() => result.current.pull());
    expect(idle.reload).toHaveBeenCalledTimes(1);
    expect(out.reload).not.toHaveBeenCalled();
    expect(result.current.pulling).toBe(true);
  });

  // As a real fetch does: asking flips `loading` in the same batch as the
  // pull, and answering flips it back.
  it('spins while any fetch is out and stops when all have settled', () => {
    const { result } = renderHook(() => {
      const [loading, setLoading] = useState(false);
      return { ...usePull([{ loading, reload: () => setLoading(true) }]), settle: () => setLoading(false) };
    });
    act(() => result.current.pull());
    expect(result.current.pulling).toBe(true);
    act(() => result.current.settle());
    expect(result.current.pulling).toBe(false);
  });

  // A focus reload or the provider's return-to-app refresh is not the
  // reader's gesture, so it never lights the spinner.
  it('does not spin for a fetch that was out before anybody pulled', () => {
    const a = fetchOf(true);
    const { result } = renderHook(() => usePull([a]));
    expect(result.current.pulling).toBe(false);
  });
});

describe('useKeepCurrent', () => {
  it('is the control for a ScrollView: focus reads one list, a pull reads another', () => {
    const onFocus = fetchOf();
    const onPull = fetchOf();
    const { result } = renderHook(() => useKeepCurrent([onFocus], [onPull]));
    act(() => focus.cb!());
    expect(onFocus.reload).toHaveBeenCalledTimes(1);
    expect(onPull.reload).not.toHaveBeenCalled();
    act(() => result.current.props.onRefresh());
    expect(onPull.reload).toHaveBeenCalledTimes(1);
    expect(onFocus.reload).toHaveBeenCalledTimes(1);
  });
});
