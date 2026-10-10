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

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';
import AuthSheet from '../components/AuthSheet';
import SaveSheet from '../components/SaveSheet';
import { useAuth } from './auth';
import {
  addPlaceToCollection, Collection, holds, logPlaceEvent, nextSortOrder, Place, removePlaceFromCollection,
  useMyCollections, useMyPreferences,
} from './data';
import { useCity } from './city';
import { useI18n } from './i18n';
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
export type SignInWhy = 'save' | 'like' | 'copy' | 'saved' | 'search' | 'trip';

type Save = {
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
   * The user's own collections — the single copy in the app.
   *
   * Screens read this rather than calling `useMyCollections` themselves.
   * Two copies is how the save sheet came to show one list while the
   * Collections tab showed two: the sheet's copy was fetched before the
   * second list existed and had no reason to look again.
   */
  mine: { data: Collection[]; loading: boolean; loaded: boolean; reload: () => void };
};

const Ctx = createContext<Save>({
  save: () => {},
  askToSignIn: () => {},
  isSaved: () => false,
  mine: { data: [], loading: false, loaded: false, reload: () => {} },
});

export const useSave = () => useContext(Ctx);

export function SaveProvider({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const { session, userId } = useAuth();
  // The early id, so the lists hydrate with the catalog rather than a
  // session read later — see `Auth.userId`. `save` itself still asks the
  // session: opening a sheet is an act, not a read.
  const me = session?.user?.id ?? userId;
  const mine = useMyCollections(me);
  const { city } = useCity();
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
    holdResume({ tab: navRef.isReady() ? focusedTab(navRef.getRootState()) : null, run, at: Date.now() });
    setSignInWhy(why);
    setAuthSheet(true);
  }, []);
  // The save to finish is *this* render's `save`, the one that knows the
  // reader is signed in now — the one the guest tapped would only raise
  // the sheet again.
  const saveRef = useRef<(place: Place) => void>(() => {});

  const savedSlugs = useMemo(() => {
    const set = new Set<string>();
    for (const c of mine.data) {
      for (const cp of c.collection_places) if (cp.places) set.add(cp.places.slug);
    }
    return set;
  }, [mine.data]);

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
    // "Name your list" as though they had none. `initial: false` is the
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
    try {
      const had = holds(c, place.slug);
      if (had) await removePlaceFromCollection(c.slug, place.slug);
      else await addPlaceToCollection(c.slug, place.slug, nextSortOrder(c));
      // Noted here rather than in the sheet because this is the one place
      // both verbs pass through, and only after the write succeeded — an
      // event for a save that did not happen is worse than no event.
      //
      // Not `useNoteEvent`: that hook reads this provider, and a provider
      // that imports the module importing it is a cycle Metro resolves by
      // handing one of them an empty object at start-up.
      void logPlaceEvent(session?.user?.id, place.slug, had ? 'unsave' : 'save', city?.id ?? null, historyOn);
      mine.reload();
    } catch (e) {
      // Three hundred saves in a day is the cap the policy holds; the
      // sheet says so rather than showing the policy's own sentence.
      if (isDailyLimit(e)) {
        Alert.alert(
          t('That is enough for today', 'Hôm nay vậy là đủ', '本日はここまで'),
          t(
            `You can save ${DAILY_CAPS.placesIntoLists} places a day. Come back tomorrow.`,
            `Mỗi ngày bạn có thể lưu ${DAILY_CAPS.placesIntoLists} địa điểm. Mai quay lại nhé.`,
            `1日に${DAILY_CAPS.placesIntoLists}件まで保存できます。また明日どうぞ。`,
          ),
        );
        return;
      }
      Alert.alert(
        t('Could not save', 'Không lưu được', '保存できませんでした'),
        e instanceof Error ? e.message : String(e),
      );
    }
  // `mine.reload` and `city.id` are the stable halves of two objects rebuilt each render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mine.reload, t, session, city?.id, historyOn]);

  const askToSignIn = useCallback((why: SignInWhy = 'save', resume?: () => void) => {
    ask(why, resume);
  }, [ask]);

  const value = useMemo<Save>(() => ({
    save,
    askToSignIn,
    isSaved: (slug) => savedSlugs.has(slug),
    mine: {
      data: mine.data, loading: mine.loading, loaded: mine.loaded, reload: mine.reload,
    },
  }), [save, askToSignIn, savedSlugs, mine.data, mine.loading, mine.loaded, mine.reload]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <AuthSheet
        visible={authSheet}
        why={signInWhy}
        // "Not now" is an answer: what was asked for is forgotten with it.
        onClose={() => { setAuthSheet(false); dropResume(); }}
        onSignIn={() => { setAuthSheet(false); goTo('Profile', { screen: 'SignIn', initial: false }); }}
      />
      <SaveSheet
        place={target}
        collections={mine.data}
        onClose={() => setTarget(null)}
        onToggle={toggle}
        onNew={() => {
          const place = target;
          setTarget(null);
          // `initial: false` for the same reason as in `save`: on a cold
          // Collections stack the form must arrive *over* the list, not
          // instead of it.
          if (place) goTo('Collections', { screen: 'CollectionForm', initial: false, params: { addPlaceSlug: place.slug } });
        }}
      />
    </Ctx.Provider>
  );
}
