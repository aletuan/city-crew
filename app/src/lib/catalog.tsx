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

import React, { createContext, useContext, useMemo } from 'react';
import {
  Collection, Fetch, Place, useCollectionsQuery, usePlacesQuery,
} from './data';
import { useAuth } from './auth';

type Catalog = {
  places: Fetch<Place[]>;
  collections: Fetch<Collection[]>;
};

const EMPTY: Catalog = {
  places: { loading: true, loaded: false, error: null, data: [], reload: () => {} },
  collections: { loading: true, loaded: false, error: null, data: [], reload: () => {} },
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

  // Depend on the fields rather than on the objects: `useFetch` returns a
  // fresh object every render, so memoising on it would memoise nothing.
  const value = useMemo<Catalog>(() => ({ places, collections }), [
    places.data, places.loading, places.error, places.reload,
    collections.data, collections.loading, collections.error, collections.reload,
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
