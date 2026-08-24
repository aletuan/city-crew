// The React surface of the data layer: every query above, wrapped in
// `useFetch` and scoped to the city or the session it belongs to.
//
// Together with `fetch.ts` this is the only part of `lib/data` that needs a
// renderer, which is what lets the other five modules sit inside the
// coverage gate — see `vitest.config.ts`. Nothing here holds logic of its
// own: a wrapper that grew a decision would be a decision no test can
// reach.

import { useCallback } from 'react';
import { useCity } from '../city';
import { normalizeHandle } from '../handle';
import type { Collection, Place } from '../types';
import { useFetch } from './fetch';
import { fetchCategoryTerms, fetchPlaceBySlug, fetchPlaces } from './places';
import {
  fetchCollections, fetchLikeCounts, fetchMyCollections, fetchMyLikes,
} from './collections';
import { fetchMyTrips, type Trip } from './trips';
import { fetchPreferences, NO_PREFERENCES } from './preferences';
import {
  fetchCuratorAvatars, fetchFriendships, fetchMyBlocks, type FriendProfile, profileByHandle,
} from './people';

// Both catalogs scope to the selected city TOGETHER: membersOf() resolves
// collection members against the in-memory places list, so a mismatched
// scope would silently render empty collections. A city switch changes the
// fetcher identity, which makes useFetch reload everywhere automatically.
//
// The two query hooks below are for CatalogProvider and nothing else —
// screens read the catalog from `lib/catalog`, which holds one copy. Call
// them directly and you get a private copy that no one will keep in step.
const pending = new Promise<never>(() => {}); // keeps skeletons up during city bootstrap

export const usePlacesQuery = (meId?: string | null) => {
  const { city } = useCity();
  const fetcher = useCallback(
    () => (city ? fetchPlaces(city.id, meId) : (pending as Promise<Place[]>)),
    // `city.id` is the stable key. Depending on `city` changes the fetcher identity on renders
    // where the city did not change, and useFetch reloads the whole catalog off that.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [city?.id, meId],
  );
  return useFetch(fetcher, [] as Place[]);
};

export const useCategoryTermsQuery = () => {
  const fetcher = useCallback(() => fetchCategoryTerms(), []);
  return useFetch(fetcher, {} as Record<string, string[]>);
};

export const useLikeCountsQuery = () => {
  const fetcher = useCallback(() => fetchLikeCounts(), []);
  return useFetch(fetcher, {} as Record<string, number>);
};

export const useMyLikesQuery = (meId?: string | null) => {
  const fetcher = useCallback(
    () => (meId ? fetchMyLikes(meId) : Promise.resolve([] as string[])),
    [meId],
  );
  return useFetch(fetcher, [] as string[]);
};

export const useCollectionsQuery = (meId?: string | null) => {
  const { city } = useCity();
  const fetcher = useCallback(
    () => (city ? fetchCollections(city.id, meId) : (pending as Promise<Collection[]>)),
    // `city.id` is the stable key — see `usePlacesQuery` above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [city?.id, meId],
  );
  return useFetch(fetcher, [] as Collection[]);
};

/**
 * A single place the catalog does not hold. Pass null when it does — the
 * hook then resolves empty without a request, so the caller can ask for
 * the fallback unconditionally the way hooks require.
 */
export const usePlaceBySlug = (slug: string | null) => {
  const fetcher = useCallback(
    () => (slug ? fetchPlaceBySlug(slug) : Promise.resolve(null)),
    [slug],
  );
  return useFetch(fetcher, null as Place | null);
};

/**
 * The signed-in user's own lists, for the city on screen. Signed out this
 * resolves empty rather than not existing, so callers need no branch.
 */
export const useMyCollections = (ownerId: string | null | undefined) => {
  // No city in the dependencies, and none in the query: a person's lists
  // do not belong to a city, so they neither wait for one nor reload when
  // it changes.
  const fetcher = useCallback(
    () => (ownerId ? fetchMyCollections(ownerId) : Promise.resolve([] as Collection[])),
    [ownerId],
  );
  return useFetch(fetcher, [] as Collection[]);
};

export const useMyTrips = (ownerId: string | null | undefined) => {
  const fetcher = useCallback(
    () => (ownerId ? fetchMyTrips(ownerId) : Promise.resolve([] as Trip[])),
    [ownerId],
  );
  return useFetch(fetcher, [] as Trip[]);
};

export const useMyPreferences = (ownerId: string | null | undefined) => {
  const fetcher = useCallback(
    () => (ownerId ? fetchPreferences(ownerId) : Promise.resolve(NO_PREFERENCES)),
    [ownerId],
  );
  return useFetch(fetcher, NO_PREFERENCES);
};

export const useFriendships = (meId: string | null | undefined) => {
  const fetcher = useCallback(
    () => (meId ? fetchFriendships() : Promise.resolve([] as import('../friends').FriendshipRow[])),
    [meId],
  );
  return useFetch(fetcher, [] as import('../friends').FriendshipRow[]);
};

export const useCuratorAvatarsQuery = (handles: string[]) => {
  // Keyed on the handles themselves, not on the array: `useFetch` reruns
  // when the callback changes, and a fresh array every render would mean
  // a fresh request every render.
  const key = [...new Set(handles.map(normalizeHandle).filter(Boolean))].sort().join(',');
  const fetcher = useCallback(
    () => (key ? fetchCuratorAvatars(key.split(',')) : Promise.resolve({} as Record<string, string>)),
    [key],
  );
  return useFetch(fetcher, {} as Record<string, string>);
};

/**
 * The same lookup as a hook, for a screen that has a handle and wants the
 * face behind it — a collection's byline is the one caller today.
 *
 * Keyed on the handle rather than on the owner's id, and the difference
 * shows the day somebody renames themselves. `curator_handle` is a stamp:
 * `stamp_curator` writes it when a list is published and rewrites it only
 * when the row is next touched, so a renamed curator's byline is stale
 * until then. Looking the face up by that same stale handle keeps the two
 * halves agreeing — the face goes when the words go. An id would put the
 * current person's photograph beside their old name, which is the one
 * outcome a reader could call wrong. It also works for the rows that have
 * no owner id at all.
 *
 * Null resolves empty without a request, the way `usePlaceBySlug` does, so
 * a caller with nothing to ask can still call it unconditionally — which
 * hooks require.
 */
export const useProfileByHandle = (handle: string | null) => {
  const fetcher = useCallback(
    () => (handle ? profileByHandle(handle) : Promise.resolve(null)),
    [handle],
  );
  return useFetch(fetcher, null as FriendProfile | null);
};

export const useMyBlocks = (meId: string | null | undefined) => {
  const fetcher = useCallback(
    () => (meId ? fetchMyBlocks() : Promise.resolve([] as string[])),
    [meId],
  );
  return useFetch(fetcher, [] as string[]);
};
