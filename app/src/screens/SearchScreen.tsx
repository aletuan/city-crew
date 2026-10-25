// Search — type-to-filter across the current city's catalog.
//
// The catalog is small enough to live in memory, so filtering runs
// client-side over what the catalog already loaded (`useCatalogIn`):
// instant, no extra queries, and it matches without diacritics so
// "banh mi" finds "Bánh mì Huỳnh Hoa".

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Keyboard, StyleSheet, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import PlaceCard from '../components/PlaceCard';
import SearchField from '../components/SearchField';
import { AddSlot } from '../components/add';
import AddBatchBar, { batchBarShown } from '../components/AddBatchBar';
import CandidateRow from '../components/CandidateRow';
import ListToggle from '../components/ListToggle';
import {
  AmbientWarmth, Card, Empty, PressableScale, UnderlineChoice, useTabBarClearance,
} from '../components/ui';
import { cityOfList, coverOf, fmtCount, holds, isLive, membersOf, type Place } from '../lib/data';
import { CATEGORIES, categoryLabel, presentCategories } from '../lib/categories';
import { useCityList, useCurrentCity } from '../lib/city';
import { useSession } from '../lib/auth';
import { useMyLists, useSaveActions } from '../lib/save';
import { addAll } from '../lib/pendingSaves';
import { freshOnly, useCandidates } from '../lib/candidates';
import { escapeRoutes } from '../lib/deadend';
import { DEFAULT_TZ } from '../lib/clock';
import { openFragment, openState } from '../lib/format';
import { useCatalogIn, useLikes, useSearchTerms } from '../lib/catalog';
import { RECENTS_KEY, rememberSearch } from '../lib/recents';
import { buildSearchRows } from '../lib/searchRows';
import { NO_RECENTS, RECENTS, useStored } from '../lib/stored';
import { newestPlaces } from '../lib/newest';
import { rankPopular } from '../lib/popular';
import { findPlaces, queryTerms } from '../lib/search';
import {
  cityChips, countByCity, namesCities, picked as inCities, tapCity, totalFound, type CityPick,
} from '../lib/searchCities';
import { useSearchIndex } from '../lib/searchIndex';
import { useI18n } from '../lib/i18n';
import { localized } from '../lib/localized';
import { splitName } from '../lib/name';
import { colors, font, onPhoto, radius, space, type } from '../theme';
import type { Nav, RootRoute } from '../nav';

export default function SearchScreen({ navigation, route }: { navigation: Nav; route?: RootRoute<'Search'> }) {
  const { t, lang } = useI18n();
  const [query, setQuery] = useState('');
  const { city } = useCurrentCity();
  const { cities: cityList } = useCityList();
  const { userId } = useSession();
  const tabClearance = useTabBarClearance();

  // ── adding to a list (owner, 23 Oct 2026) ──
  //
  // Opened from one of the reader's own lists, Search puts that list's
  // ⊕ on every place it shows, a tap puts the place in or takes it out,
  // and what Google finds goes in once it is made. The list is read from
  // `useMyLists`, the copy with the taps already laid over it, so a ✓
  // moves when it is tapped. Not one of theirs, or not loaded: plain
  // Search, which is what every other way in has always opened.
  const mine = useMyLists();
  const { toggle } = useSaveActions();
  const addTo = route?.params?.addTo;
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
  const scope = useCatalogIn(home);
  const places = scope.places.data;
  const cols = scope.collections;
  const google = useCandidates(homeCity);

  const [picked, setPicked] = useState<string[]>([]);

  // The clock the zero-state rows read "until 22:00" against. Taken per
  // render rather than memoised: a memo would freeze the screen at the
  // minute it mounted, and this screen is exactly the kind that stays
  // open across a closing time.
  const now = new Date();

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

  // What this box remembered from earlier visits. Loaded once; the pure
  // rules for what gets kept live in lib/recents where the gate can see
  // them, and this screen only ferries the list to and from storage. A
  // read that fails (fresh install, cleared storage) is an empty memory,
  // not an error.
  const [recents, keepRecents] = useStored(RECENTS_KEY, NO_RECENTS, RECENTS);
  // A search is worth remembering when it *worked* — the reader opened
  // one of its results. Called from every result row's onPress; blank
  // queries no-op inside rememberSearch.
  const noteSearch = () => {
    const next = rememberSearch(recents, query);
    if (next !== recents) keepRecents(next);
  };
  // A ⊕ found the thing as surely as opening it did, so it is remembered
  // the same way.
  const inList = (pl: Place) => (list
    ? { on: holds(list, pl.slug), title: listTitle, onPress: () => { noteSearch(); void toggle(list, pl); } }
    : undefined);

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

  // Resolved once per catalog, not once per keystroke. `membersOf` builds
  // an index of every place each time it is called, and this ran it for
  // all twenty-two lists on every letter — before the filter, so it paid
  // for the twenty that were never going to match either.
  //
  // None while adding to a list: a collection is not something to put in
  // one, and its row would be one more thing between the reader and the
  // places.
  const adding = !!list;
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
  const latest = useMemo(() => newestPlaces(places.filter(isLive)), [places]);

  // Only categories this city actually has — the same rule the Explore
  // filter row states: a chip never leads to an empty list. Counted over
  // the live catalog for the same reason `popular` is.
  const cats = useMemo(() => presentCategories(places.filter(isLive)), [places]);

  const terms = useMemo(() => queryTerms(query), [query]);
  // The desk's synonyms, folded onto the app's own. This is what lets
  // "cinema" reach a multiplex whose record never says the word.
  const synonyms = useSearchTerms();

  // Which sections appear, in what order, and which never mix — see
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
    () => countByCity(searching ? findPlaces(everywhere, query, synonyms).hits : []),
    [searching, everywhere, query, synonyms],
  );
  const chips = searching && home ? cityChips(counts, home, pick) : null;
  const inPick = useMemo(() => everywhere.filter((p) => inCities(pick, p.city_id)), [everywhere, pick]);
  const cityName = (id: string | null | undefined) => {
    const c = cityList.find((x) => x.id === id);
    return c ? t(c.short_en, c.short_vi, c.short_ja) : null;
  };

  const rows = useMemo(
    () => buildSearchRows({
      terms, query, recents, cats, popular, latest, colMembers,
      places: searching ? inPick : places,
      cities: pick === 'all' ? null : pick,
      cityOrder: chips ? chips.map((c) => c.id) : null,
      fresh, synonyms,
    }, t),
    [terms, query, places, inPick, searching, pick, chips, colMembers, fresh, synonyms, t, recents, popular, latest, cats],
  );

  // Row key → position among the place hits, so a UI test can address
  // "the first result" without knowing what it is called today.
  const placeIndex = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) if (r.kind === 'place') m.set(r.key, m.size);
    return m;
  }, [rows]);

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
    () => (dead ? escapeRoutes(query, places, synonyms) : []),
    [dead, query, places, synonyms],
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
  // The tap stays, and stops being a journey.
  //
  // It used to open Add a place, which then ran the same search again on
  // another screen. The tap was never the problem — it is the one signal
  // that Google is worth asking, and no heuristic knows that better than
  // the person who just failed to find something. What was wrong was
  // making them leave the page to spend it.
  //
  // So: same row, same tap, results underneath. And once a search has
  // run, the row has nothing left to offer and goes.
  const askedGoogle = google.results !== null || google.searching;
  const addRow = google.searching
    ? <ActivityIndicator color={colors.accent} style={{ marginTop: 28 }} />
    : askedGoogle
      ? null
      : (
        <AddSlot
          onPress={() => google.run(typed)}
          title={t(`Add “${shown}”`, `Thêm “${shown}”`, `「${shown}」を追加`, `添加“${shown}”`, `新增「${shown}」`)}
          subtitle={t(
            'We look it up on Google Maps',
            'Chúng tôi tìm trên Google Maps',
            'Google マップで探します',
            '我们会在 Google 地图上查找', '我們會在 Google 地圖上查詢',
          )}
        />
      );

  // Asked, and it had nothing the catalog has not got. Said out loud,
  // because a tap that produces no visible change reads as a broken
  // button rather than as an answer.
  const googleEmpty = google.results !== null && fresh?.length === 0 && (
    <Text style={s.nothing}>
      {t(
        'Nothing on Google Maps that is not already here.',
        'Google Maps không có chỗ nào mà đây chưa có.',
        'Google マップにも、ここにないものはありませんでした。',
        'Google 地图上没有这里尚未收录的地点。', 'Google 地圖上沒有這裡尚未收錄的地點。',
      )}
    </Text>
  );

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
          cancel={{ shown: true, label: t('Cancel', 'Hủy', 'キャンセル', '取消', '取消'), onPress: () => navigation.goBack() }}
        />
      </View>
      {/* Where a ⊕ puts a place, said once under the box rather than on
          every row: the rows only say whether each one is in.

          A chip, and not a line (owner, 23 Oct 2026). The line was the
          accent's green at 13pt behind a ⊕, which read as one more
          button and left the list's name no louder than the words before
          it. The chip is the "Browse" chips' glass, so it reads as a
          fact the screen is set to, with the name as its loudest part;
          a bookmark rather than a ⊕, because nothing here is pressed.
          The city is not named: the list's own title almost always
          says it, and the chips below show it. */}
      {list ? (
        <View style={s.addingToRow}>
          <View
            style={s.addingTo}
            testID="search-adding-to"
            accessible
            accessibilityLabel={t(
              `Adding to ${listTitle}, ${listCount} ${listCount === 1 ? 'place' : 'places'}`,
              `Đang thêm vào ${listTitle}, ${listCount} địa điểm`,
              `「${listTitle}」に追加中、${listCount}件`,
              `正在添加到“${listTitle}”，${listCount} 个地点`, `正在新增到「${listTitle}」，${listCount} 個地點`,
            )}
          >
            <Ionicons name="bookmark-outline" size={15} color={colors.textTertiary} />
            <Text style={s.addingToText} numberOfLines={1}>
              {t('Add to collection: ', 'Thêm vào bộ sưu tập: ', 'コレクションに追加：', '添加到合集：', '新增到合集：')}
              <Text style={s.addingToTitle}>{listTitle}</Text>
            </Text>
            {/* How many it holds, moving as each ⊕ is tapped (owner, 23 Oct
                2026): the list read from `useMyLists` has the taps laid
                over it, so the figure is the one the list will show. Its
                own text, outside the one that shrinks, so a long name
                ends in "…" and the count stays. */}
            <Text style={s.addingToCount} testID="search-adding-to-count">{`(${listCount})`}</Text>
          </View>
        </View>
      ) : null}
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
        renderItem={({ item }) => {
          if (item.kind === 'eyebrow') {
            return (
              <View style={s.eyebrowRow}>
                <Text style={s.eyebrow}>{item.label}</Text>
                {/* Clear wipes the whole memory — the reference design has
                    no per-row delete, and a memory you can prune one line
                    at a time invites tidying a list that exists to be
                    overwritten anyway. */}
                {item.clear ? (
                  <PressableScale
                    onPress={() => keepRecents([])}
                    scaleTo={0.92}
                    hitSlop={{ top: 10, bottom: 10, left: 12, right: 12 }}
                    accessibilityRole="button"
                    accessibilityLabel={t('Clear recent searches', 'Xóa tìm kiếm gần đây', '最近の検索を消去', '清除最近搜索', '清除最近搜尋')}
                  >
                    <Text style={s.clear}>{t('Clear', 'Xóa', '消去', '清除', '清除')}</Text>
                  </PressableScale>
                ) : null}
              </View>
            );
          }
          if (item.kind === 'recent') {
            return (
              // Two promises on one row, the standard split: the words
              // re-run the search as typed, the ↗ only lifts the term into
              // the box so it can be edited before it runs.
              //
              // Siblings, not one inside the other. The ↗ used to sit
              // inside the row's own button, and a button with a label is
              // a single element to VoiceOver — the ↗ inside it could not
              // be reached at all (and on the web it was a <button> in a
              // <button>, which is not valid HTML).
              <View style={s.recentRow}>
                <PressableScale
                  style={s.recentHit}
                  contentStyle={s.recentMain}
                  scaleTo={0.97}
                  onPress={() => setQuery(item.term)}
                  accessibilityRole="button"
                  accessibilityLabel={item.term}
                >
                  <Ionicons name="time-outline" size={18} color={colors.textTertiary} />
                  <Text style={s.recentTerm} numberOfLines={1}>{item.term}</Text>
                </PressableScale>
                <PressableScale
                  onPress={() => { setQuery(item.term); inputRef.current?.focus(); }}
                  scaleTo={0.85}
                  hitSlop={{ top: 12, bottom: 12, left: 14, right: 14 }}
                  accessibilityRole="button"
                  accessibilityLabel={t('Edit this search', 'Sửa tìm kiếm này', 'この検索を編集', '编辑此搜索', '編輯此搜尋')}
                >
                  <Ionicons
                    name="arrow-up"
                    size={17}
                    color={colors.textTertiary}
                    style={{ transform: [{ rotate: '45deg' }] }}
                  />
                </PressableScale>
              </View>
            );
          }
          if (item.kind === 'chips') {
            return (
              // Explore's underline row (owner, 25 Oct 2026, the review
              // board's first way): one line that scrolls, the glyph in
              // the category's own hue and the word, no box. The wrap of
              // boxed chips it replaces was the last boxed row left in the
              // app, three lines of it over the popular places.
              //
              // Nothing is ever chosen here. A tap *is* a search: it types
              // the category's own label into the box, and the haystack —
              // which carries every category's labels in all three
              // languages — does the rest, so a tap can never disagree
              // with typing the same word. The moment there is a word the
              // zero-state yields to results and this row with it, so an
              // underline on what was tapped would never be seen.
              <View style={s.browseRow}>
                <UnderlineChoice
                  items={cats.map((key) => ({
                    key,
                    label: categoryLabel(key, t),
                    icon: CATEGORIES[key]?.icon,
                    iconColor: CATEGORIES[key]?.color,
                    testID: `search-browse-${key}`,
                  }))}
                  chosen={null}
                  onPick={(key) => { if (key) setQuery(categoryLabel(key, t)); }}
                  testID="search-browse"
                />
              </View>
            );
          }
          if (item.kind === 'popular' || item.kind === 'latest') {
            const pl = item.place;
            const cover = coverOf(pl)?.photo_uri;
            // The reference layout, followed exactly: the meta line is
            // *where and until when* — "Bình Thạnh · until 22:00" — and
            // the rating stands alone on the right, where the eye checks
            // it last. The rating used to open the meta line, which made
            // every row lead with the one figure that least separates
            // rows on a shelf where everything is 4-and-something.
            //
            // The time half of the line answers whichever question the
            // clock poses — "until 22:00" open, "opens 08:00" closed,
            // "mở 24/24" for the places that never stop, silence when
            // the hours cannot be read. The grammar lives in
            // `openFragment`, shared with the Explore cards, so the two
            // lists can never learn to disagree about what an hour says.
            const when = openFragment(openState(pl.opening_hours, now, homeCity?.tz ?? DEFAULT_TZ), t);
            const area = localized(pl, 'neighborhood', lang);
            const meta = [area, when].filter(Boolean).join(' · ');
            return (
              <PressableScale
                contentStyle={s.row}
                onPress={() => navigation.navigate('PlaceDetail', { slug: pl.slug })}
              >
                <Card style={s.card}>
                  {cover
                    ? <Image source={{ uri: cover }} style={s.thumb} contentFit="cover" transition={200} />
                    : <View style={s.thumb} />}
                  <View style={{ flex: 1, gap: 4 }}>
                    {/* The brand alone, as `PlaceCard` prints it: the ward
                        after the dash is the row below. */}
                    <Text style={s.cardTitle} numberOfLines={1}>
                      {splitName(localized(pl, 'name', lang)).title}
                    </Text>
                    {/* The pin belongs to the area, the same mark at
                        the same size PlaceCard's district row wears — so
                        "what part of town" carries one symbol across the
                        app. The time half stays bare text on purpose:
                        "until", "opens" and "mở 24/24" already say what
                        kind of fact follows, and a clock glyph would
                        repeat them in grey. No area, no pin — an icon
                        pointing at a closing time would be labelling the
                        wrong half of the sentence. */}
                    {meta
                      ? (
                        <View style={s.metaRow}>
                          {area
                            ? <Ionicons name="location-outline" size={13} color={colors.textTertiary} />
                            : null}
                          <Text style={s.cardMeta} numberOfLines={1}>{meta}</Text>
                        </View>
                      )
                      : null}
                  </View>
                  {/* The rating takes the chevron's seat rather than
                      sharing the meta line. A row that is plainly a place
                      does not need an arrow to say it opens; it needs the
                      score, right-aligned, the way the reference draws
                      it. Unrated places keep the chevron so the right
                      edge is never simply empty.

                      With its count, as PlaceCard and the map's card
                      print it (owner, 21 Oct 2026). Without one a 5.0
                      says nothing about itself: of the 228 published
                      places at 4.9 or more, 49 stand on fewer than 50
                      reviews and 12 on fewer than 10, beside a 4.7 on
                      three thousand. The ranking already weighs the
                      count (`rank.ts` shrinks a thin score towards the
                      mean), so a 5.0 listed under a 4.8 needs the count
                      on screen to read as anything but a mistake. */}
                  {pl.rating != null
                    ? (
                      <View style={s.rowRating}>
                        <Text style={s.rowStar}>★</Text>
                        <Text style={s.rowRatingValue}>{pl.rating.toFixed(1)}</Text>
                        {pl.rating_count
                          ? (
                            <Text
                              style={s.rowRatingCount}
                              accessibilityLabel={t(`${pl.rating_count} reviews`, `${pl.rating_count} đánh giá`, `${pl.rating_count}件の評価`, `${pl.rating_count} 条评价`, `${pl.rating_count} 條評價`)}
                            >
                              ({fmtCount(pl.rating_count)})
                            </Text>
                          )
                          : null}
                      </View>
                    )
                    : <Ionicons name="chevron-forward" size={17} color={colors.textTertiary} />}
                  {list
                    ? <ListToggle {...inList(pl)!} testID={`search-${item.kind}-${pl.slug}-in-list`} />
                    : null}
                </Card>
              </PressableScale>
            );
          }
          if (item.kind === 'header') return <Text style={s.section}>{item.label}</Text>;
          if (item.kind === 'candidate') {
            return (
              <CandidateRow
                c={item.candidate}
                known={google.known[item.candidate.place_id] ?? { state: 'none' }}
                busy={google.adding === item.candidate.place_id}
                away={google.awayFrom(item.candidate)}
                item={google.batch.state[item.candidate.place_id]}
                selected={picked.includes(item.candidate.place_id)}
                onToggle={() => setPicked((p) => (
                  p.includes(item.candidate.place_id)
                    ? p.filter((x) => x !== item.candidate.place_id)
                    : [...p, item.candidate.place_id]
                ))}
                onOpen={(slug) => { noteSearch(); navigation.navigate('PlaceDetail', { slug }); }}
              />
            );
          }
          if (item.kind === 'place') {
            return (
              <PlaceCard
                place={item.place}
                city={namesCities(pick) ? cityName(item.place.city_id) : null}
                testID={`search-result-${placeIndex.get(item.key) ?? 0}`}
                inList={inList(item.place)}
                onPress={() => {
                  // This tap is what makes the query worth remembering:
                  // it found the thing. See lib/recents.
                  noteSearch();
                  navigation.navigate('PlaceDetail', { slug: item.place.slug });
                }}
              />
            );
          }
          return (
            <PressableScale
              contentStyle={s.row}
              onPress={() => {
                noteSearch();
                navigation.navigate('CollectionDetail', { slug: item.collection.slug });
              }}
            >
              <Card style={s.card}>
                {item.cover
                  ? <Image source={{ uri: item.cover }} style={s.thumb} contentFit="cover" transition={200} />
                  : <View style={s.thumb} />}
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={s.cardTitle} numberOfLines={2}>
                    {t(item.collection.title_en, item.collection.title_vi, item.collection.title_ja)}
                  </Text>
                  <Text style={s.cardMeta}>
                    {item.count} {t(item.count === 1 ? 'place' : 'places', 'địa điểm', 'スポット', '个地点', '個地點')}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={17} color={colors.textTertiary} />
              </Card>
            </PressableScale>
          );
        }}
        // The end of a search that found nothing, and the end of one that
        // found the wrong things, are the same dead end — and until now
        // both of them ended here, with the app reporting the absence and
        // offering no way through it. Explore has had that way out since
        // it got a footer; this screen, which is where someone goes when
        // they have a specific place in mind, did not.
        //
        // Nothing at all: the offer belongs in the empty state, because
        // the empty state is the whole screen. Something, but not the
        // right thing: the offer goes under the results by the same rule
        // Explore uses — reaching the end is the moment you have seen
        // everything there is, and it is the only honest moment to say
        // "then let us go and find it".
        ListEmptyComponent={
          searching && elsewhere
            ? (
              <>
                <NoMatches term={shown} where={pick === 'all' ? null : pick.map(cityName).filter(Boolean).join(', ')} />
                {addRow}
                {googleEmpty}
              </>
            )
          : searching
            ? (
              <>
                <NoMatches term={shown} />
                {addRow}
                {googleEmpty}
                {/* Under the Google row, not above it: the primary door
                    stays primary, and the fork is the "or try" it reads
                    as. Rendered after the not-found note too, so the
                    chips survive Google coming back empty-handed — that
                    is the moment they matter most. */}
                <Fork
                  routes={routes}
                  onSearch={setQuery}
                  onBack={() => navigation.goBack()}
                  toList={adding}
                />
              </>
            )
            // Reached only while the catalog is still loading, or in a
            // city with nothing in it yet: with places come chips and a
            // ranking, and with either the zero-state rows exist instead.
            : <Empty text={t(
                'Try a name, a neighbourhood, or a vibe — cafés, museums, rooftops.',
                'Thử tên quán, tên khu, hay một kiểu vibe — cà phê, bảo tàng, rooftop.',
                '名前・エリア・雰囲気で検索 — カフェ、博物館、ルーフトップ。',
                '试试名称、街区或氛围 — 咖啡馆、博物馆、天台。', '試試名稱、街區或氛圍 — 咖啡館、博物館、頂樓。',
              )} />
        }
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

/**
 * The end of a search that found nothing.
 *
 * It used to be one grey sentence, then a sentence with worked examples
 * baked into the copy. The examples have moved out of the prose and into
 * the `Fork` chips below, where they are tappable and derived from the
 * query itself — so the sentence here contracts to the one fact left to
 * state: the catalog has not got this, yet. "Yet" is load-bearing; the
 * row directly underneath offers to go and fetch it.
 */
function NoMatches({ term, where }: { term: string; where?: string | null }) {
  const { t } = useI18n();
  return (
    <View style={s.noneBox}>
      <View style={s.noneMark}>
        <Ionicons name="search" size={30} color={colors.textTertiary} />
        {/* The question mark is the whole difference between "we are
            looking" and "we looked". A magnifier alone is what a screen
            shows while it is still searching. */}
        <View style={s.noneBadge}>
          <Text style={s.noneBadgeText}>?</Text>
        </View>
      </View>
      {/* Found in another city: said as "not here", with the chips above
          for "there", rather than as "not anywhere". */}
      <Text style={s.noneTitle}>
        {where
          ? t(`No matches for “${term}” in ${where}`, `Không có kết quả cho “${term}” ở ${where}`, `${where}に「${term}」の一致なし`, `${where}没有与“${term}”匹配的结果`, `${where}沒有與「${term}」相符的結果`)
          : t(`No matches for “${term}”`, `Không có kết quả cho “${term}”`, `「${term}」に一致なし`, `没有与“${term}”匹配的结果`, `沒有與「${term}」相符的結果`)}
      </Text>
      <Text style={s.noneHint}>
        {where
          ? t('Other cities have it: choose one above.', 'Có ở thành phố khác: chọn ở trên.', '他の都市にあります。上で選んでください。', '其他城市有：请在上方选择。', '其他城市有：請在上方選擇。')
          : t('Not in City Crew yet.', 'Chưa có trong City Crew.', 'City Crew にはまだありません。', 'City Crew 里还没有。', 'City Crew 裡還沒有。')}
      </Text>
    </View>
  );
}

/**
 * The fork out of a dead end: what the failed query *did* contain.
 *
 * "Pizza 4P's Thảo Điền" finding nothing still told the app two true
 * things — a part of town and a kind of place — and each becomes a chip
 * that re-runs the search with just that part. Re-running rather than
 * navigating is the design: the box refills with the working query, so
 * the reader sees *why* the chip worked and learns the shape of a query
 * that succeeds. A jump to another screen would fix this search and
 * teach nothing.
 *
 * "Back to Places" is always last: the fork must never be a cul-de-sac,
 * and someone whose query held nothing recognisable still deserves a
 * door that is not the keyboard.
 */
function Fork({ routes, onSearch, onBack, toList }: {
  routes: ReturnType<typeof escapeRoutes>;
  onSearch: (q: string) => void;
  onBack: () => void;
  /** Opened from a list, back is to the list, and says so. */
  toList: boolean;
}) {
  const { t } = useI18n();
  return (
    <View style={s.forkBox}>
      <Text style={s.forkLabel}>{t('OR TRY', 'HOẶC THỬ', 'または', '或者试试', '或者試試')}</Text>
      <View style={s.forkRow}>
        {routes.map((r) => {
          if (r.kind === 'area') {
            const name = t(r.en, r.vi, r.ja);
            return (
              <ForkChip
                key={`a-${r.en}`}
                icon="location-outline"
                label={t(`Browse ${r.en}`, `Xem quanh ${r.vi}`, `${r.ja}を見る`, `浏览${r.en}`, `瀏覽${r.en}`)}
                onPress={() => onSearch(name)}
              />
            );
          }
          const cat = CATEGORIES[r.key];
          return (
            <ForkChip
              key={`c-${r.key}`}
              icon={cat.icon}
              label={t(`All ${cat.en}`, `Tất cả ${cat.vi}`, `${cat.ja}すべて`, `全部${cat.zh}`, `全部${cat.zh}`)}
              onPress={() => onSearch(t(cat.en, cat.vi, cat.ja, cat.zh, cat.hant))}
            />
          );
        })}
        <ForkChip
          icon={toList ? 'albums-outline' : 'compass-outline'}
          label={toList
            ? t('Back to the list', 'Về bộ sưu tập', 'コレクションに戻る', '返回合集', '返回合集')
            : t('Back to Places', 'Về Địa điểm', 'スポットに戻る', '返回地点', '返回地點')}
          onPress={onBack}
        />
      </View>
    </View>
  );
}

function ForkChip({ icon, label, onPress }: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
}) {
  return (
    <PressableScale onPress={onPress} haptic="selection" accessibilityRole="button">
      <View style={s.forkChip}>
        <Ionicons name={icon} size={15} color={colors.accent} />
        <Text style={s.forkChipText} numberOfLines={1}>{label}</Text>
      </View>
    </PressableScale>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: space.page, paddingTop: 8, paddingBottom: 14,
  },
  // The cities' row, under the box. `UnderlineChoice` brings the page's
  // margins; this is the air between it and the list. It used to be a
  // horizontal ScrollView of its own, the list's sibling in the screen's
  // column, and grew by default (React Native's `baseHorizontal` is
  // flexGrow 1): with a short list the two split the empty height, and
  // "boat" set its one card a third of the screen below the chips. The
  // row's ScrollView now sits inside this View, which does not grow.
  citiesRow: { flexGrow: 0, paddingBottom: 12 },
  // Under the box, on the page's margin, before the chips. The pill is
  // `Chip`'s glass and padding (its chipOn), sized to its words
  // and stopped at the margin, where a long name ends in "…".
  addingToRow: { paddingHorizontal: space.page, paddingBottom: 12, flexDirection: 'row' },
  addingTo: {
    flexDirection: 'row', alignItems: 'center', gap: 7, flexShrink: 1,
    backgroundColor: colors.surfaceGlass,
    borderWidth: 1, borderColor: colors.borderGlass, borderRadius: radius.pill,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  addingToText: { flexShrink: 1, color: colors.textSecondary, fontSize: 15 },
  addingToTitle: { color: colors.text, fontWeight: font.semibold },
  addingToCount: { flexShrink: 0, color: colors.textSecondary, fontSize: 15, marginLeft: -3 },

  section: {
    color: colors.text, ...type.section,
    paddingHorizontal: space.page, marginTop: 10, marginBottom: space.headingToContent,
  },

  // ── the zero-state ──
  // Small caps rather than the 22pt section face: these are shelf labels
  // over a resting screen, not headings over results the reader asked
  // for, and three of them at full section weight would shout over a
  // page that is meant to feel idle.
  eyebrowRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: space.page, marginTop: 18, marginBottom: 10,
  },
  eyebrow: {
    color: colors.textTertiary, fontSize: 13, fontWeight: font.semibold,
    letterSpacing: 1.1, textTransform: 'uppercase',
  },
  clear: { color: colors.accent, fontSize: 14, fontWeight: font.semibold },
  recentRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: space.page,
  },
  // The words' button takes the row's height, so the tap target is the
  // same band it was when the whole row was one button.
  recentHit: { flex: 1 },
  recentMain: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  recentTerm: { flex: 1, color: colors.text, fontSize: 16 },
  // The row brings the page's margins itself, to scroll under them.
  browseRow: { marginBottom: 4 },
  row: { marginHorizontal: space.page, marginBottom: space.cardGap },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: space.cardPadding,
    padding: space.cardPadding,
  },
  thumb: {
    width: 64, height: 64, borderRadius: radius.image,
    backgroundColor: colors.surfaceGlass,
  },
  cardTitle: { color: colors.text, ...type.cardTitle },
  noneBox: { alignItems: 'center', paddingTop: 34, paddingHorizontal: space.page },
  noneMark: {
    width: 76, height: 76, borderRadius: 38,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surfaceGlass,
  },
  // Sat on the rim rather than inside, so the magnifier stays a magnifier
  // and the badge reads as a note about it.
  noneBadge: {
    position: 'absolute', right: -2, bottom: -2,
    width: 26, height: 26, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.bgElevated,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderGlassSoft,
  },
  noneBadgeText: { color: colors.accent, fontSize: 15, fontWeight: font.semibold, lineHeight: 18 },
  noneTitle: {
    color: colors.text, fontSize: 19, fontWeight: font.semibold,
    textAlign: 'center', marginTop: 18,
  },
  noneHint: {
    color: colors.textTertiary, fontSize: 15, lineHeight: 21,
    textAlign: 'center', marginTop: 8, marginBottom: 4,
  },

  nothing: {
    color: colors.textSecondary, ...type.meta, lineHeight: 22,
    paddingHorizontal: space.page, paddingTop: 18, paddingBottom: 6, textAlign: 'center',
  },
  cardMeta: { color: colors.textTertiary, ...type.meta },
  // The same 4pt the pin keeps from the district on PlaceCard.
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  // The right edge: a gold mark, the number, and its count a size down
  // in the secondary colour, as PlaceCard sets them. Same gold the photo
  // overlay uses, so a star means one thing everywhere.
  rowRating: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rowStar: { color: onPhoto.star, fontSize: 13 },
  rowRatingValue: { color: colors.text, fontSize: 15, fontWeight: font.semibold },
  rowRatingCount: { color: colors.textSecondary, fontSize: 13, fontWeight: font.regular },

  // The fork wears the app's glass pills — the same face the vibe chips
  // and the save button have — because it is an offer, not a result. The
  // eyebrow label is the reference mockup's "OR TRY": small caps, quiet,
  // clearly a heading over choices rather than a sentence.
  forkBox: { paddingHorizontal: space.page, marginTop: 26 },
  forkLabel: {
    color: colors.textTertiary, fontSize: 12, fontWeight: font.semibold,
    letterSpacing: 1.2, marginBottom: 10,
  },
  forkRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  forkChip: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: colors.surfaceGlass, borderWidth: 1,
    borderColor: colors.borderGlassSoft, borderRadius: radius.pill,
    paddingHorizontal: 14, paddingVertical: 9,
  },
  forkChipText: { color: colors.text, fontSize: 14, fontWeight: font.medium },
});
