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

import React, {
  useCallback, createContext, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import { AppState } from 'react-native';
import {
  Collection, Fetch, Place, likeCollection, unlikeCollection, useCategoryTermsQuery,
  useCollectionsQuery, useCuratorAvatarsQuery, useLikeCountsQuery, useMyLikesQuery,
  usePlacesQuery,
} from './data';
import { countsNow, likedNow, NO_PENDING, settled, type Pending } from './likes';
import { CATEGORIES } from './categories';
import { normalizeHandle } from './handle';
import { mergeTerms, type TermMap } from './search';
import { useAuth } from './auth';
import { shouldRefresh } from './stale';
import { startupTrace } from './trace';

type Catalog = {
  places: Fetch<Place[]>;
  collections: Fetch<Collection[]>;
  /** Curator avatars by folded handle, fetched with the shelf so a
   *  byline never has to fill itself in a round trip after it drew. */
  curatorAvatars: Record<string, string>;
  /** Search synonyms: the app's shipped defaults, plus whatever the desk
   *  has added. Already merged and folded — see `mergeTerms`. */
  terms: TermMap;
  /**
   * How many people liked each public collection, by slug — and which of
   * them you liked, by id.
   *
   * Two shapes because they answer two questions with different
   * audiences: the count is public and orders a shelf everybody sees, the
   * set is yours and only fills a heart. They live here together because
   * both the shelf and a collection's own screen need both, and reading
   * them separately would let one copy go stale while the other wrote.
   *
   * Both already carry whatever the reader has just tapped, whether or
   * not the server has heard about it — see `toggleLike`.
   */
  likes: Record<string, number>;
  myLikes: string[];
  /**
   * Like a list, or take a like back. The only way to do either.
   *
   * It lives on the provider rather than in the screens because a like is
   * not a fact about one screen: tapping the heart on the shelf and then
   * opening the list has to show a filled heart there too, and per-screen
   * state cannot do that. Both screens had their own copy of this and the
   * copies had already drifted.
   *
   * Returns when the write has been sent and the local answer is settled;
   * callers do not need to await it to draw, because the heart has
   * already moved by the time the promise exists.
   */
  toggleLike: (c: { id: string; slug: string }) => Promise<void>;
};

/** The shipped floor, lifted out of the category table once rather than on
 *  every render. */
const BUILT_IN: TermMap = Object.fromEntries(
  Object.entries(CATEGORIES).map(([key, c]) => [key, c.terms ?? []]),
);

const EMPTY: Catalog = {
  places: { loading: true, loaded: false, error: null, data: [], loadedAt: null, fromCache: false, reload: () => {} },
  collections: { loading: true, loaded: false, error: null, data: [], loadedAt: null, fromCache: false, reload: () => {} },
  terms: mergeTerms(BUILT_IN, null),
  curatorAvatars: {},
  likes: {},
  myLikes: [],
  toggleLike: async () => {},
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
  // No city and no reader in the key: what somebody types for "cinema" is
  // the same in every city and for everyone. One fetch, for the app's life.
  // The faces behind the public shelf's bylines, fetched here rather
  // than by whichever screen happens to need one. A collection screen
  // asking for its curator's avatar on open laid out a byline and then
  // shoved it sideways when the answer came back; asked for with the
  // shelf, the face is in memory before any list is opened.
  const curatorAvatars = useCuratorAvatarsQuery(
    useMemo(
      () => collections.data.map((c) => c.curator_handle ?? '').filter(Boolean),
      [collections.data],
    ),
  );
  const deskTerms = useCategoryTermsQuery();
  // Counts are public and need no reader; the set of your own likes is
  // empty until there is one, which is the honest answer signed out.
  const likeCounts = useLikeCountsQuery();
  const myLikes = useMyLikesQuery(meId);

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
  // The launch waterfall's back half: when each catalog query settles.
  // `mark` logs once per name, so the refetches these effects also see —
  // city corrections, sign-in, AppState — mark nothing.
  // A hydrated answer and the fresh one behind it are separate marks, so
  // the trace shows both: when the reader first saw content, and when the
  // network confirmed it.
  useEffect(() => {
    if (places.loaded) startupTrace.mark(places.fromCache ? 'catalog:places(cached)' : 'catalog:places');
  }, [places.loaded, places.fromCache]);
  useEffect(() => {
    if (collections.loaded) {
      startupTrace.mark(collections.fromCache ? 'catalog:collections(cached)' : 'catalog:collections');
    }
  }, [collections.loaded, collections.fromCache]);
  // Gated on collections too: with no handles yet the avatars query
  // "settles" instantly and would stamp a time that measured nothing.
  useEffect(() => {
    if (collections.loaded && curatorAvatars.loaded && !curatorAvatars.loading) {
      startupTrace.mark('catalog:avatars');
    }
  }, [collections.loaded, curatorAvatars.loaded, curatorAvatars.loading]);

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
  const terms = useMemo(() => mergeTerms(BUILT_IN, deskTerms.data), [deskTerms.data]);

  // ── the tap, and the gap before the server answers ──
  //
  // The first version awaited the insert and then refetched, and nothing
  // on screen moved until both had come back — so a like read as a tap
  // that missed. `pending` is what the reader has asked for and the
  // server has not confirmed; `lib/likes` decides what that means for the
  // heart and for the tally, and is self-cancelling, so a stale entry
  // cannot double-count while the refetch is in the air.
  const [pending, setPending] = useState<Pending>(NO_PENDING);
  // Ids with a write in flight. A ref rather than state because nothing
  // draws from it: it exists so a double tap sends one insert and one
  // delete that race each other rather than two writes whose order
  // decides the answer.
  const inFlight = useRef(new Set<string>());

  useEffect(() => {
    // Signed out there is no such thing as your own like, so the layer
    // goes with the session rather than surviving it.
    setPending((p) => (meId ? settled(p, myLikes.data) : NO_PENDING));
  }, [meId, myLikes.data]);

  const liked = useMemo(() => likedNow(myLikes.data, pending), [myLikes.data, pending]);
  const counts = useMemo(
    () => countsNow(likeCounts.data, myLikes.data, pending),
    [likeCounts.data, myLikes.data, pending],
  );

  const toggleLike = useCallback(async (c: { id: string; slug: string }) => {
    if (!meId || inFlight.current.has(c.id)) return;
    const want = !liked.includes(c.id);
    inFlight.current.add(c.id);
    setPending((p) => ({ ...p, [c.id]: { slug: c.slug, liked: want } }));
    try {
      const ok = want
        ? await likeCollection(c.id, meId)
        : await unlikeCollection(c.id, meId);
      // A refused write is not breakage and not a state either: the
      // primary key refuses a second like, and that means the row is
      // already there. Dropping the entry falls back to whatever the
      // server says, which is the one answer that cannot be wrong.
      if (!ok) setPending(({ [c.id]: _dropped, ...rest }) => rest);
      // One call, both queries: a tap changes a public count and your own
      // set at the same moment, and refetching one without the other is
      // how a heart ends up filled beside a number that has not moved.
      likeCounts.reload();
      myLikes.reload();
    } finally {
      inFlight.current.delete(c.id);
    }
  // `.reload` is stable where the Fetch wrapper around it is not; `liked` is the value this reads.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meId, liked, likeCounts.reload, myLikes.reload]);

  const value = useMemo<Catalog>(() => ({
    places, collections, terms, likes: counts, myLikes: liked, toggleLike,
    curatorAvatars: curatorAvatars.data,
  // Each field, not each wrapper: a Fetch object is new every render, so depending on it would
  // rebuild the context value — and re-render every consumer — on renders where nothing loaded.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [
    places.data, places.loading, places.error, places.loadedAt, places.reload,
    collections.data, collections.loading, collections.error, collections.loadedAt, collections.reload,
    terms, counts, liked, toggleLike,
  ]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useCatalog = () => useContext(Ctx);

/**
 * The city's published places. Same shape the screens always used, so a
 * call site does not care that the fetch moved — only the import did.
 */
export const usePlaces = () => useCatalog().places;

/** Search synonyms, merged and ready for `placeHaystack`. */
export const useSearchTerms = () => useCatalog().terms;

/** The desk's public collections for the city. */
export const useCollections = () => useCatalog().collections;

/** One curator's face, if the shelf brought it back. Null covers both
 *  "no such profile" — every editorial handle — and "not fetched yet",
 *  and the screens draw the same placeholder for both, so the answer
 *  arriving late cannot move anything. */
export const useCuratorAvatar = (handle: string | null | undefined) => {
  const map = useCatalog().curatorAvatars;
  return handle ? map[normalizeHandle(handle)] ?? null : null;
};

/** Like counts by slug, your own likes by id, and the one way to change
 *  either. All three already include the tap you just made. */
export const useLikes = () => {
  const { likes, myLikes, toggleLike } = useCatalog();
  return { likes, myLikes, toggleLike };
};
