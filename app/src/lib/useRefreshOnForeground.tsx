// A list the app is holding, asked for again when the phone comes back.
//
// Written twice before this file — in the invitations and the trips
// providers — word for word, comments included. The decision of *when* is
// `shouldRefresh` (two minutes, a failed load always retried); this is only
// the subscription that asks it, so a third list that wants the same rule
// does not write a third copy.
//
// ── the fetch is read through a ref ──
//
// The effect subscribes once. A `Fetch` object is new every render, so a
// listener that closed over it would hold the first render's `loadedAt`
// for the life of the app and decide every return on a number that was
// never updated. The ref is assigned during render, not in an effect, so
// it is already current when an `active` event lands between the two.

import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { shouldRefresh } from './stale';

/** What the rule needs of a fetch: whether one is out, when the last good
 *  one landed, and a way to ask again. */
export type Refreshable = { loading: boolean; loadedAt: number | null; reload: () => void };

export function useRefreshOnForeground(f: Refreshable): void {
  const latest = useRef(f);
  latest.current = f;
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active') return;
      const cur = latest.current;
      if (!cur.loading && shouldRefresh(cur.loadedAt, Date.now())) cur.reload();
    });
    return () => sub.remove();
  }, []);
}
