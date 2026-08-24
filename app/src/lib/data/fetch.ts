// The one React shape the data layer exposes: a request's state, and the
// hook that drives it.
//
// Split from the queries so that everything else in this directory is a
// plain async function a Node process can call. `hooks.ts` is the other
// half — see `index.ts` for the whole arrangement.

import { useCallback, useEffect, useState } from 'react';

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
  reload: () => void;
};

export function useFetch<T>(fetcher: () => Promise<T>, empty: T): Fetch<T> {
  const [state, setState] = useState<{
    loading: boolean; loaded: boolean; error: string | null; data: T; loadedAt: number | null;
  }>({
    loading: true, loaded: false, error: null, data: empty, loadedAt: null,
  });
  const load = useCallback(() => {
    setState((s) => ({ ...s, loading: true, error: null }));
    fetcher()
      .then((data) => setState({ loading: false, loaded: true, error: null, data, loadedAt: Date.now() }))
      // `loadedAt` is deliberately left where it was: a refresh that failed
      // has not made what we are showing any newer, and pretending
      // otherwise would push the next attempt out by another interval.
      .catch((err: Error) => setState((s) => ({ ...s, loading: false, loaded: true, error: err.message })));
  }, [fetcher]);
  useEffect(load, [load]);
  return { ...state, reload: load };
}
