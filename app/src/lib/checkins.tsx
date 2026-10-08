// Every check-in the reader has made, fetched once for the whole app.
//
// Three screens asked the same question separately — the pill on a
// place's screen, the count on the profile, the list behind it — each
// mounting its own `usePersistedFetch`, each with its own copy. The
// first phone that tried it found the seam in a minute: the pill's
// screen reloaded *its* copy after every visit, the profile's copy had
// loaded at launch and stayed there, and the row said 2 under a list
// that said 29. The same argument the catalog, the crew, the invitations
// and the trips already settled, for the fifth time: one copy above the
// navigators, and the screens read it. One copy is one truth, and the
// reload any screen calls lands in the list every screen draws.
//
// Persisted like the trips: a launch opens on the last session's visits
// and the network only confirms, so the pill is right on its first frame
// for a place visited last week.
//
// No AppState revalidate, unlike the trips. A trip reaches this list by
// somebody else's hand — an invitation accepted elsewhere — and the
// trips re-ask on return for that reason. A check-in is written by the
// reader alone; a second phone is the one way the list changes behind
// this one's back, and a launch is soon enough to hear about that.

import React, { createContext, useCallback, useContext, useMemo } from 'react';
import { useAuth } from './auth';
import type { Checkin } from './checkin';
import { CACHE_CATALOG, cacheKey } from './data/cache';
import { fetchMyCheckins, usePersistedFetch, type Fetch } from './data';

const NO_FETCH: Fetch<Checkin[]> = {
  loading: true, loaded: false, error: null, data: [], loadedAt: null, fromCache: false, reload: () => {},
};

const Ctx = createContext<Fetch<Checkin[]>>(NO_FETCH);

export function CheckinsProvider({ children }: { children: React.ReactNode }) {
  const { ready, session } = useAuth();
  const meId = session?.user?.id ?? null;

  // Held, not answered, until auth has decided who is asking — the trap
  // `crew.tsx` documents: "no session yet" resolving instantly to an
  // empty list would stamp `loadedAt` and lock the snapshot out on the
  // one launch it exists for.
  const fetcher = useCallback(() => {
    if (!ready) return new Promise<Checkin[]>(() => {});
    return meId ? fetchMyCheckins(meId) : Promise.resolve([] as Checkin[]);
  }, [ready, meId]);
  const visits = usePersistedFetch(
    CACHE_CATALOG && ready && meId ? cacheKey('checkins', 'all', meId) : null,
    fetcher,
    [] as Checkin[],
  );

  // Each field rather than the wrapper — see `mytrips.tsx`.
  const value = useMemo(
    () => visits,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visits.data, visits.loading, visits.loaded, visits.error, visits.loadedAt, visits.fromCache, visits.reload],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** The one shared list. Same name the per-screen hook wore, so a screen
 *  changes only its import — and drops the owner id it used to pass. */
export const useMyCheckins = () => useContext(Ctx);
