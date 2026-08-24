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

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import AuthSheet from '../components/AuthSheet';
import SaveSheet from '../components/SaveSheet';
import { useAuth } from './auth';
import {
  addPlaceToCollection, Collection, holds, logPlaceEvent, Place, removePlaceFromCollection,
  useMyCollections, useMyPreferences,
} from './data';
import { useCity } from './city';
import { useI18n } from './i18n';
import { goTo } from '../nav';

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
   */
  askToSignIn: () => void;
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
  const { session } = useAuth();
  const mine = useMyCollections(session?.user?.id);
  const { city } = useCity();
  // Only for the opt-in flag. The insert policy checks it too; this saves
  // a round trip to be told no.
  const historyOn = useMyPreferences(session?.user?.id).data.history_on;
  const [target, setTarget] = useState<Place | null>(null);
  const [authSheet, setAuthSheet] = useState(false);

  const savedSlugs = useMemo(() => {
    const set = new Set<string>();
    for (const c of mine.data) {
      for (const cp of c.collection_places) if (cp.places) set.add(cp.places.slug);
    }
    return set;
  }, [mine.data]);

  const save = useCallback((place: Place) => {
    if (!session) { setAuthSheet(true); return; }
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
  }, [session, mine.loaded, mine.loading, mine.error, mine.data.length, mine.reload]);

  const toggle = useCallback(async (c: Collection, place: Place) => {
    try {
      const had = holds(c, place.slug);
      if (had) await removePlaceFromCollection(c.slug, place.slug);
      else await addPlaceToCollection(c.slug, place.slug, c.collection_places.length);
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
      Alert.alert(
        t('Could not save', 'Không lưu được', '保存できませんでした'),
        e instanceof Error ? e.message : String(e),
      );
    }
  // `mine.reload` and `city.id` are the stable halves of two objects rebuilt each render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mine.reload, t, session, city?.id, historyOn]);

  const askToSignIn = useCallback(() => setAuthSheet(true), []);

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
        onClose={() => setAuthSheet(false)}
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
