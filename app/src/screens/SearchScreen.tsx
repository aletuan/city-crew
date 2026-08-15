// Search — type-to-filter across the current city's catalog.
//
// The catalog is small enough to live in memory, so filtering runs
// client-side over what usePlaces()/useCollections() already loaded:
// instant, no extra queries, and it matches without diacritics so
// "banh mi" finds "Bánh mì Huỳnh Hoa".

import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import PlaceCard from '../components/PlaceCard';
import { AddSlot } from '../components/add';
import CandidateRow from '../components/CandidateRow';
import {
  AmbientWarmth, BackButton, Card, Empty, PressableScale, useTabBarClearance,
} from '../components/ui';
import { CATEGORIES, categoriesOf } from '../lib/categories';
import { Collection, coverOf, membersOf, Place, touchesCity } from '../lib/data';
import { useCity } from '../lib/city';
import { freshOnly, useCandidates } from '../lib/candidates';
import type { Candidate } from '../lib/suggest';
import { useCollections, usePlaces } from '../lib/catalog';
import { useI18n } from '../lib/i18n';
import { colors, font, radius, space, type } from '../theme';
import type { Nav } from '../nav';

/** Lowercase, diacritics stripped, đ folded — the shape we match on. */
function fold(s: string | null | undefined): string {
  return (s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase();
}

function placeHaystack(p: Place): string {
  return fold([
    p.name_en, p.name_vi, p.name_ja,
    p.neighborhood_en, p.neighborhood_vi, p.neighborhood_ja,
    p.desc_en, p.desc_vi, p.desc_ja,
    p.vibe_tags.join(' '),
    // Category keys plus their labels in every language, so "bảo tàng"
    // and "heritage" both reach the same places.
    categoriesOf(p).flatMap((c) => {
      const cat = CATEGORIES[c];
      return cat ? [c, cat.en, cat.vi, cat.ja] : [c];
    }).join(' '),
    p.address,
  ].join(' '));
}

function collectionHaystack(c: Collection): string {
  return fold([
    c.title_en, c.title_vi, c.title_ja,
    c.desc_en, c.desc_vi, c.desc_ja, c.curator_handle,
  ].join(' '));
}

/** Every word must appear somewhere — "cafe saigon" narrows, not widens. */
function matches(haystack: string, terms: string[]): boolean {
  return terms.every((term) => haystack.includes(term));
}

type Row =
  | { kind: 'header'; key: string; label: string }
  | { kind: 'collection'; key: string; collection: Collection; count: number; cover?: string }
  | { kind: 'place'; key: string; place: Place }
  | { kind: 'candidate'; key: string; candidate: Candidate };

export default function SearchScreen({ navigation }: { navigation: Nav }) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const { data: places } = usePlaces();
  const { city } = useCity();
  const cols = useCollections();
  const tabClearance = useTabBarClearance();
  const google = useCandidates();

  // Cleared whenever the words change: a Google section answering the
  // previous query, sitting under results for this one, would be the
  // screen quietly lying about what it went and asked.
  useEffect(() => { google.clear(); }, [query]); // eslint-disable-line react-hooks/exhaustive-deps

  // Only what the catalog has never heard of. Everything else in that list
  // this screen has already shown, or deliberately not shown, above.
  //
  // Memoised because `rows` below depends on it, and a fresh array every
  // render would make that memo recompute the whole catalog filter on
  // every keystroke — which is the one thing this screen is built not to
  // do.
  const fresh = useMemo(
    () => (google.results ? freshOnly(google.results, google.known) : null),
    [google.results, google.known],
  );

  const terms = useMemo(
    () => fold(query).split(/\s+/).filter(Boolean),
    [query],
  );

  const rows = useMemo<Row[]>(() => {
    if (terms.length === 0) return [];
    const out: Row[] = [];

    // Same city test as the shelf and the tab. The public query is no
    // longer scoped to a city — a list appears wherever it has a place —
    // so without this, searching in Hanoi would turn up lists that are
    // entirely in Saigon, which nothing else on this screen does.
    const foundCols = cols.data
      .map((c) => ({ c, members: membersOf(c, places) }))
      .filter(({ c, members }) => touchesCity(members, city?.id) && matches(collectionHaystack(c), terms));
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

    const foundPlaces = places.filter((p) => matches(placeHaystack(p), terms));
    if (foundPlaces.length) {
      out.push({ kind: 'header', key: 'h-place', label: t('Places', 'Địa điểm', 'スポット') });
      for (const p of foundPlaces) out.push({ kind: 'place', key: `p-${p.slug}`, place: p });
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
  }, [terms, places, cols.data, city?.id, fresh, t]);

  const searching = terms.length > 0;

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
            style={s.input}
            value={query}
            onChangeText={setQuery}
            placeholder={t('Search places and collections', 'Tìm địa điểm và bộ sưu tập', 'スポットやコレクションを検索')}
            placeholderTextColor={colors.textTertiary}
            autoFocus
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
          if (item.kind === 'header') return <Text style={s.section}>{item.label}</Text>;
          if (item.kind === 'candidate') {
            return (
              <CandidateRow
                c={item.candidate}
                known={google.known[item.candidate.place_id] ?? { state: 'none' }}
                busy={google.adding === item.candidate.place_id}
                away={google.awayFrom(item.candidate)}
                onAdd={() => google.add(item.candidate)}
                onOpen={(slug) => navigation.navigate('PlaceDetail', { slug })}
              />
            );
          }
          if (item.kind === 'place') {
            return (
              <PlaceCard
                place={item.place}
                onPress={() => navigation.navigate('PlaceDetail', { slug: item.place.slug })}
              />
            );
          }
          return (
            <PressableScale
              style={s.row}
              onPress={() => navigation.navigate('CollectionDetail', { slug: item.collection.slug })}
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
                    {item.count} {t('places', 'địa điểm', 'スポット')}
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
                <Empty text={t(
                  `Nothing found for “${query.trim()}”.`,
                  `Không tìm thấy gì cho “${query.trim()}”.`,
                  `「${query.trim()}」に一致するものはありません。`,
                )} />
                {addRow}
                {googleEmpty}
              </>
            )
            : <Empty text={t(
                'Try a name, a neighbourhood, or a vibe — cafés, museums, rooftops.',
                'Thử tên quán, tên khu, hay một kiểu vibe — cà phê, bảo tàng, rooftop.',
                '名前・エリア・雰囲気で検索 — カフェ、博物館、ルーフトップ。',
              )} />
        }
        // Only while searching: before a word is typed the list is empty
        // for a reason that has nothing to do with the catalog, and
        // offering to go and add a place would be answering a question
        // nobody asked.
        ListFooterComponent={searching && rows.length > 0
          ? <>{addRow}{googleEmpty}</>
          : null}
        contentContainerStyle={{ paddingTop: 6, paddingBottom: tabClearance }}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
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
  nothing: {
    color: colors.textSecondary, ...type.meta, lineHeight: 22,
    paddingHorizontal: space.page, paddingTop: 18, paddingBottom: 6, textAlign: 'center',
  },
  cardMeta: { color: colors.textTertiary, ...type.meta },
});
