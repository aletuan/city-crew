// @vitest-environment jsdom
//
// `usePersistedFetch`'s key rules, rendered.
//
// The rule this file exists for is the first one: a key is a question,
// and a new key must not keep showing the old question's answer. It did
// — switching city left the previous city's catalog on screen until the
// new fetch landed, and the Explore hero, picking its photo from that
// mixed state, visibly loaded one cover and then another. The other
// tests pin what the fix must not break (a late answer dropped whole,
// never cached under the wrong key) and what it quietly bought (a
// switch hydrates from that key's own cache, exactly like a launch).

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, render, screen, waitFor } from '../../uitest/render';
import { CACHE_MAX_CHARS, packCache } from './cache';
import { usePersistedFetch } from './fetch';
import { startupTrace } from '../trace';

function Probe({ k, fetcher }: { k: string | null; fetcher: () => Promise<string[]> }) {
  const q = usePersistedFetch(k, fetcher, [] as string[]);
  return (
    <div>
      <span data-testid="data">{q.data.join(',')}</span>
      <span data-testid="loaded">{String(q.loaded)}</span>
      <span data-testid="fromCache">{String(q.fromCache)}</span>
    </div>
  );
}

const read = (id: string) => screen.getByTestId(id).textContent;

/** A promise held open until the test decides when — and whether — the
 *  network answers. */
function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}

describe('usePersistedFetch across a key change', () => {
  it('stops showing the old answer the moment the question changes', async () => {
    const first = async () => ['hanoi-cafe'];
    const { rerender } = render(<Probe k="switch-a" fetcher={first} />);
    await waitFor(() => expect(read('data')).toBe('hanoi-cafe'));

    // The new question's answer is nowhere yet — and neither, from this
    // exact render on, is the old one. No frame in between.
    const never = () => new Promise<string[]>(() => {});
    rerender(<Probe k="switch-b" fetcher={never} />);
    expect(read('data')).toBe('');
    expect(read('loaded')).toBe('false');
  });

  it('drops a late answer to the old question — not shown, not cached', async () => {
    const slow = deferred<string[]>();
    const { rerender } = render(<Probe k="late-a" fetcher={() => slow.promise} />);

    rerender(<Probe k="late-b" fetcher={async () => ['saigon-bar']} />);
    await waitFor(() => expect(read('data')).toBe('saigon-bar'));

    // The old city answers at last, into a screen that moved on.
    await act(async () => { slow.resolve(['hanoi-cafe']); });
    expect(read('data')).toBe('saigon-bar');

    // And the poisoning this guards against: the dropped answer wrote
    // nothing under its own key, and nothing of it leaked under the new
    // one. (The mock's call log spans the whole file, so both checks are
    // scoped to this test's keys.)
    const written = vi.mocked(AsyncStorage.setItem).mock.calls;
    expect(written.some(([k]) => k === 'late-a')).toBe(false);
    expect(written.some(([k, blob]) => k === 'late-b' && String(blob).includes('hanoi-cafe'))).toBe(false);
    expect(written.some(([k, blob]) => k === 'late-b' && String(blob).includes('saigon-bar'))).toBe(true);
  });

  it('hydrates the new key from its own cache, then lets the network win', async () => {
    await AsyncStorage.setItem('hydrate-b', packCache(['hue-market'], Date.now()));

    const fresh = deferred<string[]>();
    const { rerender } = render(<Probe k="hydrate-a" fetcher={async () => ['hanoi-cafe']} />);
    await waitFor(() => expect(read('data')).toBe('hanoi-cafe'));

    // The switch: last visit's answer for THIS key appears while the
    // network is still out — the launch behavior, now on every switch.
    rerender(<Probe k="hydrate-b" fetcher={() => fresh.promise} />);
    await waitFor(() => expect(read('data')).toBe('hue-market'));
    expect(read('fromCache')).toBe('true');

    await act(async () => { fresh.resolve(['hue-market-fresh']); });
    expect(read('data')).toBe('hue-market-fresh');
    expect(read('fromCache')).toBe('false');
  });

  it('keeps showing the old answer through a reload of the same question', async () => {
    // The counterpart rule: `reload` refreshes the question, it does not
    // change it — pull-to-refresh must not blank the screen.
    const second = deferred<string[]>();
    let call = 0;
    const fetcher = () => (call++ === 0 ? Promise.resolve(['hanoi-cafe']) : second.promise);
    function Reloader() {
      const q = usePersistedFetch('reload-a', fetcher, [] as string[]);
      return (
        <div>
          <span data-testid="data">{q.data.join(',')}</span>
          <button onClick={q.reload}>again</button>
        </div>
      );
    }
    render(<Reloader />);
    await waitFor(() => expect(read('data')).toBe('hanoi-cafe'));

    act(() => { screen.getByText('again').click(); });
    expect(read('data')).toBe('hanoi-cafe');

    await act(async () => { second.resolve(['hanoi-cafe', 'hanoi-bar']); });
    expect(read('data')).toBe('hanoi-cafe,hanoi-bar');
  });
});

// What a cache read costs, on the launch that pays it (owner, 29 Oct
// 2026): the blob's length and the parse, and a mark of its own when the
// read fails, which is what a blob past Android's 2 MB window looks like.
describe('usePersistedFetch measures its cache read', () => {
  it('marks the length read and the parse it cost, under the key\'s kind', async () => {
    const spy = vi.spyOn(startupTrace, 'mark');
    try {
      const blob = packCache(['hue-market'], Date.now());
      await AsyncStorage.setItem('citycrew.cache.probe.hue.anon', blob);
      render(<Probe k="citycrew.cache.probe.hue.anon" fetcher={() => new Promise<string[]>(() => {})} />);
      await waitFor(() => expect(read('data')).toBe('hue-market'));
      expect(spy).toHaveBeenCalledWith('cache:probe:chars', blob.length);
      const parse = spy.mock.calls.find(([name]) => name === 'cache:probe:parse-ms');
      expect(parse?.[1]).toBeGreaterThanOrEqual(0);
    } finally {
      spy.mockRestore();
    }
  });

  it('marks nothing when there is nothing stored', async () => {
    const spy = vi.spyOn(startupTrace, 'mark');
    try {
      render(<Probe k="citycrew.cache.empty.hue.anon" fetcher={async () => ['fresh']} />);
      await waitFor(() => expect(read('data')).toBe('fresh'));
      expect(spy.mock.calls.filter(([name]) => String(name).startsWith('cache:empty'))).toEqual([]);
    } finally {
      spy.mockRestore();
    }
  });

  it('marks a read that failed, which is how a blob too large to read back shows', async () => {
    const spy = vi.spyOn(startupTrace, 'mark');
    const get = vi.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('Row too big to fit into CursorWindow'));
    try {
      render(<Probe k="citycrew.cache.huge.hcmc.anon" fetcher={() => new Promise<string[]>(() => {})} />);
      await waitFor(() => expect(spy).toHaveBeenCalledWith('cache:huge:unreadable'));
      expect(read('data')).toBe('');
    } finally {
      get.mockRestore();
      spy.mockRestore();
    }
  });
});

// A blob too long for Android to read back (owner, 30 Oct 2026): not
// written, the last one removed, and a mark to say so. Kept, the old blob
// would go on opening the app with an answer every later fetch replaced.
describe('usePersistedFetch keeps an oversize answer off the phone', () => {
  it('writes nothing, removes the last blob, and marks the length', async () => {
    const key = 'citycrew.cache.giant.hcmc.anon';
    await AsyncStorage.setItem(key, packCache(['yesterday'], Date.now()));
    const spy = vi.spyOn(startupTrace, 'mark');
    const huge = 'x'.repeat(CACHE_MAX_CHARS);
    try {
      render(<Probe k={key} fetcher={async () => [huge]} />);
      await waitFor(() => expect(read('fromCache')).toBe('false'));
      // Still on screen: only the copy on the phone is refused.
      expect(read('data')).toBe(huge);
      await waitFor(async () => expect(await AsyncStorage.getItem(key)).toBeNull());
      const mark = spy.mock.calls.find(([name]) => name === 'cache:giant:too-big');
      // The packed blob's length: the answer plus its envelope, stamp included.
      expect(mark?.[1]).toBe(packCache([huge], Date.now()).length);
    } finally {
      spy.mockRestore();
    }
  });

  it('writes an answer inside the bound as it always did', async () => {
    const key = 'citycrew.cache.small.hcmc.anon';
    const spy = vi.spyOn(startupTrace, 'mark');
    try {
      render(<Probe k={key} fetcher={async () => ['fresh']} />);
      await waitFor(async () => expect(await AsyncStorage.getItem(key)).toContain('fresh'));
      expect(spy.mock.calls.filter(([name]) => String(name).endsWith(':too-big'))).toEqual([]);
    } finally {
      spy.mockRestore();
    }
  });
});
