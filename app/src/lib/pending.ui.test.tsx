// @vitest-environment jsdom
//
// The guard every crew write runs through: one in flight per person, the
// outcome handed back, and the key free again once it settles either way.

import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '../uitest/render';
import { reasonOf, usePending } from './pending';

const deferred = () => {
  let resolve!: () => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<void>((ok, no) => { resolve = ok; reject = no; });
  return { promise, resolve, reject };
};

describe('usePending', () => {
  it('runs once per key while the first is in flight, and marks the key pending', async () => {
    const { result } = renderHook(() => usePending());
    const d = deferred();
    const work = vi.fn(() => d.promise);
    const onDone = vi.fn();
    act(() => {
      result.current.run('lan', work, onDone, vi.fn());
      result.current.run('lan', work, onDone, vi.fn());
    });
    expect(work).toHaveBeenCalledTimes(1);
    expect(result.current.pending.has('lan')).toBe(true);
    await act(async () => { d.resolve(); await d.promise; });
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(result.current.pending.has('lan')).toBe(false);
  });

  it('lets a different person through at the same time', () => {
    const { result } = renderHook(() => usePending());
    const work = vi.fn(() => new Promise<void>(() => {}));
    act(() => {
      result.current.run('lan', work, vi.fn(), vi.fn());
      result.current.run('minh', work, vi.fn(), vi.fn());
    });
    expect(work).toHaveBeenCalledTimes(2);
  });

  it('hands a failure to the caller, and frees the key for a retry', async () => {
    const { result } = renderHook(() => usePending());
    const d = deferred();
    const onFail = vi.fn();
    act(() => { result.current.run('lan', () => d.promise, vi.fn(), onFail); });
    await act(async () => { d.reject(new Error('offline')); await d.promise.catch(() => {}); });
    expect(onFail).toHaveBeenCalledWith(new Error('offline'));
    expect(result.current.pending.has('lan')).toBe(false);
    const again = vi.fn(async () => {});
    await act(async () => { result.current.run('lan', again, vi.fn(), vi.fn()); });
    expect(again).toHaveBeenCalledTimes(1);
  });
});

describe('reasonOf', () => {
  it('reads an error message, and nothing else', () => {
    expect(reasonOf(new Error('offline'))).toBe('offline');
    expect(reasonOf(new Error(''))).toBeUndefined();
    expect(reasonOf('offline')).toBeUndefined();
    expect(reasonOf(null)).toBeUndefined();
  });
});
