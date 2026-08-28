// Search — type-to-filter across the current city's catalog.
//
// The catalog is small enough to live in memory, so filtering runs
// client-side over what usePlaces()/useCollections() already loaded:
// instant, no extra queries, and it matches without diacritics so
// "banh mi" finds "Bánh mì Huỳnh Hoa".

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import PlaceCard from '../components/PlaceCard';
import { AddSlot } from '../components/add';
import AddBatchBar, { batchBarShown } from '../components/AddBatchBar';
import CandidateRow from '../components/CandidateRow';
import {
  AmbientWarmth, BackButton, Card, Chip, Empty, PressableScale, useTabBarClearance,
} from '../components/ui';
import {
  Collection, coverOf, isLive, membersOf, Place, touchesCity,
} from '../lib/data';
import { CATEGORIES, CATEGORY_ORDER, categoriesOf, categoryLabel } from '../lib/categories';
import { useCity } from '../lib/city';
import { freshOnly, useCandidates } from '../lib/candidates';
import { escapeRoutes } from '../lib/deadend';
import { openFragment, openState } from '../lib/format';
import type { Candidate } from '../lib/suggest';
import { useCollections, useLikes, usePlaces, useSearchTerms } from '../lib/catalog';
import { parseRecents, RECENTS_KEY, RECENTS_SHOWN, rememberSearch } from '../lib/recents';
import { newestPlaces } from '../lib/newest';
import { openNowPlaces } from '../lib/opennow';
import { rankPopular } from '../lib/popular';
import { collectionMatches, findPlaces, queryTerms } from '../lib/search';
import { useI18n } from '../lib/i18n';
import { colors, font, onPhoto, radius, space, type } from '../theme';
import type { Nav } from '../nav';

type Row =
  | { kind: 'header'; key: string; label: string }
  | { kind: 'collection'; key: string; collection: Collection; count: number; cover?: string }
  | { kind: 'place'; key: string; place: Place }
  | { kind: 'candidate'; key: string; candidate: Candidate }
  // The zero-state — what the screen offers before anyone has typed.
  // Small-caps section marks (`eyebrow`), the remembered searches, one
  // row of category chips, and the ranked "most popular" places.
  | { kind: 'eyebrow'; key: string; label: string; clear?: boolean; dot?: boolean }
  | { kind: 'recent'; key: string; term: string }
  | { kind: 'chips'; key: string }
  | { kind: 'popular'; key: string; place: Place }
  // Same row, different question: 'popular' answers "what is good
  // here", 'latest' answers "what just landed". A separate kind rather
  // than a reused one so a place in both sections keys twice without a
  // collision, and so the two lists can ever diverge in rendering
  // without an archaeology dig.
  | { kind: 'latest'; key: string; place: Place }
  // The reference's time-aware section: doors that are open at this
  // minute. Selection lives in lib/opennow; the row renders exactly as
  // its two neighbours do.
  | { kind: 'open'; key: string; place: Place };

export default function SearchScreen({ navigation }: { navigation: Nav }) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const { data: places } = usePlaces();
  const { city } = useCity();
  const cols = useCollections();
  const tabClearance = useTabBarClearance();
  const google = useCandidates();

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
  const inputRef = useRef<TextInput>(null);
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
  const [recents, setRecents] = useState<string[]>([]);
  useEffect(() => {
    AsyncStorage.getItem(RECENTS_KEY)
      .then((raw) => setRecents(parseRecents(raw)))
      .catch(() => {});
  }, []);
  const keepRecents = (next: string[]) => {
    setRecents(next);
    AsyncStorage.setItem(RECENTS_KEY, JSON.stringify(next)).catch(() => {});
  };
  // A search is worth remembering when it *worked* — the reader opened
  // one of its results. Called from every result row's onPress; blank
  // queries no-op inside rememberSearch.
  const noteSearch = () => {
    const next = rememberSearch(recents, query);
    if (next !== recents) keepRecents(next);
  };

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
  const colMembers = useMemo(
    () => cols.data.map((c) => ({ c, members: membersOf(c, places) })),
    [cols.data, places],
  );

  // The zero-state's third section. Ranked over the live catalog only —
  // `usePlaces` includes the reader's own still-pending submissions, and
  // "most popular" must not recommend a place nobody else can open yet.
  // The scoring itself lives in lib/popular; see the essay there.
  const { likes } = useLikes();
  const popular = useMemo(
    () => rankPopular(places.filter(isLive), cols.data, likes),
    [places, cols.data, likes],
  );

  // The zero-state's fourth section: the catalog's newest arrivals, for
  // the reader who already knows this city and opens Search to ask what
  // changed. Live rows only, for the same reason `popular` filters —
  // this must not advertise a place nobody else can open yet. The
  // ordering caveats live with the ranking, in lib/newest.
  const latest = useMemo(() => newestPlaces(places.filter(isLive)), [places]);

  // The doors open at this minute — see lib/opennow. `now` is taken per
  // render and deliberately left out of the deps: recomputing on every
  // keystroke would walk every place's hours to reach the same answer
  // within the same minute, and a screen left open across a closing time
  // corrects itself on its next real render.
  const openNow = useMemo(
    () => openNowPlaces(places.filter(isLive), now),
    [places], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Only categories this city actually has — the same rule the Explore
  // filter row states: a chip never leads to an empty list. Counted over
  // the live catalog for the same reason `popular` is.
  const cats = useMemo<string[]>(() => {
    const present = new Set<string>();
    for (const pl of places.filter(isLive)) for (const c of categoriesOf(pl)) present.add(c);
    return CATEGORY_ORDER.filter((c) => present.has(c));
  }, [places]);

  const terms = useMemo(() => queryTerms(query), [query]);
  // The desk's synonyms, folded onto the app's own. This is what lets
  // "cinema" reach a multiplex whose record never says the word.
  const synonyms = useSearchTerms();

  const rows = useMemo<Row[]>(() => {
    // Before a word is typed the list is the zero-state: the searches
    // this box remembers, the taxonomy to browse, and the places the
    // ranking calls most popular. The moment a term exists, all of it
    // yields to results — the sections below never mix with them.
    if (terms.length === 0) {
      const out: Row[] = [];
      if (recents.length) {
        out.push({ kind: 'eyebrow', key: 'z-recent', label: t('Recent', 'Gần đây', '最近'), clear: true });
        for (const term of recents.slice(0, RECENTS_SHOWN)) {
          out.push({ kind: 'recent', key: `rc-${term}`, term });
        }
      }
      if (cats.length) {
        out.push({ kind: 'eyebrow', key: 'z-browse', label: t('Browse', 'Duyệt theo', 'カテゴリー') });
        out.push({ kind: 'chips', key: 'z-chips' });
      }
      // Above Most popular, because its answer expires first: a ranking
      // holds for weeks, an open door for hours. Skipped entirely when
      // nothing is open — a section titled "open right now" with no rows
      // would read as the city being shut, which 3 a.m. aside it is not.
      if (openNow.length) {
        out.push({
          kind: 'eyebrow', key: 'z-open', dot: true,
          label: t('Open right now', 'Đang mở cửa', '営業中'),
        });
        for (const pl of openNow) out.push({ kind: 'open', key: `on-${pl.slug}`, place: pl });
      }
      if (popular.length) {
        out.push({ kind: 'eyebrow', key: 'z-popular', label: t('Most popular', 'Phổ biến nhất', '人気スポット') });
        for (const pl of popular) out.push({ kind: 'popular', key: `mp-${pl.slug}`, place: pl });
      }
      if (latest.length) {
        out.push({ kind: 'eyebrow', key: 'z-latest', label: t('Recently added', 'Mới thêm gần đây', '新着スポット') });
        for (const pl of latest) out.push({ kind: 'latest', key: `la-${pl.slug}`, place: pl });
      }
      return out;
    }
    const out: Row[] = [];

    // Same city test as the shelf and the tab. The public query is no
    // longer scoped to a city — a list appears wherever it has a place —
    // so without this, searching in Hanoi would turn up lists that are
    // entirely in Saigon, which nothing else on this screen does.
    const foundCols = colMembers
      // `collectionMatches`, so a list answers by the places inside it
      // too: "mono coffee" finds the café *and* the lists that hold it —
      // the second half of the answer this screen used to leave out.
      .filter(({ c, members }) => touchesCity(members, city?.id) && collectionMatches(c, members, terms));
    if (foundCols.length) {
      out.push({ kind: 'header', key: 'h-col', label: t('Collections', 'Bộ sưu tập', 'コレクション') });
      for (const { c, members } of foundCols) {
        out.push({
          kind: 'collection',
          key: `c-${c.slug}`,
          collection: c,
          count: members.length,
          cover: c.cover?.photo_uri ?? (members[0] && coverOf(members[0])?.photo_uri),
        });
      }
    }

    // Two tiers, and the second only ever appears when the first is empty:
    // a synonym is a guess about what somebody meant, so it fills a blank
    // screen rather than diluting a real answer. See `findPlaces`.
    const { hits, related } = findPlaces(places, query, synonyms);
    if (hits.length) {
      out.push({ kind: 'header', key: 'h-place', label: t('Places', 'Địa điểm', 'スポット') });
      for (const p of hits) out.push({ kind: 'place', key: `p-${p.slug}`, place: p });
    }
    // Labelled as the guess it is. "bowling" reaching a cinema is only
    // wrong when the screen calls it a match — under this heading it is
    // the app saying "not that, but this is the nearest kind we have".
    if (related.length) {
      out.push({
        kind: 'header',
        key: 'h-related',
        label: t(
          'No exact match — related places',
          'Không khớp chính xác — chỗ tương tự',
          '完全一致なし — 近いスポット',
        ),
      });
      for (const p of related) out.push({ kind: 'place', key: `r-${p.slug}`, place: p });
    }

    // Under its own heading, never mixed in. The rows above open a place;
    // these ones propose one that does not exist yet. Two rows that look
    // alike and do different things on tap is the confusion a heading
    // costs one line to prevent.
    if (fresh?.length) {
      out.push({
        kind: 'header',
        key: 'h-google',
        label: t('On Google Maps', 'Trên Google Maps', 'Google マップ上'),
      });
      for (const c of fresh) out.push({ kind: 'candidate', key: `g-${c.place_id}`, candidate: c });
    }
    return out;
  }, [terms, query, places, colMembers, city?.id, fresh, synonyms, t, recents, popular, latest, openNow, cats]);

  const searching = terms.length > 0;
  const showBar = batchBarShown(chosen.length, google.batch);

  // The fork out of a dead end: the part of town and the kind of place
  // hiding inside the failed query, offered as chips. Computed only when
  // the screen is actually empty — on any other frame the answer is
  // thrown away, and this walks the whole catalog.
  const dead = searching && rows.length === 0;
  const routes = useMemo(
    () => (dead ? escapeRoutes(query, places, synonyms) : []),
    [dead, query, places, synonyms],
  );

  // The words go with them. Someone who typed "Cộng Cà Phê" here and found
  // nothing should not have to type it again on the one screen whose whole
  // job is to go and look for it — the tap is the instruction, not the
  // start of a second attempt.
  //
  // Trimmed for the label only — what travels is the whole query.
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
          title={t(`Add “${shown}”`, `Thêm “${shown}”`, `「${shown}」を追加`)}
          subtitle={t(
            'We look it up on Google Maps',
            'Chúng tôi tìm trên Google Maps',
            'Google マップで探します',
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
      )}
    </Text>
  );

  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <AmbientWarmth />
      <View style={s.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <View style={s.field}>
          <Ionicons name="search-outline" size={19} color={colors.textTertiary} />
          <TextInput
            ref={inputRef}
            style={s.input}
            value={query}
            onChangeText={setQuery}
            placeholder={t('Search places and collections', 'Tìm địa điểm và bộ sưu tập', 'スポットやコレクションを検索')}
            placeholderTextColor={colors.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            clearButtonMode="never"
          />
          {query.length > 0 && (
            <PressableScale onPress={() => setQuery('')} scaleTo={0.9} accessibilityLabel="Clear">
              <Ionicons name="close-circle" size={19} color={colors.textTertiary} />
            </PressableScale>
          )}
        </View>
      </View>

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
                {/* The reference's live mark: a small green dot beside
                    "Open right now", the same green the detail screen
                    says "Open now" in — a colour that already means
                    "the doors are open" in this app. */}
                {item.dot ? <View style={s.liveDot} /> : null}
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
                    accessibilityLabel={t('Clear recent searches', 'Xóa tìm kiếm gần đây', '最近の検索を消去')}
                  >
                    <Text style={s.clear}>{t('Clear', 'Xóa', '消去')}</Text>
                  </PressableScale>
                ) : null}
              </View>
            );
          }
          if (item.kind === 'recent') {
            return (
              <PressableScale
                style={s.recentRow}
                scaleTo={0.97}
                onPress={() => setQuery(item.term)}
                accessibilityRole="button"
                accessibilityLabel={item.term}
              >
                <Ionicons name="time-outline" size={18} color={colors.textTertiary} />
                <Text style={s.recentTerm} numberOfLines={1}>{item.term}</Text>
                {/* Two promises on one row, the standard split: the row
                    re-runs the search as typed, the ↗ only lifts the term
                    into the box so it can be edited before it runs. */}
                <PressableScale
                  onPress={() => { setQuery(item.term); inputRef.current?.focus(); }}
                  scaleTo={0.85}
                  hitSlop={{ top: 12, bottom: 12, left: 14, right: 14 }}
                  accessibilityRole="button"
                  accessibilityLabel={t('Edit this search', 'Sửa tìm kiếm này', 'この検索を編集')}
                >
                  <Ionicons
                    name="arrow-up"
                    size={17}
                    color={colors.textTertiary}
                    style={{ transform: [{ rotate: '45deg' }] }}
                  />
                </PressableScale>
              </PressableScale>
            );
          }
          if (item.kind === 'chips') {
            return (
              <View style={s.chipWrap}>
                {cats.map((key) => (
                  /* A chip *is* a search: it types the category's own
                     label into the box, and the haystack — which carries
                     every category's labels in all three languages — does
                     the rest. No second code path, so a chip can never
                     disagree with what typing the same word finds. */
                  <Chip
                    key={key}
                    label={categoryLabel(key, t)}
                    icon={CATEGORIES[key]?.icon}
                    iconColor={CATEGORIES[key]?.color}
                    onPress={() => setQuery(categoryLabel(key, t))}
                  />
                ))}
              </View>
            );
          }
          if (item.kind === 'popular' || item.kind === 'latest' || item.kind === 'open') {
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
            const when = openFragment(openState(pl.opening_hours, now), t);
            const area = t(pl.neighborhood_en, pl.neighborhood_vi, pl.neighborhood_ja);
            const meta = [area, when].filter(Boolean).join(' · ');
            return (
              <PressableScale
                style={s.row}
                onPress={() => navigation.navigate('PlaceDetail', { slug: pl.slug })}
              >
                <Card style={s.card}>
                  {cover
                    ? <Image source={{ uri: cover }} style={s.thumb} contentFit="cover" transition={200} />
                    : <View style={s.thumb} />}
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={s.cardTitle} numberOfLines={1}>
                      {t(pl.name_en, pl.name_vi, pl.name_ja ?? pl.name_en)}
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
                      edge is never simply empty. */}
                  {pl.rating != null
                    ? (
                      <View style={s.rowRating}>
                        <Text style={s.rowStar}>★</Text>
                        <Text style={s.rowRatingValue}>{pl.rating.toFixed(1)}</Text>
                      </View>
                    )
                    : <Ionicons name="chevron-forward" size={17} color={colors.textTertiary} />}
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
              style={s.row}
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
                    {item.count} {t(item.count === 1 ? 'place' : 'places', 'địa điểm', 'スポット')}
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
          searching
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
                  onExplore={() => navigation.goBack()}
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
              )} />
        }
        // Only while searching: before a word is typed the list holds the
        // zero-state, and offering to go and add a place would be
        // answering a question nobody asked.
        ListFooterComponent={searching && rows.length > 0
          ? <>{addRow}{googleEmpty}</>
          : null}
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
        onAdd={() => { if (chosen.length) google.addMany(chosen); }}
        onCancel={google.cancel}
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
function NoMatches({ term }: { term: string }) {
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
      <Text style={s.noneTitle}>
        {t(`No matches for “${term}”`, `Không có kết quả cho “${term}”`, `「${term}」に一致なし`)}
      </Text>
      <Text style={s.noneHint}>
        {t('Not in City Crew yet.', 'Chưa có trong City Crew.', 'City Crew にはまだありません。')}
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
 * "Back to Explore" is always last: the fork must never be a cul-de-sac,
 * and someone whose query held nothing recognisable still deserves a
 * door that is not the keyboard.
 */
function Fork({ routes, onSearch, onExplore }: {
  routes: ReturnType<typeof escapeRoutes>;
  onSearch: (q: string) => void;
  onExplore: () => void;
}) {
  const { t } = useI18n();
  return (
    <View style={s.forkBox}>
      <Text style={s.forkLabel}>{t('OR TRY', 'HOẶC THỬ', 'または')}</Text>
      <View style={s.forkRow}>
        {routes.map((r) => {
          if (r.kind === 'area') {
            const name = t(r.en, r.vi, r.ja);
            return (
              <ForkChip
                key={`a-${r.en}`}
                icon="location-outline"
                label={t(`Browse ${r.en}`, `Xem quanh ${r.vi}`, `${r.ja}を見る`)}
                onPress={() => onSearch(name)}
              />
            );
          }
          const cat = CATEGORIES[r.key];
          return (
            <ForkChip
              key={`c-${r.key}`}
              icon={cat.icon}
              label={t(`All ${cat.en}`, `Tất cả ${cat.vi}`, `${cat.ja}すべて`)}
              onPress={() => onSearch(t(cat.en, cat.vi, cat.ja))}
            />
          );
        })}
        <ForkChip
          icon="compass-outline"
          label={t('Back to Explore', 'Về Khám phá', '探索に戻る')}
          onPress={onExplore}
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
  field: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.surfaceCard, borderWidth: 1, borderColor: colors.borderGlassSoft,
    borderRadius: radius.pill, paddingHorizontal: 16, height: 44,
  },
  input: { flex: 1, color: colors.text, fontSize: 15.5, padding: 0 },

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
    color: colors.textTertiary, fontSize: 12.5, fontWeight: font.semibold,
    letterSpacing: 1.1, textTransform: 'uppercase',
  },
  clear: { color: colors.accent, fontSize: 13.5, fontWeight: font.semibold },
  recentRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: space.page, paddingVertical: 11,
  },
  recentTerm: { flex: 1, color: colors.text, fontSize: 15.5 },
  // The shared Chip carries its own right margin; the wrap only owes the
  // vertical rhythm between lines.
  chipWrap: {
    flexDirection: 'row', flexWrap: 'wrap', rowGap: 10,
    paddingHorizontal: space.page, marginBottom: 4,
  },
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
    color: colors.textTertiary, fontSize: 14.5, lineHeight: 21,
    textAlign: 'center', marginTop: 8, marginBottom: 4,
  },

  nothing: {
    color: colors.textSecondary, ...type.meta, lineHeight: 22,
    paddingHorizontal: space.page, paddingTop: 18, paddingBottom: 6, textAlign: 'center',
  },
  cardMeta: { color: colors.textTertiary, ...type.meta },
  // The same 4pt the pin keeps from the district on PlaceCard.
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  // The reference's right edge: a gold mark and the number, nothing
  // else — the count stays on the detail screen. Same gold the photo
  // overlay uses, so a star means one thing everywhere.
  rowRating: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  liveDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: colors.ok },
  rowStar: { color: onPhoto.star, fontSize: 13 },
  rowRatingValue: { color: colors.text, fontSize: 14.5, fontWeight: font.semibold },

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
