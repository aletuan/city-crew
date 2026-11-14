// The React surface of the data layer: every query above, wrapped in
// `useFetch` and scoped to the city or the session it belongs to.
//
// Together with `fetch.ts` this is the only part of `lib/data` that needs a
// renderer, which is what lets the other five modules sit inside the
// coverage gate — see `vitest.config.ts`. Nothing here holds logic of its
// own: a wrapper that grew a decision would be a decision no test can
// reach.

import { useCallback, useEffect, useRef } from 'react';
import { useCurrentCity } from '../city';
import type { Applause, Copy } from '../friends';
import { normalizeHandle } from '../handle';
import type { Collection, Place, PlacePhoto } from '../types';
import { CACHE_CATALOG, cacheKey } from './cache';
import { type Fetch, prefetchShared, useFetch, usePersistedFetch, useSharedFetch } from './fetch';
import { fetchCategoryTerms, fetchPlaceBySlug, fetchPlacePhotos, fetchPlaces } from './places';
import {
  fetchCollections, fetchLikeCounts, fetchMyCollections, fetchMyLikes, fetchSharedWithMe, type LikeTally,
} from './collections';
import { fetchPreferences, NO_PREFERENCES, type Preferences } from './preferences';
import { fetchApplause, fetchCopies, fetchCuratorAvatars, type FriendProfile, profileByHandle } from './people';
import { fetchMyListShares } from './shares';
import { fetchCollectionStats, fetchListUse, type ListUseRow, recordCollectionView } from './stats';
import type { StatsRow } from '../listStats';
import type { ShareRow } from '../shares';

// Both catalogs scope to the selected city TOGETHER: membersOf() resolves
// collection members against the in-memory places list, so a mismatched
// scope would silently render empty collections. A city switch changes the
// fetcher identity, which makes useFetch reload everywhere automatically.
//
// The two query hooks below are for CatalogProvider and nothing else —
// screens read the catalog from `lib/catalog`, which holds one copy. Call
// them directly and you get a private copy that no one will keep in step.
const pending = new Promise<never>(() => {}); // keeps skeletons up during city bootstrap

//
// `meId` is `Auth.userId`: `undefined` is "not known yet", not "nobody",
// and it holds the query back exactly as an unresolved city does. The
// reader is part of the question — see `cacheKey` — so asking before
// knowing who asks is asking a question that is about to be replaced.
//
// `cityId` asks for a city other than the one chosen — `useCatalogIn`'s,
// for Search adding to a list from another city. `null` asks for nothing,
// and the query waits as it does for an unresolved city.
export const usePlacesQuery = (meId: string | null | undefined, cityId?: string | null) => {
  const { city } = useCurrentCity();
  const id = cityId === undefined ? city?.id : cityId;
  const known = meId !== undefined;
  const fetcher = useCallback(
    () => (id && known ? fetchPlaces(id, meId) : (pending as Promise<Place[]>)),
    // The id is the stable key. Depending on `city` changes the fetcher identity on renders
    // where the city did not change, and useFetch reloads the whole catalog off that.
    [id, known, meId],
  );
  // The two heavy catalog queries — this and collections below — remember
  // their last answer between launches; see `lib/data/cache` for what that
  // buys and costs. No key while the city is unresolved, because a cached
  // answer is an answer to a question, and there is no question yet.
  return usePersistedFetch(
    CACHE_CATALOG && id && known ? cacheKey('places', id, meId) : null,
    fetcher,
    [] as Place[],
  );
};

// The desk's terms, the like tallies and the curators' faces are
// decoration: the screen is whole without them. Their reads throw like
// every read in this directory, and the fallback is the `empty` each
// hook passes — what a failed first load shows, while a failed refresh
// keeps the last answer (`usePersistedFetch`). No wrapper here catches,
// so `error` still says what happened to anybody who asks.
export const useCategoryTermsQuery = () => {
  const fetcher = useCallback(() => fetchCategoryTerms(), []);
  return useFetch(fetcher, {} as Record<string, string[]>);
};

// One empty tally for every reader, so a render with nothing loaded hands
// the shelf the same object twice rather than a new one each time.
const NO_TALLY: LikeTally = { shown: {}, ranked: {} };

// Asked again when the reader changes (13 Nov 2026). The counts were the
// same for everybody until then and fetched once for the app's life; now
// your own lists and the ones shared with you are counted for you alone
// (`fetchLikeCounts`), so a launch that fetched them signed out, before
// the session landed, would keep a private list's heart blank until a
// tap refetched. `meId` is the fetcher's identity, not its argument: the
// function reads the caller from the session.
export const useLikeCountsQuery = (meId?: string | null) => {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fetcher = useCallback(() => fetchLikeCounts(), [meId]);
  return useFetch(fetcher, NO_TALLY);
};

// The reader's own answers — this, their lists and their preferences —
// remember themselves between launches the way the catalog does, one key
// per account, so a signed-out reader or the next account is a miss and
// never somebody else's hit. Without it the catalog opened from its cache
// and these three arrived a round trip later: the Explore list re-sorted
// itself under the reader's thumb as their taste landed, and bookmarks
// and hearts filled in one by one. A like or a list changed since is
// the cost, shown for that same round trip.
//
// The caches outlive a sign-out, as the profile stash does. Nothing reads
// them without that account's id, and a device shared between accounts
// holds them under keys only their owner's session opens.
const mineKey = (kind: string, ownerId: string | null | undefined) =>
  (CACHE_CATALOG && ownerId ? cacheKey(kind, 'all', ownerId) : null);

export const useMyLikesQuery = (meId?: string | null) => {
  const fetcher = useCallback(
    () => (meId ? fetchMyLikes(meId) : Promise.resolve([] as string[])),
    [meId],
  );
  return usePersistedFetch(mineKey('likes', meId), fetcher, [] as string[]);
};

// No reader, in the query or in the key. The public shelf is the same
// shelf for everyone now — see `fetchCollections`, which used to leave
// the reader's own published lists out of it — so one cached copy per
// city serves the whole device, signed in or out, and signing in no
// longer has to re-fetch a list that has not changed.
//
// `cityId` as for `usePlacesQuery` above.
export const useCollectionsQuery = (cityId?: string | null) => {
  const { city } = useCurrentCity();
  const id = cityId === undefined ? city?.id : cityId;
  const fetcher = useCallback(
    () => (id ? fetchCollections(id) : (pending as Promise<Collection[]>)),
    [id],
  );
  // Cached between launches like places above; like counts and avatars
  // are deliberately not — one is a social number that must be fresh,
  // the other arrives late harmlessly.
  return usePersistedFetch(
    CACHE_CATALOG && id ? cacheKey('collections', id) : null,
    fetcher,
    [] as Collection[],
  );
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
 * Every photograph of the places named — the rest of what the catalog's
 * one-a-place leaves out (`fetchPlacePhotos`). Null asks for nothing.
 *
 * `stamp` asks again whenever it changes, and the place page passes the
 * catalog's own row for it: the catalog reloads after the gallery changes
 * a photograph, and a new row is the sign the set may be out of date.
 * Not cached between launches — it is one place's worth, asked for on
 * opening it, and the catalog's cover is on screen while it comes.
 */
const NO_PHOTOS: Record<string, PlacePhoto[]> = {};
export const usePlacePhotos = (slugs: string[] | null, stamp?: unknown) => {
  // Joined, so a caller's fresh array of the same names is the same question.
  const asked = slugs ? slugs.join('\n') : null;
  const fetcher = useCallback(
    () => (asked ? fetchPlacePhotos(asked.split('\n')) : Promise.resolve(NO_PHOTOS)),
    // `stamp` for its identity alone: see above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [asked, stamp],
  );
  return useFetch(fetcher, NO_PHOTOS);
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
  return usePersistedFetch(mineKey('mine', ownerId), fetcher, [] as Collection[]);
};

/**
 * The lists friends have shared with this reader — `fetchSharedWithMe`.
 * Cached under its own key, beside `mine`, for the reason `mine` is: the
 * tab draws them on the same first paint as the reader's own lists.
 *
 * Each screen that draws them holds its own copy (Collections and a
 * list's page), where your own lists have one (`SaveProvider`). That
 * single copy exists because the save sheet writes to your lists and
 * must see every one; nothing writes to a shared list from this side, so
 * a second copy can only be a reload behind, and both screens reload it.
 */
export const useSharedWithMe = (userId: string | null | undefined) => {
  const fetcher = useCallback(
    () => (userId ? fetchSharedWithMe(userId) : Promise.resolve([] as Collection[])),
    [userId],
  );
  return usePersistedFetch(mineKey('shared', userId), fetcher, [] as Collection[]);
};

/**
 * Who each of the owner's lists is shared with — `fetchMyListShares`, as
 * rows; `lib/shares.sharesByList` files them by list.
 *
 * Remembered between launches beside `mine`, for the reason `mine` is:
 * the tab's tiles and a list's page both draw a list's word from it on
 * the first paint, and an answer a round trip late would draw every
 * shared list as Private first and Friends a moment after — a lock that
 * opens under the reader's eye on a list they have shared.
 *
 * One copy a screen, as `useSharedWithMe` has it: a list's page writes
 * the shares and reloads its own copy, and the tab reloads its copy when
 * it is focused again.
 */
export const useMyListShares = (ownerId: string | null | undefined) => {
  const fetcher = useCallback(
    () => (ownerId ? fetchMyListShares(ownerId) : Promise.resolve([] as ShareRow[])),
    [ownerId],
  );
  return usePersistedFetch(mineKey('shares', ownerId), fetcher, [] as ShareRow[]);
};

// Check-ins have no hook here — `lib/checkins` fetches them once for the
// whole app, for the reason trips below are not here either: three
// screens read the one list, and a visit written on one must show on
// the others without a relaunch.

// Trips have no hook here either — `lib/mytrips` fetches them once for
// the whole app and persists them the way the catalog queries persist
// themselves; four screens read that one copy.

// Cached as a list of one, as the profile stash is: `unpackCache` takes
// lists and nothing else, and one row does not earn it a second shape.
const NO_PREFERENCES_ROW = [NO_PREFERENCES];

export const useMyPreferences = (ownerId: string | null | undefined): Fetch<Preferences> => {
  const fetcher = useCallback(
    () => (ownerId ? fetchPreferences(ownerId) : Promise.resolve(NO_PREFERENCES)).then((p) => [p]),
    [ownerId],
  );
  const row = usePersistedFetch(mineKey('prefs', ownerId), fetcher, NO_PREFERENCES_ROW);
  return { ...row, data: row.data[0] ?? NO_PREFERENCES };
};

// The local guide's grant is not a hook here. It is a property of the
// session rather than of a screen, and a fetch cannot answer on a first
// render — so it lives in `lib/guideGrant` as a store the launch fills
// and a component reads synchronously. `fetchGuideCities` is what that
// store calls.

// Friendships and blocks have no hook here: they are fetched once for
// the whole app by `lib/crew`, which persists them the way the catalog
// queries persist themselves.

// ── the owner's activity: every like and copy, all time ──
//
// What a list's activity page draws (`CollectionActivityScreen`), asked
// once for all the owner's lists — the two functions answer for every
// list the caller owns, and `lib/listActivity.actsOn` narrows to one —
// so one answer serves every list's page, and the collection page can
// ask before the reader has said which (`usePrefetchListActivity`).
//
// All time: both functions read `created_at >= since`, so the epoch is
// every row. Two shared entries, not one: the page shows one half when
// the other fails, as it always has, and each half keeps its own last
// answer through a failed refresh. One key per owner — the reader is the
// question — under `cacheKey`, beside `mine`; the rows' shape is
// `Applause` and `Copy`, so a column added to them is a `CACHE_VERSION`
// bump (`lib/data/cache`).
//
// Not `useActivityCount`'s or Activity's question: those ask two weeks,
// a different answer, and keep their own reads.
const EVER = new Date(0).toISOString();
const NO_LIKES: Applause[] = [];
const NO_COPIES: Copy[] = [];
const allLikes = () => fetchApplause(EVER);
const allCopies = () => fetchCopies(EVER);
const activityKey = (half: 'likesonmine' | 'copiesofmine', ownerId: string | null | undefined) =>
  (ownerId ? cacheKey(half, 'all', ownerId) : null);

export type ListActivityQuery = {
  likes: Fetch<Applause[]>;
  copies: Fetch<Copy[]>;
  /** Both halves again — Try again. */
  reload: () => void;
};

/** The owner's likes and copies, shared and stale-while-revalidate (see
 *  `useSharedFetch`); null asks nothing. */
export const useListActivityQuery = (ownerId: string | null | undefined): ListActivityQuery => {
  const likes = useSharedFetch(activityKey('likesonmine', ownerId), allLikes, NO_LIKES);
  const copies = useSharedFetch(activityKey('copiesofmine', ownerId), allCopies, NO_COPIES);
  const { reload: likesAgain } = likes;
  const { reload: copiesAgain } = copies;
  const reload = useCallback(() => { likesAgain(); copiesAgain(); }, [likesAgain, copiesAgain]);
  return { likes, copies, reload };
};

/** The same two asks, from a screen that does not draw them — see
 *  `prefetchShared`. Null asks nothing. */
export const usePrefetchListActivity = (ownerId: string | null | undefined): void => {
  useEffect(() => {
    const likesKey = activityKey('likesonmine', ownerId);
    const copiesKey = activityKey('copiesofmine', ownerId);
    if (!likesKey || !copiesKey) return;
    prefetchShared(likesKey, allLikes, NO_LIKES);
    prefetchShared(copiesKey, allCopies, NO_COPIES);
  }, [ownerId]);
};

// ── a list's statistics, for its owner ──
//
// What the Statistics page draws (`CollectionStatsScreen`), kept and
// shared as the owner's activity is (`useSharedFetch`): the Activity page
// asks ahead (`usePrefetchCollectionStats`), so the tap on "Statistics ›"
// opens on the answer, and every open asks again behind it. One entry
// per list and per owner — the list is the question and the reader is
// part of it — under `cacheKey`, with the list's id where the others put
// a city. The row's shape is `StatsRow`, so a column added to it is a
// `CACHE_VERSION` bump (`lib/data/cache`).
const NO_STATS: StatsRow[] = [];
const statsKey = (ownerId: string | null | undefined, collectionId: string | null | undefined) =>
  (ownerId && collectionId ? cacheKey('liststats', collectionId, ownerId) : null);

/** One list's figures, shared and stale-while-revalidate; nobody or no
 *  list asks nothing. */
export const useCollectionStatsQuery = (
  ownerId: string | null | undefined,
  collectionId: string | null | undefined,
): Fetch<StatsRow[]> => {
  const fetcher = useCallback(
    () => fetchCollectionStats(collectionId as string),
    [collectionId],
  );
  return useSharedFetch(statsKey(ownerId, collectionId), fetcher, NO_STATS);
};

/** The same ask, from the Activity page — see `prefetchShared`. */
export const usePrefetchCollectionStats = (
  ownerId: string | null | undefined,
  collectionId: string | null | undefined,
): void => {
  useEffect(() => {
    const key = statsKey(ownerId, collectionId);
    if (!key) return;
    prefetchShared(key, () => fetchCollectionStats(collectionId as string), NO_STATS);
  }, [ownerId, collectionId]);
};

// ── one open of a list, counted ──
//
// The collection page counts itself opened (`recordCollectionView`), once
// per mount: a pull to refresh is not an open, nor is a render, nor a
// way back to a page that never left the stack — the native stack keeps
// a screen mounted under the one pushed over it, so coming back from a
// place to its list is the same visit. A second tap on the list from the
// shelf mounts it anew and counts again, as the owner asked (13 Nov 2026:
// "every open"). The id rather than the slug, and only once it is known:
// the row can arrive a render after the mount (a list read from the
// catalog as it loads), and the open is counted then, not lost.
//
// The ref holds the id already counted, so a page whose list changes
// under it — a new `slug` param on the same mounted screen — counts the
// new list, and the same list on a re-render does not count twice. React's
// dev-only double effect keeps the ref across its replay, so a
// development build counts one too.
//
// Fire and forget: nothing waits on it and nothing is said if it fails.
// A count the reader never asked for cannot be a reason for an Alert.
export const useCountView = (collectionId: string | null | undefined): void => {
  const counted = useRef<string | null>(null);
  useEffect(() => {
    if (!collectionId || counted.current === collectionId) return;
    counted.current = collectionId;
    recordCollectionView(collectionId).catch(() => {});
  }, [collectionId]);
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


// ── how the public lists were used ──
//
// What `lib/listRank` reads for two of its terms. One entry for the
// device (`useSharedFetch`), under no reader's name: the answer is the
// same for everybody, and the Explore shelf, the Ideas screen and the
// Collections tab all rank by it, so three screens ask once. Kept
// between launches, so a shelf opens in the order it had and not in the
// order of a server that has not answered yet. A failure leaves it empty
// or as it was, and the shelf is ranked without it.
const NO_USE: ListUseRow[] = [];

export const useListUseQuery = (): Fetch<ListUseRow[]> =>
  useSharedFetch(cacheKey('listuse', 'all'), fetchListUse, NO_USE);
