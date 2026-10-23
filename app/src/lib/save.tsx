// Saving a place into one of your lists.
//
// The bookmark sits on every place card, on three screens, and the tap has
// to branch three ways: signed out, signed in with nowhere to put it, and
// signed in with somewhere. Hosting that in each screen would be the same
// two sheets three times over, so it lives here once and screens ask for
// it with `useSave().save(place)`.
//
// Which means this owns the user's collections too — the sheet needs them
// to draw its ticks, and reading them from two places would let one copy
// go stale the moment the other wrote.
//
// It owns the two sheets' state and not their drawing. Until 20 Oct 2026
// it rendered `AuthSheet` and `SaveSheet` itself, the one place `lib/`
// imported the UI and the one exception lint was told to wave through.
// The drawing is `components/SaveSheets` now, mounted beside the children
// in `App.tsx` where these two used to sit, and it reads what to draw from
// a third context, `useSaveSheets`. The callers of `useSave` and its two
// halves see no difference.

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { useSession } from './auth';
import {
  addPlaceToCollection, Collection, type Fetch, holds, logPlaceEvent, nextSortOrder, Place, removePlaceFromCollection,
  useMyCollections, useMyPreferences,
} from './data';
import { useCurrentCity } from './city';
import { useI18n } from './i18n';
import { pendingKey, type PendingSaves, withPending } from './pendingSaves';
import { DAILY_CAPS, isDailyLimit } from './quota';
import { goTo, navRef } from '../nav';
import { dropResume, focusedTab, holdResume } from './resume';

/**
 * What the reader reached for when they were asked to sign in. The sheet
 * names it in its title and wears its glyph, so the thing that opened it
 * and the thing it shows are one object — a bookmark tapped used to raise
 * a heart, which read as the app answering some other question.
 *
 * - `save`: a place's bookmark.
 * - `like`: a collection's heart.
 * - `copy`: Save a copy, on somebody else's list.
 * - `saved`: the map's saved-only filter, as a disc or in the filter sheet.
 * - `search`: asking Google Maps for places the catalog has not got.
 * - `trip`: Save to Trips, under a drafted plan.
 */
export type SignInWhy = 'save' | 'like' | 'copy' | 'saved' | 'search' | 'trip' | 'start' | 'checkin';

/**
 * What a screen can do about saving — the acts, without the lists.
 *
 * Split from the lists on 19 Oct 2026 (the SOLID review, I): of fifteen
 * callers, five read only the lists and four only the acts, and every one
 * of them took all four members. `useSaveActions` and `useMyLists` give a
 * caller the half it uses; `useSave` stays as both, for the callers not
 * yet moved.
 */
type SaveActions = {
  /** Open whatever this person needs next in order to save this place. */
  save: (place: Place) => void;
  /**
   * The sign-in invitation on its own, for a gesture that is not saving a
   * place.
   *
   * Liking a collection needs the same sheet and none of the rest of
   * `save` — no place to put anywhere, no list to choose. Without this a
   * signed-out reader taps a heart and nothing happens, which is the
   * "control that does nothing" this app keeps deciding against.
   *
   * `why` picks the sheet's title and glyph; see `SignInWhy`.
   *
   * `resume` is the act to finish once the reader has signed in, run on
   * the tab they were on — see `lib/resume`. Leave it out for an act that
   * is not safe to repeat unasked; the reader is still taken back.
   */
  askToSignIn: (why?: SignInWhy, resume?: () => void) => void;
  /** Is the place in any of their lists? Drives the bookmark's fill. */
  isSaved: (placeSlug: string) => boolean;
  /**
   * One place into one of their lists, or out of it, drawn at once and
   * written behind — the same act as a row of the save sheet, which is
   * where it lived alone until Search could be opened from a list to add
   * to it (owner, 23 Oct 2026). `c` is the list as the screen has it from
   * `useMyLists`.
   */
  toggle: (c: Collection, place: Place) => Promise<void>;
};

/**
 * The user's own collections — the single copy in the app.
 *
 * Screens read this rather than calling `useMyCollections` themselves.
 * Two copies is how the save sheet came to show one list while the
 * Collections tab showed two: the sheet's copy was fetched before the
 * second list existed and had no reason to look again.
 *
 * The whole `Fetch`, not a hand-copied part of it. The copy this was
 * until 19 Oct 2026 had left `error` out, and Profile's counts could not
 * tell a list still loading from one that had failed (UX-14).
 */
type MyLists = Fetch<Collection[]>;

const NO_LISTS: MyLists = {
  data: [], loading: false, loaded: false, error: null, loadedAt: null, fromCache: false, reload: () => {},
};
const ActionsCtx = createContext<SaveActions>({
  save: () => {},
  askToSignIn: () => {},
  isSaved: () => false,
  toggle: async () => {},
});
const ListsCtx = createContext<MyLists>(NO_LISTS);

/**
 * What `components/SaveSheets` draws, and what its buttons do. Not for
 * screens: a screen opens a sheet with `save` or `askToSignIn` and never
 * needs to know one is up.
 */
export type SaveSheetsState = {
  /** The place the save sheet is open for; null when it is shut. */
  target: Place | null;
  /** Whether the sign-in invitation is up. */
  authSheet: boolean;
  /** Its title and glyph — kept while it fades out, see `signInWhy` below. */
  signInWhy: SignInWhy;
  /** "Not now". */
  closeAuth: () => void;
  /** "Sign in / Sign up": the sheet goes and the form comes. */
  signIn: () => void;
  closeSave: () => void;
  /** A list's row tapped: in if it was out, out if it was in. */
  toggle: (c: Collection, place: Place) => Promise<void>;
  /** "New collection", carrying the place along. */
  newList: () => void;
};
const SheetsCtx = createContext<SaveSheetsState>({
  target: null, authSheet: false, signInWhy: 'save',
  closeAuth: () => {}, signIn: () => {}, closeSave: () => {}, toggle: async () => {}, newList: () => {},
});

/** The acts: `save`, `askToSignIn`, `isSaved`, `toggle`. */
export const useSaveActions = () => useContext(ActionsCtx);
/** The reader's own collections, as a `Fetch`. */
export const useMyLists = () => useContext(ListsCtx);
/** The sheets' state, for `components/SaveSheets` alone. */
export const useSaveSheets = () => useContext(SheetsCtx);
/** Both halves, as one object — the shape every caller had before the split. */
export function useSave(): SaveActions & { mine: MyLists } {
  return { ...useSaveActions(), mine: useMyLists() };
}

export function SaveProvider({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const { session, userId } = useSession();
  // The early id, so the lists hydrate with the catalog rather than a
  // session read later — see `Auth.userId`. `save` itself still asks the
  // session: opening a sheet is an act, not a read.
  const me = session?.user?.id ?? userId;
  const mine = useMyCollections(me);
  const { city } = useCurrentCity();
  // Only for the opt-in flag. The insert policy checks it too; this saves
  // a round trip to be told no.
  //
  // Gated on `loaded` for the reason `useNoteEvent` is: the empty
  // preferences now read as recording, so the value is only worth
  // believing once the row it describes has arrived.
  const prefs = useMyPreferences(me);
  const historyOn = prefs.loaded && prefs.data.history_on;
  const [target, setTarget] = useState<Place | null>(null);
  const [authSheet, setAuthSheet] = useState(false);
  // Kept apart from `authSheet` so the glyph does not change while the
  // sheet fades out: closing clears the one and leaves the other.
  const [signInWhy, setSignInWhy] = useState<SignInWhy>('save');

  // Ask, and remember what was being done and where — see `lib/resume`.
  // The tab is read now, while the reader is still on it; by the time the
  // sign-in form is done they are on Profile.
  const ask = useCallback((why: SignInWhy, run?: () => void) => {
    holdResume({ tab: navRef.isReady() ? focusedTab(navRef.getRootState()) : null, kind: why === 'save' ? 'save' : undefined, run, at: Date.now() });
    setSignInWhy(why);
    setAuthSheet(true);
  }, []);
  // The save to finish is *this* render's `save`, the one that knows the
  // reader is signed in now — the one the guest tapped would only raise
  // the sheet again.
  const saveRef = useRef<(place: Place) => void>(() => {});

  // ── a tick moves when it is tapped (owner, 23 Oct 2026) ──
  //
  // What the reader asked for, laid over what the database last returned
  // (`lib/pendingSaves` has the measurement that made it necessary). Every
  // reader of the lists gets the overlaid copy, so the tick, the count
  // under it and the bookmark all move together and at once.
  const [pending, setPending] = useState<PendingSaves>({});
  const shown = useMemo(() => withPending(mine.data, pending), [mine.data, pending]);
  // The writes behind the ticks, one chain per place in a list. `at` is
  // what the database holds as far as this session knows, `want` the last
  // thing tapped; the chain writes until the two agree, so a quick
  // in-out-in sends at most what is needed, in the order it was asked.
  // `from` is where the chain started, which is what a failed first write
  // falls back to.
  const chains = useRef(new Map<string, { at: boolean; want: boolean; from: boolean; running: boolean }>());
  const writing = useRef(0);
  // Whether anything was written since the lists were last asked for:
  // a run that only failed changed nothing and asks for nothing.
  const wrote = useRef(false);
  // When the one reload after the last write was asked for. The overlay
  // stays until a load at least that recent lands — a reload already out
  // when the writes began is dropped unheard by `useFetch`'s generation
  // check once this one is asked, so the first answer after it is the one
  // that carries every write.
  const settledAt = useRef<number | null>(null);
  useEffect(() => {
    const at = settledAt.current;
    if (at === null || writing.current > 0 || mine.loadedAt === null || mine.loadedAt < at) return;
    settledAt.current = null;
    chains.current.clear();
    setPending({});
  }, [mine.loadedAt]);

  const savedSlugs = useMemo(() => {
    const set = new Set<string>();
    for (const c of shown) {
      for (const cp of c.collection_places) if (cp.places) set.add(cp.places.slug);
    }
    return set;
  }, [shown]);

  const save = useCallback((place: Place) => {
    if (!session) { ask('save', () => saveRef.current(place)); return; }
    // Nowhere to put it yet — *known*, not merely not-yet-known. Rather
    // than open a sheet with one row in it that says "make a list first",
    // go straight to making the list and carry the place along — the
    // collection arrives with its first member instead of arriving empty.
    //
    // `loaded` is doing real work in that sentence. `data` is just as
    // empty while the first fetch is still out — which is exactly the
    // moment after launch a bookmark is likeliest to be tapped — and
    // branching on that emptiness sent people who *have* collections to
    // "New collection" as though they had none. `initial: false` is the
    // other half of the same report: without it, reaching the form while
    // the Collections tab had never been opened made the form that
    // stack's first screen — nothing beneath it to go back to, and the
    // tab showed "create" forever after, which read as every list being
    // lost.
    if (mine.loaded && !mine.error && mine.data.length === 0) {
      goTo('Collections', { screen: 'CollectionForm', initial: false, params: { addPlaceSlug: place.slug } });
      return;
    }
    // Still loading, or the load failed: the sheet, whose rows follow
    // `mine.data` and fill in as the answer lands. Asked again on the way
    // up, so a failed fetch at launch is not the sheet's final answer.
    if (!mine.loading && (!mine.loaded || mine.error)) mine.reload();
    setTarget(place);
  // The four fields this actually branches on, not the Fetch object that carries them.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, mine.loaded, mine.loading, mine.error, mine.data.length, mine.reload, ask]);
  saveRef.current = save;

  const toggle = useCallback(async (c: Collection, place: Place) => {
    const key = pendingKey(c.slug, place.slug);
    let chain = chains.current.get(key);
    if (!chain) {
      // No chain means no entry for this pair either — the two are made
      // and cleared together — so the row as drawn is the database's word.
      const at = holds(c, place.slug);
      chain = { at, want: at, from: at, running: false };
      chains.current.set(key, chain);
    }
    const link = chain;
    link.want = !link.want;
    setPending((p) => ({ ...p, [key]: { collection: c.slug, place, want: link.want } }));
    if (link.running) return;

    link.running = true;
    writing.current += 1;
    try {
      while (link.at !== link.want) {
        const to = link.want;
        if (to) await addPlaceToCollection(c.slug, place.slug, nextSortOrder(c), c.id);
        else await removePlaceFromCollection(c.slug, place.slug, c.id);
        link.at = to;
        wrote.current = true;
        // Noted here rather than in the sheet because this is the one place
        // both verbs pass through, and only after the write succeeded — an
        // event for a save that did not happen is worse than no event.
        //
        // Not `useNoteEvent`: that hook reads this provider, and a provider
        // that imports the module importing it is a cycle Metro resolves by
        // handing one of them an empty object at start-up.
        void logPlaceEvent(session?.user?.id, place.slug, to ? 'save' : 'unsave', city?.id ?? null, historyOn);
      }
    } catch (e) {
      // The tick goes back to what the database holds. Where nothing was
      // written on this chain that is where it started, and the entry
      // goes; otherwise it says what the last write left.
      link.want = link.at;
      if (link.at === link.from) {
        chains.current.delete(key);
        setPending(({ [key]: _gone, ...rest }) => rest);
      } else {
        setPending((p) => ({ ...p, [key]: { collection: c.slug, place, want: link.at } }));
      }
      // Three hundred saves in a day is the cap the policy holds; the
      // sheet says so rather than showing the policy's own sentence.
      if (isDailyLimit(e)) {
        Alert.alert(
          t('That is enough for today', 'Hôm nay vậy là đủ', '本日はここまで', '今天就到这里吧', '今天就到這裡吧'),
          t(
            `You can save ${DAILY_CAPS.placesIntoLists} places a day. Come back tomorrow.`,
            `Mỗi ngày bạn có thể lưu ${DAILY_CAPS.placesIntoLists} địa điểm. Mai quay lại nhé.`,
            `1日に${DAILY_CAPS.placesIntoLists}件まで保存できます。また明日どうぞ。`,
            `你每天可以保存 ${DAILY_CAPS.placesIntoLists} 个地点。明天再来吧。`, `你每天可以儲存 ${DAILY_CAPS.placesIntoLists} 個地點。明天再來吧。`,
          ),
        );
      } else {
        Alert.alert(
          t('Could not save', 'Không lưu được', '保存できませんでした', '无法保存', '無法儲存'),
          e instanceof Error ? e.message : String(e),
        );
      }
    } finally {
      link.running = false;
      writing.current -= 1;
      // One reload once every chain is quiet, not one per write: three
      // lists ticked in a row used to fetch the whole of your lists three
      // times over.
      if (writing.current === 0 && wrote.current) {
        wrote.current = false;
        settledAt.current = Date.now();
        mine.reload();
      }
    }
  // `mine.reload` and `city.id` are the stable halves of two objects rebuilt each render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mine.reload, t, session, city?.id, historyOn]);

  const askToSignIn = useCallback((why: SignInWhy = 'save', resume?: () => void) => {
    ask(why, resume);
  }, [ask]);

  const actions = useMemo<SaveActions>(() => ({
    save,
    askToSignIn,
    isSaved: (slug) => savedSlugs.has(slug),
    toggle,
  }), [save, askToSignIn, savedSlugs, toggle]);
  const lists = useMemo<MyLists>(() => ({
    data: shown, loading: mine.loading, loaded: mine.loaded, error: mine.error,
    loadedAt: mine.loadedAt, fromCache: mine.fromCache, reload: mine.reload,
  }), [shown, mine.loading, mine.loaded, mine.error, mine.loadedAt, mine.fromCache, mine.reload]);

  // "Not now" is an answer: what was asked for is forgotten with it.
  const closeAuth = useCallback(() => { setAuthSheet(false); dropResume(); }, []);
  const signIn = useCallback(() => { setAuthSheet(false); goTo('Profile', { screen: 'SignIn', initial: false }); }, []);
  const closeSave = useCallback(() => setTarget(null), []);
  const newList = useCallback(() => {
    const place = target;
    setTarget(null);
    // `initial: false` for the same reason as in `save`: on a cold
    // Collections stack the form must arrive *over* the list, not
    // instead of it.
    if (place) goTo('Collections', { screen: 'CollectionForm', initial: false, params: { addPlaceSlug: place.slug } });
  }, [target]);
  const sheets = useMemo<SaveSheetsState>(() => ({
    target, authSheet, signInWhy, closeAuth, signIn, closeSave, toggle, newList,
  }), [target, authSheet, signInWhy, closeAuth, signIn, closeSave, toggle, newList]);

  return (
    <ListsCtx.Provider value={lists}>
    <ActionsCtx.Provider value={actions}>
    <SheetsCtx.Provider value={sheets}>
      {children}
    </SheetsCtx.Provider>
    </ActionsCtx.Provider>
    </ListsCtx.Provider>
  );
}
