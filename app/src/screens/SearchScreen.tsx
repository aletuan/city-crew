// Search — type-to-filter across the current city's catalog.
//
// The catalog is small enough to live in memory, so filtering runs
// client-side over what the catalog already loaded (`useCatalogIn`):
// instant, no extra queries, and it matches without diacritics so
// "banh mi" finds "Bánh mì Huỳnh Hoa".

import React, { useDeferredValue, useMemo, useState } from 'react';
import { FlatList, Keyboard, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import SearchField from '../components/SearchField';
import AddBatchBar, { batchBarShown } from '../components/AddBatchBar';
import {
  AmbientWarmth,
  UnderlineChoice,
  useTabBarClearance,
} from '../components/ui';
import { holds, type Place } from '../lib/data';
import { useCityList, useCurrentCity } from '../lib/city';
import { useSession } from '../lib/auth';
import { useSaveActions } from '../lib/save';
import { addAll } from '../lib/pendingSaves';
import { useCandidates } from '../lib/candidates';
import { escapeRoutes } from '../lib/deadend';
import { DEFAULT_TZ } from '../lib/clock';
import { useCatalogIn, useSearchTerms } from '../lib/catalog';
import { buildSearchRows } from '../lib/searchRows';
import { queryTerms } from '../lib/search';
import { tapCity, totalFound } from '../lib/searchCities';
import { useI18n } from '../lib/i18n';
import type { Nav, RootRoute } from '../nav';
import { s } from './search/styles';
import { AddingTo } from './search/AddingTo';
import { GoogleAsk, GoogleNothing } from './search/google';
import { type RowContext, Row } from './search/Row';
import { SearchEmpty } from './search/SearchEmpty';
import { useCities, useGoogleChoice, useListToAdd, useRemembered, useShelves, useSummon } from './search/useSearch';
export default function SearchScreen({ navigation, route }: { navigation: Nav; route?: RootRoute<'Search'> }) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  // What the results answer, a beat behind the box (owner, 30 Oct 2026).
  // The box shows every letter as it is typed; the search over every
  // city, its counts and its rows follow at a lower priority, so a letter
  // is never held up by the list it is about to change. Typing fast, the
  // in-between queries are skipped rather than queued.
  const deferred = useDeferredValue(query);
  const { city } = useCurrentCity();
  const { cities: cityList } = useCityList();
  const { userId } = useSession();
  const tabClearance = useTabBarClearance();

  const { toggle } = useSaveActions();
  // The list being added to, and the city Search answers in — see `useListToAdd`.
  const { list, listTitle, listCount, listRef, home, homeCity } = useListToAdd(route?.params?.addTo, city, cityList);
  const scope = useCatalogIn(home);
  const places = scope.places.data;
  const cols = scope.collections;
  const google = useCandidates(homeCity);


  // The clock the zero-state rows read "until 22:00" against, and a
  // list's "New" badge its age. Taken per render rather than memoised: a
  // memo would freeze the screen at the minute it mounted, and this screen
  // is exactly the kind that stays open across a closing time.
  const now = new Date();

  const inputRef = useSummon(navigation);

  const { recents, keepRecents, noteSearch, openPlace, togglePlace } = useRemembered(query, list, toggle, navigation);
  // A ⊕ found the thing as surely as opening it did, so it is remembered
  // the same way.
  const inList = (pl: Place) => (list
    ? { on: holds(list, pl.slug), title: listTitle, onPress: () => togglePlace(pl) }
    : undefined);

  const { picked, setPicked, fresh, chosen } = useGoogleChoice(google, query);

  // None while adding to a list: a collection is not something to put in one.
  const adding = !!list;
  const { colMembers, popular, newest, cats } = useShelves(places, cols, adding);

  const terms = useMemo(() => queryTerms(deferred), [deferred]);
  // The desk's synonyms, folded onto the app's own. This is what lets
  // "cinema" reach a multiplex whose record never says the word.
  const synonyms = useSearchTerms();

  // Which sections appear, in what order, and which never mix — see
  // Every city a search answers from — see `useCities`.
  const { searching, index, pick, setCityChoice, counts, chips, inPick, cityName } = useCities({
    terms, deferred, synonyms, userId, places, home, cityList, t,
  });

  const rows = useMemo(
    () => buildSearchRows({
      terms, query: deferred, recents, cats, popular, latest: newest, colMembers,
      places: searching ? inPick : places,
      cities: pick === 'all' ? null : pick,
      cityOrder: chips ? chips.map((c) => c.id) : null,
      fresh, synonyms,
    }, t),
    [terms, deferred, places, inPick, searching, pick, chips, colMembers, fresh, synonyms, t, recents, popular, newest, cats],
  );

  // Row key → position among the place hits, so a UI test can address
  // "the first result" without knowing what it is called today.
  const placeIndex = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) if (r.kind === 'place') m.set(r.key, m.size);
    return m;
  }, [rows]);

  // Everything a row reads from the screen (`Row`).
  const at: RowContext = {
    keepRecents, setQuery, inputRef, cats, now, tz: homeCity?.tz ?? DEFAULT_TZ, inList, navigation, google,
    picked, setPicked, noteSearch, placeIndex, pick, cityName, list, listTitle, openPlace, togglePlace,
  };

  const showBar = batchBarShown(chosen.length, google.batch);

  // The fork out of a dead end: the part of town and the kind of place
  // hiding inside the failed query, offered as chips. Computed only when
  // the screen is actually empty — on any other frame the answer is
  // thrown away, and this walks the whole catalog.
  const dead = searching && rows.length === 0;
  // Found, but not in the cities chosen: the chips above say where, and the
  // screen does not choose for the reader (owner, 22 Oct 2026). Google's
  // row stays under it. It was left out, on the reading that the answer
  // existed elsewhere; but somebody in Hanoi typing "vườn thảo điền" may
  // mean one the catalog has not got, and had to tap Saigon to be offered
  // Google at all (owner, the same night: long-winded and hard to follow).
  // The fork stays out: it guesses at what else was meant, and here the
  // chips already answer that.
  const elsewhere = dead && totalFound(counts) > 0;
  const routes = useMemo(
    () => (dead ? escapeRoutes(deferred, places, synonyms) : []),
    [dead, deferred, places, synonyms],
  );

  // The words go with them. Someone who typed "Cộng Cà Phê" here and found
  // nothing should not have to type it again on the one screen whose whole
  // job is to go and look for it — the tap is the instruction, not the
  // start of a second attempt.
  //
  // Shortened for the label only — what travels is the whole query as
  // typed, trimmed of the spaces at its ends and nothing more.
  //
  // Fourteen, because the title sits at 18pt beside a 52pt circle and a
  // chevron: about 21 characters on a small phone, and `Thêm “…”` spends
  // six of them before the query starts. A cap chosen without the frame
  // in mind produces a label the frame cuts anyway, closing quote and
  // all — which is exactly how the Explore row ended up reading "Biết
  // chỗ nào chúng tôi còn thi…".
  const typed = query.trim();
  const shown = typed.length > 14 ? `${typed.slice(0, 14)}…` : typed;
  // The tap that asks Google, under the results — see `GoogleAsk`.
  const addRow = <GoogleAsk google={google} typed={typed} shown={shown} />;

  const googleEmpty = google.results !== null && fresh?.length === 0 && <GoogleNothing />;

  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <AmbientWarmth />
      <View style={s.header}>
        {/* The one box — `SearchField`, which this screen's drawing of it
            became once the check-ins list wanted the same one.

            No back control beside it since 15 Oct 2026: the owner's
            call, with Cancel inside the box as on Collections. This
            screen is a search and nothing else, so leaving the search is
            leaving the screen — Cancel goes back, always shown, and the
            box takes the width the back disc had. The edge swipe and the
            tab bar still leave too. */}
        <SearchField
          inputRef={inputRef}
          value={query}
          onChangeText={setQuery}
          placeholder={adding
            ? t('Search places', 'Tìm địa điểm', 'スポットを検索', '搜索地点', '搜尋地點')
            : t('Search places and collections', 'Tìm địa điểm và bộ sưu tập', 'スポットやコレクションを検索', '搜索地点和合集', '搜尋地點和合集')}
          cancel={{ shown: true, label: t('Cancel', 'Huỷ', 'キャンセル', '取消', '取消'), onPress: () => navigation.goBack() }}
        />
      </View>
      {/* Where a ⊕ puts a place — see `AddingTo`. */}
      {list ? <AddingTo title={listTitle} count={listCount} /> : null}
      {/* The cities, under the box rather than in the list, so they stay
          while the results scroll: All, then the reader's own city, then
          the rest most first (`lib/searchCities`). A tap puts the keyboard
          away and keeps the words, as the reference does: the reader has
          stopped typing to look. */}
      {chips ? (
        // Explore's underline row (owner, 25 Oct 2026), with the figures
        // the chips carried: one city at a time, the chosen one tapped
        // again is All, as `tapCity` has it.
        <View style={s.citiesRow}>
          <UnderlineChoice
            items={chips.map(({ id, count }) => ({ key: id, label: cityName(id) ?? id, count, testID: `search-city-${id}` }))}
            chosen={pick === 'all' ? null : pick[0]}
            onPick={(id) => { Keyboard.dismiss(); setCityChoice(id === null ? 'all' : tapCity(pick, id)); }}
            all={t('All', 'Tất cả', 'すべて', '全部', '全部')}
            allCount={index ? totalFound(counts) : undefined}
            testID="search-cities"
          />
        </View>
      ) : null}

      <FlatList
        data={rows}
        keyExtractor={(r) => r.key}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        renderItem={({ item }) => <Row item={item} at={at} />}
        ListEmptyComponent={(
          <SearchEmpty
            searching={searching}
            elsewhere={elsewhere}
            shown={shown}
            pick={pick}
            cityName={cityName}
            addRow={addRow}
            googleEmpty={googleEmpty}
            routes={routes}
            onSearch={setQuery}
            onBack={() => navigation.goBack()}
            toList={adding}
          />
        )}
        // Only while searching: before a word is typed the list holds the
        // zero-state, and offering to go and add a place would be
        // answering a question nobody asked.
        ListFooterComponent={searching && rows.length > 0
          ? <>{addRow}{googleEmpty}</>
          : undefined}
        contentContainerStyle={{ paddingTop: 6, paddingBottom: showBar ? 10 : tabClearance }}
        showsVerticalScrollIndicator={false}
      />

      {/* The same commit Add a place has, for the same reason: choosing
          five results and pressing ⊕ five times is five round trips the
          reader waits through one at a time. No way out button here —
          this screen is somewhere the reader already wanted to be, so
          when there is nothing left to add the bar simply goes and the
          rows say what became of each one. */}
      <AddBatchBar
        chosen={chosen.length}
        batch={google.batch}
        onAdd={() => {
          if (!chosen.length) return;
          // Into the list once they are made — each one, the moment the
          // run is over, after the last member (`addAll`).
          void google.addMany(chosen).then(({ made }) => {
            if (listRef.current) addAll(listRef.current, made, toggle);
          });
        }}
      />
    </SafeAreaView>
  );
}
