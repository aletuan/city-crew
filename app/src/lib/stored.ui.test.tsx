// @vitest-environment jsdom
//
// The device's memory, as a hook — see the header of `stored.tsx`.

import React, { useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, waitFor } from '../uitest/render';
import { NO_RECENTS, oneOf, RECENTS, useStored, type Codec, type Origin } from './stored';

const KEY = 'test.stored';
const VIEW = oneOf('tile', 'row');

/** The hook's latest answer, written after render. */
const seen = {} as { value: unknown; remember: (v: never) => void; origin: Origin };
function Probe<T>({ fallback, codec, storeKey = KEY }: { fallback: T; codec: Codec<T>; storeKey?: string }) {
  const [value, remember, origin] = useStored(storeKey, fallback, codec);
  useEffect(() => { seen.value = value; seen.remember = remember as (v: never) => void; seen.origin = origin; });
  return null;
}

afterEach(async () => {
  vi.restoreAllMocks();
  await AsyncStorage.removeItem(KEY);
});

describe('reading', () => {
  it('shows the default until the stored value lands, then the stored value', async () => {
    await AsyncStorage.setItem(KEY, 'row');
    render(<Probe<"tile" | "row"> fallback="tile" codec={VIEW} />);
    expect(seen.value).toBe('tile');
    await waitFor(() => expect(seen.value).toBe('row'));
  });

  it('keeps the default when nothing is stored, or what is stored is not accepted', async () => {
    const view = render(<Probe<"tile" | "row"> fallback="tile" codec={VIEW} />);
    await act(async () => {});
    expect(seen.value).toBe('tile');
    view.unmount();
    await AsyncStorage.setItem(KEY, 'grid');
    render(<Probe<"tile" | "row"> fallback="tile" codec={VIEW} />);
    await act(async () => {});
    expect(seen.value).toBe('tile');
  });

  it('keeps the default when the read fails', async () => {
    vi.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('disk'));
    render(<Probe<"tile" | "row"> fallback="tile" codec={VIEW} />);
    await act(async () => {});
    expect(seen.value).toBe('tile');
  });
});

describe('remembering', () => {
  it('shows the new value at once and writes it as text', async () => {
    render(<Probe fallback={NO_RECENTS} codec={RECENTS} />);
    await act(async () => {});
    act(() => { seen.remember(['pho', 'banh mi'] as never); });
    expect(seen.value).toEqual(['pho', 'banh mi']);
    await waitFor(async () => expect(await AsyncStorage.getItem(KEY)).toBe('["pho","banh mi"]'));
  });

  // The rule this module exists to keep once: a read still out when the
  // reader taps must not land afterwards and undo the tap — whether it
  // carries nothing or an older value.
  it('drops a read that lands after a write, whatever it carries', async () => {
    let land: (raw: string | null) => void = () => {};
    vi.spyOn(AsyncStorage, 'getItem').mockImplementationOnce(() => new Promise((r) => { land = r; }));
    render(<Probe<"tile" | "row"> fallback="tile" codec={VIEW} />);
    act(() => { seen.remember('row' as never); });
    await act(async () => { land('tile'); });
    expect(seen.value).toBe('row');
  });

  // A read for the key this caller asked about before is not an answer
  // for the key it asks about now.
  it('drops a read for a key the caller has moved off', async () => {
    let land: (raw: string | null) => void = () => {};
    vi.spyOn(AsyncStorage, 'getItem')
      .mockImplementationOnce(() => new Promise((r) => { land = r; }))
      .mockResolvedValueOnce(null);
    const view = render(<Probe<"tile" | "row"> fallback="tile" codec={VIEW} storeKey="a" />);
    view.rerender(<Probe<"tile" | "row"> fallback="tile" codec={VIEW} storeKey="b" />);
    await act(async () => { land('row'); });
    expect(seen.value).toBe('tile');
  });

  it('keeps the value shown when the write fails', async () => {
    vi.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('full'));
    render(<Probe<"tile" | "row"> fallback="tile" codec={VIEW} />);
    await act(async () => {});
    await act(async () => { seen.remember('row' as never); });
    expect(seen.value).toBe('row');
  });
});

describe('the codecs', () => {
  it('RECENTS reads a list of searches and writes it as JSON', () => {
    expect(RECENTS.parse('["pho"," ", 3]')).toEqual(['pho']);
    expect(RECENTS.format(['pho'])).toBe('["pho"]');
  });

  it('oneOf accepts only its words', () => {
    expect(VIEW.parse('row')).toBe('row');
    expect(VIEW.parse('grid')).toBeUndefined();
    expect(VIEW.format('tile')).toBe('tile');
  });
});

// Whether the value in hand is a choice or the default standing in for
// one — what the collection's grid notice turns on (owner, 22 Oct 2026).
describe('where the value came from', () => {
  it('is reading until the read lands, then stored when something usable was', async () => {
    await AsyncStorage.setItem(KEY, 'row');
    render(<Probe<"tile" | "row"> fallback="tile" codec={VIEW} />);
    expect(seen.origin).toBe('reading');
    await waitFor(() => expect(seen.origin).toBe('stored'));
  });

  it('is the fallback when nothing is stored, nothing usable is, or the read fails', async () => {
    const one = render(<Probe<"tile" | "row"> fallback="tile" codec={VIEW} />);
    await waitFor(() => expect(seen.origin).toBe('fallback'));
    one.unmount();
    await AsyncStorage.setItem(KEY, 'grid');
    const two = render(<Probe<"tile" | "row"> fallback="tile" codec={VIEW} />);
    await waitFor(() => expect(seen.origin).toBe('fallback'));
    two.unmount();
    vi.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('disk'));
    render(<Probe<"tile" | "row"> fallback="tile" codec={VIEW} />);
    await waitFor(() => expect(seen.origin).toBe('fallback'));
  });

  it('is stored the moment the reader sets it, and a read landing late does not undo that', async () => {
    let land!: (raw: string | null) => void;
    vi.spyOn(AsyncStorage, 'getItem').mockImplementationOnce(() => new Promise((r) => { land = r; }));
    render(<Probe<"tile" | "row"> fallback="tile" codec={VIEW} />);
    act(() => { seen.remember('row' as never); });
    expect(seen.origin).toBe('stored');
    await act(async () => { land(null); });
    expect(seen.origin).toBe('stored');
  });

  it('says nothing after the screen has gone', async () => {
    let fail!: (e: Error) => void;
    vi.spyOn(AsyncStorage, 'getItem').mockImplementationOnce(() => new Promise((_r, j) => { fail = j; }));
    const view = render(<Probe<"tile" | "row"> fallback="tile" codec={VIEW} />);
    view.unmount();
    const error = vi.spyOn(console, 'error');
    await act(async () => { fail(new Error('disk')); });
    expect(seen.origin).toBe('reading');
    expect(error).not.toHaveBeenCalled();
  });
});
