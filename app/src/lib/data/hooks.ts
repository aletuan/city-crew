// The React surface of the data layer: every query above, wrapped in
// `useFetch` and scoped to the city or the session it belongs to.
//
// Together with `fetch.ts` this is the only part of `lib/data` that needs a
// renderer, which is what lets the other five modules sit inside the
// coverage gate — see `vitest.config.ts`. Nothing here holds logic of its
// own: a wrapper that grew a decision would be a decision no test can
// reach.

import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
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
import {
  fetchCopiesOfList, fetchCuratorAvatars, fetchLikesOnList, fetchListsLikedInCommon, fetchPlacesInCommon,
  fetchRoleOf, type FriendProfile, type PersonRole, type PlaceInCommon, profileByHandle,
} from './people';
import { fetchMyListShares } from './shares';
import { fetchCommentNews, fetchPreviews, fetchTaggable, fetchThread } from './comments';
import type { CommentNews } from '../commentNews';
import { windowStart } from '../activityWindow';
import type { Taggable } from '../commentTags';
import type { CommentRow, Preview, Subject } from '../comments';
import { changes, onChange } from '../commentsChanged';
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

// ── one list's activity: every like and copy on it, all time ──
//
// What a list's activity page draws (`CollectionActivityScreen`), for its
// owner and for any reader of it alike: `likes_on_list` and
// `copies_of_list` answer for the one list. Two shared entries, not one:
// the page shows one half when the other fails, as it always has, and
// each half keeps its own last answer through a failed refresh. One entry
// per list and per reader — the reader is part of the question, since a
// block between them and a liker takes a row out — under `cacheKey`; the
// rows' shape is `Applause` and `Copy`, so a column added to them is a
// `CACHE_VERSION` bump (`lib/data/cache`).
//
// Until 15 Nov 2026 the owner had a question of their own —
// `likes_on_mine` and `copies_of_mine` from the epoch, one answer for
// every list they own, narrowed to one on the page — and the reader's
// came second. The owner's left out the owner's own like, which is right
// for Activity ("somebody liked your list" is not news about yourself)
// and wrong here: the card said ♥ 3 and the page behind it named two
// (owner). One question for everybody now, and the owner's own like is a
// row in it. Rejected: adding the owner's like to `likes_on_mine` and
// taking it out again in Activity and its badge — every phone still on
// the older JavaScript would have told its owner they liked their own
// list until its update landed.
//
// Not `useActivityCount`'s or Activity's question: those ask two weeks of
// what others did, a different answer, and keep their own reads.
const NO_LIKES: Applause[] = [];
const NO_COPIES: Copy[] = [];

export type ListActivityQuery = {
  likes: Fetch<Applause[]>;
  copies: Fetch<Copy[]>;
  /** Both halves again — Try again. */
  reload: () => void;
};

const readerKey = (
  half: 'likesonlist' | 'copiesoflist', readerId: string | null | undefined, collectionId: string | null | undefined,
) => (readerId && collectionId ? cacheKey(half, collectionId, readerId) : null);

/** One list's likes and copies as a reader of it is told them; nobody or
 *  no list asks nothing. */
export const useListActivityOfQuery = (
  readerId: string | null | undefined,
  collectionId: string | null | undefined,
): ListActivityQuery => {
  const askLikes = useCallback(() => fetchLikesOnList(collectionId as string), [collectionId]);
  const askCopies = useCallback(() => fetchCopiesOfList(collectionId as string), [collectionId]);
  const likes = useSharedFetch(readerKey('likesonlist', readerId, collectionId), askLikes, NO_LIKES);
  const copies = useSharedFetch(readerKey('copiesoflist', readerId, collectionId), askCopies, NO_COPIES);
  const { reload: likesAgain } = likes;
  const { reload: copiesAgain } = copies;
  const reload = useCallback(() => { likesAgain(); copiesAgain(); }, [likesAgain, copiesAgain]);
  return { likes, copies, reload };
};

/** The same two asks, from a screen that does not draw them — the
 *  collection page, so "View activity ›" opens on the answer (see
 *  `prefetchShared`). For the list's owner alone, and the rule is here
 *  rather than at the call: the owner's old question was one ask for all
 *  their lists, this is one per list of theirs opened, and for a reader
 *  it would be one per list opened for a page most never open. Nobody,
 *  no list, a list with no id yet, or somebody else's asks nothing. */
export const usePrefetchOwnListActivity = (
  readerId: string | null | undefined,
  list: Pick<Collection, 'id' | 'owner_id'> | null | undefined,
): void => {
  const collectionId = list?.id;
  const mine = !!readerId && list?.owner_id === readerId;
  useEffect(() => {
    const likesKey = readerKey('likesonlist', mine ? readerId : null, collectionId);
    const copiesKey = readerKey('copiesoflist', mine ? readerId : null, collectionId);
    if (!likesKey || !copiesKey) return;
    prefetchShared(likesKey, () => fetchLikesOnList(collectionId as string), NO_LIKES);
    prefetchShared(copiesKey, () => fetchCopiesOfList(collectionId as string), NO_COPIES);
  }, [mine, readerId, collectionId]);
};

// ── what the reader and one other person have in common ──
//
// For a person's page (`InCommon`, 16 Nov 2026): the places both keep in
// public, and the public lists both liked. One plain fetch per page
// opened, not a shared entry — nothing else asks this question, and the
// answer is about a pair, so there is no second reader to share it with.
// Both halves in one promise: the section is drawn when both are in, and
// a failure of either draws no section at all, which is what an answer
// that cannot be trusted to be whole should draw.
//
// Nobody signed in, or no other person, asks nothing — and so does
// yourself: there is nothing in common with yourself to list.
const NOTHING_IN_COMMON: { places: PlaceInCommon[]; lists: string[] } = { places: [], lists: [] };

export const useInCommonQuery = (readerId: string | null | undefined, otherId: string | null | undefined) => {
  const ask = readerId && otherId && readerId !== otherId ? otherId : null;
  const fetcher = useCallback(
    () => (ask
      ? Promise.all([fetchPlacesInCommon(ask), fetchListsLikedInCommon(ask)]).then(([places, lists]) => ({ places, lists }))
      : Promise.resolve(NOTHING_IN_COMMON)),
    [ask],
  );
  return useFetch(fetcher, NOTHING_IN_COMMON);
};

// ── the mark a person wears ──
//
// For a person's page (`PersonRole`, 16 Nov 2026): editor, guide, or
// nothing. A plain fetch per page opened, as what two people have in
// common is: the answer is about one person, asked where it is drawn.
//
// Yourself included — your own page wears your own mark, as other
// people see it. Nobody signed in asks nothing: the database would
// refuse, and a refusal is not worth a round trip to learn.
//
// A failure answers no mark. A disc is a small thing to be told about
// and a wrong one is worse than none; the page says nothing of it.
export const useRoleOfQuery = (readerId: string | null | undefined, personId: string | null | undefined) => {
  const ask = readerId && personId ? personId : null;
  const fetcher = useCallback(
    () => (ask ? fetchRoleOf(ask) : Promise.resolve(null as PersonRole)),
    [ask],
  );
  return useFetch(fetcher, null as PersonRole);
};

// ── a list's statistics, for whoever reads it ──
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

// ── a subject's thread ──
//
// What the Comments screen draws (C3 of `docs/comments-plan.md`). Asked
// by the subject's kind and id, not by the object, so a route handing a
// fresh `{ kind, id }` on every render does not ask again.
//
// Plain `useFetch`, not kept between opens as a list's activity is: a
// thread is the one page where a stale answer is worse than a spinner —
// a comment deleted, or by somebody blocked a minute ago, would be drawn
// again from the cache before the server could take it back. Nobody
// signed in asks too: a public collection's thread is as public as it.
const NO_COMMENTS: CommentRow[] = [];

/** One subject's whole thread, flat; no subject asks nothing. */
export const useThreadQuery = (subject: Subject | null): Fetch<CommentRow[]> => {
  const kind = subject?.kind;
  const id = subject?.id;
  // Asked again whenever a comment is written or taken back anywhere —
  // see `lib/commentsChanged`. Read into the question, so a change is a
  // new question and `useFetch` asks it.
  const stamp = useSyncExternalStore(onChange, changes);
  const fetcher = useCallback(
    () => (kind && id ? fetchThread({ kind, id }) : Promise.resolve(NO_COMMENTS)),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `stamp` is the reason to ask again, not a value read
    [kind, id, stamp],
  );
  return useFetch(fetcher, NO_COMMENTS);
};

// ── what the cards show of their threads ──
//
// A count and the two newest for each collection named, in one ask
// (`comment_previews`), filed by the collection's id. Asked again when
// the set of ids changes — five more cards on a person's page is one
// more ask, for all that are drawn — and by the ids themselves, joined,
// so a new array holding the same ids on the next render asks nothing.
// No ids asks nothing at all: that is the page with the `comments`
// switch off.
//
// Not kept between opens, for the reason a thread is not: the figure on
// a card should not be one the thread behind it has already taken back.
const NO_PREVIEWS: Record<string, Preview> = {};

/** The previews of these collections' threads, by collection id. */
export const usePreviewsQuery = (collectionIds: readonly string[]): Fetch<Record<string, Preview>> => {
  const joined = collectionIds.join(',');
  // And again after a comment is written or taken back, as a thread is.
  const stamp = useSyncExternalStore(onChange, changes);
  const fetcher = useCallback(
    () => fetchPreviews(joined ? joined.split(',').map((id) => ({ kind: 'collection' as const, id })) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- as above
    [joined, stamp],
  );
  return useFetch(fetcher, NO_PREVIEWS);
};

// ── whom the composer may tag ──
//
// Asked once when a field opens on a subject, for somebody signed in:
// the people and the places "@" offers (`comment_taggable`). Not asked
// again when a comment is written — the one thing a new comment changes
// is that its writer becomes taggable, and a field that is open has just
// been used by the only writer it could add, who cannot tag themself. A
// failure is the empty answer: "@" then offers nothing, and a comment
// can still be written.
const NOBODY: Taggable = { people: [], places: [], off: false, mine: false };

/** What may be tagged on a subject; no subject, or nobody reading, asks nothing. */
export const useTaggableQuery = (subject: Subject | null, readerId: string | null | undefined): Fetch<Taggable> => {
  const kind = subject?.kind;
  const id = subject?.id;
  const fetcher = useCallback(
    () => (kind && id && readerId ? fetchTaggable({ kind, id }) : Promise.resolve(NOBODY)),
    [kind, id, readerId],
  );
  return useFetch(fetcher, NOBODY);
};

// ── what happened to the reader in comments ──
//
// Activity's fourth source, beside its likes, copies and the reader's
// own acts — and asked apart from them, by its own hook, because
// Activity's page function is at its ceiling (`app/oversize.js`) and
// its three halves are a state machine a fourth would have had to be
// threaded through. What that costs is written where it is used
// (`screens/activity/useActivityNews`).
//
// The window opens at the moment of each ask, as Activity's does. Asked
// again after a comment is written or taken back anywhere in the app
// (`commentsChanged`) and on `reload`. Nobody reading, or `on` false —
// the `comments` switch — asks nothing.
const NO_NEWS: CommentNews[] = [];

/** The reader's comment news over Activity's window. */
export const useCommentNewsQuery = (readerId: string | null | undefined, on: boolean): Fetch<CommentNews[]> => {
  const stamp = useSyncExternalStore(onChange, changes);
  const fetcher = useCallback(
    () => (readerId && on ? fetchCommentNews(windowStart(new Date())) : Promise.resolve(NO_NEWS)),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `stamp` is the reason to ask again, not a value read
    [readerId, on, stamp],
  );
  return useFetch(fetcher, NO_NEWS);
};
