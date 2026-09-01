// The one React shape the data layer exposes: a request's state, and the
// hook that drives it.
//
// Split from the queries so that everything else in this directory is a
// plain async function a Node process can call. `hooks.ts` is the other
// half — see `index.ts` for the whole arrangement.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import { packCache, unpackCache } from './cache';

export type Fetch<T> = {
  loading: boolean;
  /**
   * True once this has settled at least once, and never false again.
   *
   * `loading` answers "is a request in flight", which flips back on for
   * every refresh. A screen that hides a section while `loading` therefore
   * tears it down on every refresh — and inferring "we have been here
   * before" from a non-empty `data` fails for anyone whose answer is
   * legitimately empty. This is the flag that actually means it.
   */
  loaded: boolean;
  error: string | null;
  data: T;
  /**
   * When the last *successful* load landed, or null if none has.
   *
   * Not `loaded`, which stays true after a failure: this is the one that
   * can say how old what we are showing actually is, which is what
   * deciding whether to ask again needs. See `lib/stale`.
   */
  loadedAt: number | null;
  /**
   * True while what `data` holds came from the launch cache rather than
   * the network — see `usePersistedFetch`. Flips false the moment a fresh
   * answer lands and never comes back. Plain `useFetch` is never true.
   */
  fromCache: boolean;
  reload: () => void;
};

export function useFetch<T>(fetcher: () => Promise<T>, empty: T): Fetch<T> {
  return usePersistedFetch(null, fetcher, empty);
}

/**
 * `useFetch`, with a memory: show what the last launch fetched while this
 * launch's fetch is in flight — stale-while-revalidate, the launch-speed
 * half of `lib/data/cache` (the envelope, the version stamp, and the
 * switch live there).
 *
 * `key` is the storage key, or null for no persistence at all — which is
 * exactly `useFetch`, and is how the switch turns this off. Four rules
 * keep the cache honest:
 *
 *   - A key is a question, and a new key never keeps showing the old
 *     question's answer. It resets to skeletons in the same render, and
 *     whatever the old question still had in flight is dropped whole
 *     when it lands — neither shown nor written. Before this, switching
 *     city left the previous city's catalog on screen until the new
 *     fetch arrived; the hero, picking its photo from that mixed state,
 *     visibly loaded one cover and then another.
 *   - A fresh answer beats hydration. The storage read applies only
 *     while nothing has landed for *this* key (`loadedAt === null`), so
 *     however slow it is, it can never overwrite the network. The reset
 *     re-arms it, which is the bonus: a city switch now hydrates from
 *     that city's last visit exactly the way a launch does.
 *   - The cache is written only from a *successful* fetch, under the key
 *     the request was asked under.
 *   - Reading it back goes through `unpackCache`, and a blob that fails
 *     any of its checks means skeletons and a plain wait — the launch the
 *     app always had.
 *
 * Hydrated data carries its original `loadedAt`, so the two-minute
 * staleness rule (`lib/stale`) sees a week-old cache for what it is.
 */
export function usePersistedFetch<T>(
  key: string | null,
  fetcher: () => Promise<T>,
  empty: T,
): Fetch<T> {
  const [state, setState] = useState<{
    loading: boolean; loaded: boolean; error: string | null; data: T;
    loadedAt: number | null; fromCache: boolean;
  }>({
    loading: true, loaded: false, error: null, data: empty, loadedAt: null, fromCache: false,
  });
  // Which question is on screen. Bumped by every load and by every key
  // change, and every answer checks it before touching anything — a late
  // answer to a question no longer being asked is dropped whole.
  const gen = useRef(0);
  // The key at request start, read by `load` when it fires.
  const keyRef = useRef(key);
  keyRef.current = key;

  // The first rule in the docstring, mechanically: reset during render —
  // React's own pattern for state derived from props — so not one frame
  // of the old key's answer is ever painted under the new one, and bump
  // the generation so the old key's in-flight fetch dies unheard.
  // `reload` goes nowhere near this: refreshing the *same* question
  // keeps showing its old answer, as every pull-to-refresh should.
  const [lastKey, setLastKey] = useState(key);
  if (key !== lastKey) {
    setLastKey(key);
    setState({ loading: true, loaded: false, error: null, data: empty, loadedAt: null, fromCache: false });
    gen.current += 1;
  }

  const load = useCallback(() => {
    gen.current += 1;
    const mine = gen.current;
    const asked = keyRef.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    fetcher()
      .then((data) => {
        if (gen.current !== mine) return;
        setState({ loading: false, loaded: true, error: null, data, loadedAt: Date.now(), fromCache: false });
        if (asked) {
          AsyncStorage.setItem(asked, packCache(data, Date.now())).catch(() => {});
        }
      })
      // `loadedAt` is deliberately left where it was: a refresh that failed
      // has not made what we are showing any newer, and pretending
      // otherwise would push the next attempt out by another interval.
      .catch((err: Error) => {
        if (gen.current !== mine) return;
        setState((s) => ({ ...s, loading: false, loaded: true, error: err.message }));
      });
  }, [fetcher]);
  useEffect(load, [load]);

  useEffect(() => {
    if (!key) return;
    let live = true;
    AsyncStorage.getItem(key)
      .then((raw) => {
        if (!live) return;
        const hit = unpackCache<T>(raw, Date.now());
        if (!hit) return;
        setState((s) => (s.loadedAt !== null ? s
          : { ...s, loaded: true, data: hit.data, loadedAt: hit.at, fromCache: true }));
      })
      .catch(() => { /* an unreadable cache is no cache */ });
    return () => { live = false; };
  }, [key]);

  return { ...state, reload: load };
}
