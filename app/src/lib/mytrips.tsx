// Every trip the reader can open, fetched once for the whole app.
//
// Four screens asked the same question separately — the Trips tab, a
// trip's own screen, the invitation answer screen, Activity — each
// mounting its own copy of the same list, each paying its own round trip
// in front of the reader. The fourth appearance of the argument the
// catalog, the crew and the invitations already settled: one copy above
// the navigators, and the screens read it.
//
// One copy also means one truth. Deleting a trip on its own screen used
// to reload that screen's copy and leave the list behind it to catch up
// on focus; now the reload every screen calls lands in the list every
// screen draws.
//
// Persisted like the catalog and the crew: a launch opens on the last
// session's plans immediately and the network only confirms. A trip is
// the reader's own decision, so a stale beat is honest — and the one way
// somebody else changes this list (an invitation accepted or arriving)
// is exactly what the launch refresh and the AppState revalidate below
// go on to correct.

import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef,
} from 'react';
import { AppState } from 'react-native';
import { useAuth } from './auth';
import { CACHE_CATALOG, cacheKey } from './data/cache';
import { fetchMyTrips, usePersistedFetch, type Fetch, type Trip } from './data';
import { shouldRefresh } from './stale';

const NO_FETCH: Fetch<Trip[]> = {
  loading: true, loaded: false, error: null, data: [], loadedAt: null, fromCache: false, reload: () => {},
};

const Ctx = createContext<Fetch<Trip[]>>(NO_FETCH);

export function MyTripsProvider({ children }: { children: React.ReactNode }) {
  const { ready, session } = useAuth();
  const meId = session?.user?.id ?? null;

  // Held, not answered, until auth has decided who is asking — the trap
  // `crew.tsx` documents: "no session yet" resolving instantly to an
  // empty list would stamp `loadedAt` and lock the snapshot out on the
  // one launch it exists for.
  const fetcher = useCallback(() => {
    if (!ready) return new Promise<Trip[]>(() => {});
    return meId ? fetchMyTrips(meId) : Promise.resolve([] as Trip[]);
  }, [ready, meId]);
  const trips = usePersistedFetch(
    CACHE_CATALOG && ready && meId ? cacheKey('mytrips', 'all', meId) : null,
    fetcher,
    [] as Trip[],
  );

  // Coming back to the app. An invitation accepted on another phone puts
  // a trip in this list without this device doing anything — the same
  // reason the invitations refresh on return, and the trips should agree
  // with the rail beside them.
  const latest = useRef(trips);
  latest.current = trips;
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active') return;
      const f = latest.current;
      if (!f.loading && shouldRefresh(f.loadedAt, Date.now())) f.reload();
    });
    return () => sub.remove();
  }, []);

  // Each field rather than the wrapper: a Fetch object is new every
  // render, so depending on it would re-render every consumer on renders
  // where nothing loaded. Same reasoning as `crew.tsx`.
  const value = useMemo(
    () => trips,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [trips.data, trips.loading, trips.loaded, trips.error, trips.loadedAt, trips.fromCache, trips.reload],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** The one shared list. Same name the per-screen hook wore, so a screen
 *  changes only its import — and drops the owner id it used to pass: the
 *  provider already knows who is asking. */
export const useMyTrips = () => useContext(Ctx);
