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
 * exactly `useFetch`, and is how the switch turns this off. Three rules
 * keep the cache honest:
 *
 *   - A fresh answer always wins. Hydration applies only while nothing
 *     has ever landed (`loadedAt === null`), so however slow the storage
 *     read is, it can never overwrite the network — and a city switch
 *     mid-session, where old data is already on screen, hydrates nothing.
 *   - The cache is written only from a *successful* fetch, under whatever
 *     key is current at that moment.
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
  // The key the *write* should use: the one current when the answer
  // lands, not the one current when the request started.
  const keyRef = useRef(key);
  keyRef.current = key;

  const load = useCallback(() => {
    setState((s) => ({ ...s, loading: true, error: null }));
    fetcher()
      .then((data) => {
        setState({ loading: false, loaded: true, error: null, data, loadedAt: Date.now(), fromCache: false });
        if (keyRef.current) {
          AsyncStorage.setItem(keyRef.current, packCache(data, Date.now())).catch(() => {});
        }
      })
      // `loadedAt` is deliberately left where it was: a refresh that failed
      // has not made what we are showing any newer, and pretending
      // otherwise would push the next attempt out by another interval.
      .catch((err: Error) => setState((s) => ({ ...s, loading: false, loaded: true, error: err.message })));
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
