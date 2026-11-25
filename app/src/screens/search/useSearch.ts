// Out of `SearchScreen` on 25 Nov 2026, so the screen's function fits the
// ceiling (`oversize.js`); the reasoning moved with the code, unchanged.
// The screen's state, one concern to a hook.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { TextInput } from 'react-native';
import { type Candidates, freshOnly } from '../../lib/candidates';
import { useLikes, type useSearchTerms } from '../../lib/catalog';
import { presentCategories } from '../../lib/categories';
import type { useCityList, useCurrentCity } from '../../lib/city';
import { cityOfList, type Collection, isLive, membersOf, type Place } from '../../lib/data';
import { useI18n } from '../../lib/i18n';
import { newestPlaces } from '../../lib/newest';
import { rankPopular } from '../../lib/popular';
import { RECENTS_KEY, rememberSearch } from '../../lib/recents';
import { useMyLists, type useSaveActions } from '../../lib/save';
import { findPlaces } from '../../lib/search';
import {
  cityChips, countByCity, picked as inCities, type CityPick,
} from '../../lib/searchCities';
import { useSearchIndex } from '../../lib/searchIndex';
import { NO_RECENTS, RECENTS, useStored } from '../../lib/stored';
import type { Nav } from '../../nav';

/** The box, and the keyboard raised once the push has landed. */
export function useSummon(navigation: Nav) {
  // The box, reachable: the ↗ on a recent row puts the term *into* the
  // field for editing — a different promise from the row itself, which
  // runs the search as typed — and putting it there without focusing the
  // field would strand the reader one tap short of the edit they asked for.
  const inputRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  // The keyboard waits for the push to land. `autoFocus` raised it during
  // the slide itself — two animations fighting for the same frames, which
  // is the stutter this screen was reported for. `transitionEnd` is the
  // moment the screen has stopped moving; the timer is the fallback for
  // any path that never emits one, and the gate keeps a later pop back to
  // this screen from re-summoning a keyboard nobody asked for.
  const summoned = useRef(false);
  useEffect(() => {
    const summon = () => {
      if (summoned.current) return;
      summoned.current = true;
      inputRef.current?.focus();
    };
    const un = navigation.addListener('transitionEnd', summon);
    const t = setTimeout(summon, 600);
    return () => { un(); clearTimeout(t); };
  }, [navigation]);
  return inputRef;
}

/** What the box remembers, and the taps that make a search worth it. */
export function useRemembered(
  query: string,
  list: Collection | null,
  toggle: ReturnType<typeof useSaveActions>['toggle'],
  navigation: Nav,
) {
  // What this box remembered from earlier visits. Loaded once; the pure
  // rules for what gets kept live in lib/recents where the gate can see
  // them, and this screen only ferries the list to and from storage. A
  // read that fails (fresh install, cleared storage) is an empty memory,
  // not an error.
  const [recents, keepRecents] = useStored(RECENTS_KEY, NO_RECENTS, RECENTS);
  // A search is worth remembering when it *worked* — the reader opened
  // one of its results. Called from every result row's onPress; blank
  // queries no-op inside rememberSearch.
  //
  // Read through `latest`, so this and the two below hold still from one
  // render to the next and a result's card is not redrawn by every letter
  // (`SearchPlaceCard`) — yet never act on a render gone by: the query
  // remembered is the one in the box at the tap, not when the card was
  // last drawn.
  const latest = useRef({ query, recents, keepRecents, list, toggle });
  latest.current = { query, recents, keepRecents, list, toggle };
  const noteSearch = useCallback(() => {
    const { query: now, recents: kept, keepRecents: keep } = latest.current;
    const next = rememberSearch(kept, now);
    if (next !== kept) keep(next);
  }, []);
  const openPlace = useCallback((pl: Place) => {
    // This tap is what makes the query worth remembering: it found the
    // thing. See lib/recents.
    noteSearch();
    navigation.navigate('PlaceDetail', { slug: pl.slug });
  }, [noteSearch, navigation]);
  const togglePlace = useCallback((pl: Place) => {
    const { list: into, toggle: flip } = latest.current;
    if (!into) return;
    noteSearch();
    void flip(into, pl);
  }, [noteSearch]);
  return { recents, keepRecents, noteSearch, openPlace, togglePlace };
}

/** What Google found that the catalog had not, and which are ticked. */
export function useGoogleChoice(google: Candidates, query: string) {
  const [picked, setPicked] = useState<string[]>([]);

  // Cleared whenever the words change: a Google section answering the
  // previous query, sitting under results for this one, would be the
  // screen quietly lying about what it went and asked.
  //
  // Guarded, because this runs on every keystroke and both calls set
  // state unconditionally — `setPicked([])` hands React a fresh array
  // every time, so an untouched screen re-rendered once per letter for no
  // reason at all. Almost nobody ever has a Google section open while
  // typing, so almost every keystroke now skips this entirely.
  const hasAsked = google.results !== null || google.searching;
  useEffect(() => {
    if (!hasAsked && picked.length === 0) return;
    google.clear();
    setPicked([]);
  }, [query]); // eslint-disable-line react-hooks/exhaustive-deps

  // Only what the catalog had never heard of *when the search ran*.
  // Everything else in that list this screen has already shown, or
  // deliberately not shown, above.
  //
  // Deliberately not recomputed when `known` changes, and that is the
  // whole subtlety here: adding a place sets its state to 'mine', so a
  // list filtered live would delete each row at the moment it succeeded —
  // rows vanishing under the reader's finger, mid-batch, taking the
  // per-row "Added" with them. `run` sets `known` and `results` together,
  // so the render that first sees results already has the right map.
  //
  // Memoised anyway because `rows` below depends on it, and a fresh array
  // every render would recompute the whole catalog filter on every
  // keystroke — the one thing this screen is built not to do.
  const fresh = useMemo(
    () => (google.results ? freshOnly(google.results, google.known) : null),
    [google.results], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // What is still addable, which does follow `known`: a row stays on
  // screen after it is added, but it stops counting towards the button.
  const addable = (fresh ?? []).filter(
    (c) => (google.known[c.place_id]?.state ?? 'none') === 'none',
  );
  const chosen = addable.filter((c) => picked.includes(c.place_id));
  return { picked, setPicked, fresh, chosen };
}

/** The zero-state's shelves, and the collections a search can find. */
export function useShelves(places: Place[], cols: { data: Collection[] }, adding: boolean) {
  // Resolved once per catalog, not once per keystroke. `membersOf` builds
  // an index of every place each time it is called, and this ran it for
  // all twenty-two lists on every letter — before the filter, so it paid
  // for the twenty that were never going to match either.
  //
  // None while adding to a list: a collection is not something to put in
  // one, and its row would be one more thing between the reader and the
  // places.
  const colMembers = useMemo(
    () => (adding ? [] : cols.data.map((c) => ({ c, members: membersOf(c, places) }))),
    [adding, cols.data, places],
  );

  // The zero-state's third section. Ranked over the live catalog only —
  // `usePlaces` includes the reader's own still-pending submissions, and
  // "most popular" must not recommend a place nobody else can open yet.
  // The scoring itself lives in lib/popular; see the essay there.
  // The ranking figure: a curator's like of their own list is not a reader
  // recommending its places.
  const { rankLikes } = useLikes();
  const popular = useMemo(
    () => rankPopular(places.filter(isLive), cols.data, rankLikes),
    [places, cols.data, rankLikes],
  );

  // The zero-state's fourth section: the catalog's newest arrivals, for
  // the reader who already knows this city and opens Search to ask what
  // changed. Live rows only, for the same reason `popular` filters —
  // this must not advertise a place nobody else can open yet. The
  // ordering caveats live with the ranking, in lib/newest.
  const newest = useMemo(() => newestPlaces(places.filter(isLive)), [places]);

  // Only categories this city actually has — the same rule the Explore
  // filter row states: a chip never leads to an empty list. Counted over
  // the live catalog for the same reason `popular` is.
  const cats = useMemo(() => presentCategories(places.filter(isLive)), [places]);
  return { colMembers, popular, newest, cats };
}

/** Which cities a search answers from, and what each found. */
export function useCities({ terms, deferred, synonyms, userId, places, home, cityList, t }: {
  terms: string[];
  deferred: string;
  synonyms: ReturnType<typeof useSearchTerms>;
  userId: string | null | undefined;
  places: Place[];
  home: string | null;
  cityList: ReturnType<typeof useCityList>['cities'];
  t: ReturnType<typeof useI18n>['t'];
}) {
  // `lib/searchRows`.
  // ── every city (owner, 22 Oct 2026) ──
  //
  // A search answers from every city now, the reader's own first, under a
  // row of chips saying what each city found — the rules are
  // `lib/searchCities`'. The reader's city answers from its catalog, which
  // is on screen already and whole; the others from the index, asked for
  // as the screen opens (`useSearchIndex`). Until it lands the reader's
  // own city answers alone, as it always did, under a row that already
  // stands — All without a figure, since it does not know one yet — so the
  // other cities' chips join it rather than push the list.
  //
  // `pick` is null until the reader taps a chip: All, then, whatever city
  // the reader is in (owner, 24 Oct 2026). State, not storage, so every
  // visit to Search starts on All.
  const searching = terms.length > 0;
  const index = useSearchIndex(userId);
  const everywhere = useMemo(
    () => (index && home ? [...places, ...index.filter((p) => p.city_id !== home)] : places),
    [index, places, home],
  );
  const [cityChoice, setCityChoice] = useState<CityPick | null>(null);
  const pick: CityPick = cityChoice ?? 'all';
  // What every city found, for the chips' counts. The same match the list
  // runs (`findPlaces`), so a chip's figure is the list it opens.
  const counts = useMemo(
    () => countByCity(searching ? findPlaces(everywhere, deferred, synonyms).hits : []),
    [searching, everywhere, deferred, synonyms],
  );
  const chips = searching && home ? cityChips(counts, home, pick) : null;
  const inPick = useMemo(() => everywhere.filter((p) => inCities(pick, p.city_id)), [everywhere, pick]);
  const cityName = (id: string | null | undefined) => {
    const c = cityList.find((x) => x.id === id);
    return c ? t(c.short_en, c.short_vi, c.short_ja) : null;
  };
  return { searching, index, pick, setCityChoice, counts, chips, inPick, cityName };
}

/** The list Search was opened to add to, if it is one of the reader's,
 *  and the city it answers in. */
export function useListToAdd(
  addTo: string | undefined,
  city: ReturnType<typeof useCurrentCity>['city'],
  cityList: ReturnType<typeof useCityList>['cities'],
) {
  const { t } = useI18n();
  // ── adding to a list (owner, 23 Oct 2026) ──
  //
  // Opened from one of the reader's own lists, Search puts that list's
  // ⊕ on every place it shows, a tap puts the place in or takes it out,
  // and what Google finds goes in once it is made. The list is read from
  // `useMyLists`, the copy with the taps already laid over it, so a ✓
  // moves when it is tapped. Not one of theirs, or not loaded: plain
  // Search, which is what every other way in has always opened.
  const mine = useMyLists();
  const list = (addTo && mine.data.find((c) => c.slug === addTo)) || null;
  const listTitle = list ? t(list.title_en, list.title_vi, list.title_ja) : '';
  const listCount = list ? list.collection_places.length : 0;
  // The newest copy, for what Google makes: a run takes a while, and the
  // reader may tick more in the meantime.
  const listRef = useRef(list);
  listRef.current = list;

  // ── in the list's city (owner, 23 Oct 2026) ──
  //
  // A list of Huế cafés, opened while the app was in Ninh Bình, was offered
  // Ninh Bình: its three category chips, its pagoda as most popular, Google
  // asked about Ninh Bình. So opened from a list, Search answers in the
  // city most of the list's places are in (`cityOfList`) — the catalog,
  // the shelves before anything is typed, the chips' home and Google —
  // and the city the app is in stays where it was. An empty list has no
  // city of its own, and answers in the app's.
  const home = list ? cityOfList(list, city?.id ?? null) : city?.id ?? null;
  const homeCity = cityList.find((c) => c.id === home) ?? city;
  return { list, listTitle, listCount, listRef, home, homeCity };
}
