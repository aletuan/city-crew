// The public catalog — the city's places and the desk's collections —
// fetched once for the whole app.
//
// Five screens read these two lists, and until now each one fetched its
// own: six copies of the places query, four of the collections query, for
// two datasets. That cost a spinner on every screen that already had the
// answer in memory, and it is the same shape as two bugs already fixed —
// the save sheet disagreeing with the Collections tab, and the tab that
// looked like it loaded twice. Both were copies of one thing that could
// not see each other.
//
// Private lists live in SaveProvider for the same reason; this is the
// public half.

import React, { createContext, useContext, useEffect, useMemo, useRef } from 'react';
import { AppState } from 'react-native';
import {
  Collection, Fetch, Place, useCollectionsQuery, usePlacesQuery,
} from './data';
import { useAuth } from './auth';
import { shouldRefresh } from './stale';

type Catalog = {
  places: Fetch<Place[]>;
  collections: Fetch<Collection[]>;
};

const EMPTY: Catalog = {
  places: { loading: true, loaded: false, error: null, data: [], loadedAt: null, reload: () => {} },
  collections: { loading: true, loaded: false, error: null, data: [], loadedAt: null, reload: () => {} },
};

const Ctx = createContext<Catalog>(EMPTY);

export function CatalogProvider({ children }: { children: React.ReactNode }) {
  // Both queries need to know who is reading: one to include the reader's
  // own suggestions, the other to leave out their own published lists.
  const meId = useAuth().session?.user?.id;
  const places = usePlacesQuery(meId);
  // Who is looking, so the public query can leave out their own published
  // lists — those arrive through `useSave().mine` and would otherwise show
  // up twice on the Collections tab. Signing in or out changes the id and
  // reloads the query, which is what makes a list you just published leave
  // the public section on this device and stay in it on every other.
  const collections = useCollectionsQuery(meId);

  // ── coming back to the app ──
  //
  // Until this existed the catalog was fetched at launch and then only on
  // a city change, a sign-in, or a pull-to-refresh. A place the desk
  // deleted while the phone was in a pocket stayed on screen until the
  // reader thought to pull down — which is a thing no reader thinks to do.
  //
  // Through a ref rather than the effect's dependencies, because `useFetch`
  // returns a fresh object every render: listing them as deps would tear
  // down and re-add the AppState listener on every render of the whole app.
  // One subscription, for the app's life.
  //
  // The threshold lives in `lib/stale` and is why this is not a request
  // every time a notification shade closes — iOS reports `active` on the
  // way out of every interruption, not only out of a real absence.
  const latest = useRef({ places, collections });
  latest.current = { places, collections };
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active') return;
      const now = Date.now();
      for (const f of [latest.current.places, latest.current.collections]) {
        // Never on top of a request already in flight: the one that is
        // running is newer than anything this could start.
        if (!f.loading && shouldRefresh(f.loadedAt, now)) f.reload();
      }
    });
    return () => sub.remove();
  }, []);

  // Depend on the fields rather than on the objects: `useFetch` returns a
  // fresh object every render, so memoising on it would memoise nothing.
  const value = useMemo<Catalog>(() => ({ places, collections }), [
    places.data, places.loading, places.error, places.loadedAt, places.reload,
    collections.data, collections.loading, collections.error, collections.loadedAt, collections.reload,
  ]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useCatalog = () => useContext(Ctx);

/**
 * The city's published places. Same shape the screens always used, so a
 * call site does not care that the fetch moved — only the import did.
 */
export const usePlaces = () => useCatalog().places;

/** The desk's public collections for the city. */
export const useCollections = () => useCatalog().collections;
