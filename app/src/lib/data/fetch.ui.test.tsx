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
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, render, screen, waitFor } from '../../uitest/render';
import { CACHE_MAX_CHARS, packCache } from './cache';
import { forgetSharedFetches, prefetchShared, usePersistedFetch, useSharedFetch } from './fetch';
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

// ── one answer for every screen that asks (13 Nov 2026) ──
//
// `useSharedFetch` exists for the collection page to ask so that the
// activity page can open on the answer. What each test pins is one of
// the promises in its comment: the second reader draws the kept answer
// on its very first render, a mount while a request is out joins it, a
// refresh keeps the answer on screen and replaces it in place, a failed
// one keeps it and says why, the launch cache fills an empty entry and
// never overwrites a fresh one, and `null` asks nothing.
describe('useSharedFetch', () => {
  const NONE: string[] = [];
  /** Every render's `data` and `loaded`, so a test can say what the very
   *  first one drew — not only where it settled. */
  function Shared({ k, fetcher, frames }: { k: string | null; fetcher: () => Promise<string[]>; frames?: string[] }) {
    const q = useSharedFetch(k, fetcher, NONE);
    frames?.push(`${q.data.join(',')}|${q.loaded}|${q.loading}`);
    return (
      <div>
        <span data-testid="data">{q.data.join(',')}</span>
        <span data-testid="loaded">{String(q.loaded)}</span>
        <span data-testid="loading">{String(q.loading)}</span>
        <span data-testid="error">{q.error ?? ''}</span>
        <span data-testid="fromCache">{String(q.fromCache)}</span>
        <button onClick={q.reload}>again</button>
      </div>
    );
  }

  beforeEach(() => { forgetSharedFetches(); });

  it('draws the first reader’s answer on the second reader’s first render', async () => {
    const first = render(<Shared k="shared-a" fetcher={async () => ['lan']} />);
    await waitFor(() => expect(read('data')).toBe('lan'));
    first.unmount();

    const frames: string[] = [];
    const again = deferred<string[]>();
    render(<Shared k="shared-a" fetcher={() => again.promise} frames={frames} />);
    // Not a spinner first and the rows a beat later: the rows, at once,
    // settled — with a refresh out behind them.
    expect(frames[0]).toBe('lan|true|false');
    expect(read('loading')).toBe('true');
    await act(async () => { again.resolve(['lan', 'minh']); });
    expect(read('data')).toBe('lan,minh');
    expect(read('loading')).toBe('false');
  });

  it('joins a request already out rather than sending a second', async () => {
    const out = deferred<string[]>();
    const fetcher = vi.fn(() => out.promise);
    render(<><Shared k="shared-b" fetcher={fetcher} /><Shared k="shared-b" fetcher={fetcher} /></>);
    expect(fetcher).toHaveBeenCalledTimes(1);
    await act(async () => { out.resolve(['lan']); });
    expect(screen.getAllByTestId('data').map((d) => d.textContent)).toEqual(['lan', 'lan']);
  });

  it('keeps its answer through a failed refresh, and says why', async () => {
    let call = 0;
    const fetcher = () => (call++ === 0 ? Promise.resolve(['lan']) : Promise.reject(new Error('offline')));
    render(<Shared k="shared-c" fetcher={fetcher} />);
    await waitFor(() => expect(read('data')).toBe('lan'));
    await act(async () => { screen.getByText('again').click(); });
    expect(read('data')).toBe('lan');
    expect(read('error')).toBe('offline');
    // And the next success forgets the failure.
    call = 0;
    await act(async () => { screen.getByText('again').click(); });
    expect(read('error')).toBe('');
  });

  // As `usePersistedFetch` does: asking again is not still failing. The
  // page reads "failed" and "asking" apart (Try again turns, it does not
  // keep saying it failed), so the error goes as the request goes out.
  it('clears the failure the moment it asks again, before the answer', async () => {
    const again = deferred<string[]>();
    let call = 0;
    const fetcher = () => (call++ === 0 ? Promise.reject(new Error('offline')) : again.promise);
    render(<Shared k="shared-c2" fetcher={fetcher} />);
    await waitFor(() => expect(read('error')).toBe('offline'));
    act(() => { screen.getByText('again').click(); });
    expect(read('error')).toBe('');
    expect(read('loading')).toBe('true');
    await act(async () => { again.resolve(['lan']); });
    expect(read('data')).toBe('lan');
  });

  it('settles a first failure as loaded, with nothing and the reason', async () => {
    render(<Shared k="shared-d" fetcher={() => Promise.reject(new Error('offline'))} />);
    await waitFor(() => expect(read('error')).toBe('offline'));
    expect(read('loaded')).toBe('true');
    expect(read('loading')).toBe('false');
    expect(read('data')).toBe('');
  });

  it('writes a fresh answer to the phone under its key', async () => {
    render(<Shared k="shared-e" fetcher={async () => ['lan']} />);
    await waitFor(() => expect(read('data')).toBe('lan'));
    const blob = await AsyncStorage.getItem('shared-e');
    expect(JSON.parse(blob!).data).toEqual(['lan']);
  });

  it('opens a launch on the phone’s answer, then lets the network replace it', async () => {
    await AsyncStorage.setItem('shared-f', packCache(['kept'], Date.now()));
    const fresh = deferred<string[]>();
    render(<Shared k="shared-f" fetcher={() => fresh.promise} />);
    await waitFor(() => expect(read('data')).toBe('kept'));
    expect(read('fromCache')).toBe('true');
    expect(read('loaded')).toBe('true');
    await act(async () => { fresh.resolve(['fresh']); });
    expect(read('data')).toBe('fresh');
    expect(read('fromCache')).toBe('false');
  });

  it('never lets a slow read of the phone overwrite the network', async () => {
    await AsyncStorage.setItem('shared-g', packCache(['kept'], Date.now()));
    const disk = deferred<string | null>();
    const get = vi.spyOn(AsyncStorage, 'getItem').mockImplementationOnce(() => disk.promise);
    try {
      render(<Shared k="shared-g" fetcher={async () => ['fresh']} />);
      await waitFor(() => expect(read('data')).toBe('fresh'));
      await act(async () => { disk.resolve(packCache(['kept'], Date.now())); });
      expect(read('data')).toBe('fresh');
      expect(read('fromCache')).toBe('false');
    } finally {
      get.mockRestore();
    }
  });

  it('does not write an answer too long to read back, and removes the old one', async () => {
    await AsyncStorage.setItem('shared-h', packCache(['old'], Date.now()));
    render(<Shared k="shared-h" fetcher={async () => ['x'.repeat(CACHE_MAX_CHARS)]} />);
    await waitFor(() => expect(read('data').length).toBe(CACHE_MAX_CHARS));
    await waitFor(async () => expect(await AsyncStorage.getItem('shared-h')).toBeNull());
  });

  it('asks nothing for no key, and answers the empty value, settled', async () => {
    const fetcher = vi.fn(async () => ['lan']);
    render(<Shared k={null} fetcher={fetcher} />);
    await act(async () => { screen.getByText('again').click(); });
    expect(fetcher).not.toHaveBeenCalled();
    expect([read('data'), read('loaded'), read('loading')]).toEqual(['', 'true', 'false']);
  });

  it('marks a read of the phone that fails, and goes on to the network', async () => {
    const spy = vi.spyOn(startupTrace, 'mark');
    const get = vi.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('Row too big to fit into CursorWindow'));
    try {
      render(<Shared k="citycrew.cache.sharedprobe.all.u1" fetcher={async () => ['fresh']} />);
      await waitFor(() => expect(read('data')).toBe('fresh'));
      expect(spy).toHaveBeenCalledWith('cache:sharedprobe:unreadable');
    } finally {
      get.mockRestore();
      spy.mockRestore();
    }
  });

  it('keeps two keys apart', async () => {
    render(<><Shared k="shared-i" fetcher={async () => ['one']} /><Shared k="shared-j" fetcher={async () => ['two']} /></>);
    await waitFor(() => expect(screen.getAllByTestId('data').map((d) => d.textContent)).toEqual(['one', 'two']));
  });
});

describe('prefetchShared', () => {
  const NONE: string[] = [];
  beforeEach(() => { forgetSharedFetches(); });

  it('asks without a reader, and the reader that mounts after draws the answer at once', async () => {
    const fetcher = vi.fn(async () => ['lan']);
    await act(async () => { prefetchShared('pre-a', fetcher, NONE); });
    expect(fetcher).toHaveBeenCalledTimes(1);
    const frames: string[] = [];
    function Reader() {
      const q = useSharedFetch('pre-a', fetcher, NONE);
      frames.push(q.data.join(','));
      return null;
    }
    render(<Reader />);
    expect(frames[0]).toBe('lan');
  });

  it('is joined by a reader that mounts while it is still out', async () => {
    const out = deferred<string[]>();
    const fetcher = vi.fn(() => out.promise);
    prefetchShared('pre-b', fetcher, NONE);
    function Reader() {
      const q = useSharedFetch('pre-b', fetcher, NONE);
      return <span data-testid="data">{q.data.join(',')}</span>;
    }
    render(<Reader />);
    expect(fetcher).toHaveBeenCalledTimes(1);
    await act(async () => { out.resolve(['lan']); });
    expect(read('data')).toBe('lan');
  });

  it('does not ask again within two minutes of an answer, and does after', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      const fetcher = vi.fn(async () => ['lan']);
      await act(async () => { prefetchShared('pre-c', fetcher, NONE); });
      vi.setSystemTime(Date.now() + 2 * 60 * 1000 - 1);
      prefetchShared('pre-c', fetcher, NONE);
      expect(fetcher).toHaveBeenCalledTimes(1);
      vi.setSystemTime(Date.now() + 1);
      prefetchShared('pre-c', fetcher, NONE);
      expect(fetcher).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('asks again after a failure, which is no answer to be fresh about', async () => {
    const fetcher = vi.fn(() => Promise.reject(new Error('offline')));
    await act(async () => { prefetchShared('pre-d', fetcher, NONE); });
    await act(async () => { prefetchShared('pre-d', fetcher, NONE); });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
