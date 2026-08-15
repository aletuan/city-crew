// Add a place: find the real business, and we fetch the rest.
//
// The screen is a search field and a list, and that is the design rather
// than a simplification of it. There is no field for a name, a photo or
// an address, because what a visitor contributes here is a *pointer* — the
// place itself arrives from Google with its rating, its price band, its
// opening hours and its photographs, exactly as it does when the desk
// imports one. A typed-in place would land in the same list as a card with
// six photographs and 669 reviews, as a name in an empty frame.
//
// No map. That decision is still open — an interactive Google map needs
// the native SDK and therefore a development build, which would take this
// screen out of Expo Go entirely. The list is what gets tapped; the map in
// the mockup shows roughly where three results are and is not how the
// screen is used. See issue #146.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, Keyboard, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AmbientWarmth, BackButton, PressableScale, useTabBarClearance } from '../components/ui';
import { useAuth } from '../lib/auth';
import { useCity } from '../lib/city';
import { usePlaces } from '../lib/catalog';
import { useI18n } from '../lib/i18n';
import {
  Candidate, knownByPlaceId, Known, searchPlaces, suggestPlace,
} from '../lib/suggest';
import { colors, font, radius, space, type } from '../theme';
import type { Nav, RootRoute } from '../nav';

/**
 * One result, in whichever of its three states it is in.
 *
 * The "already here" row is the one worth having. Somebody who could not
 * find a place by scrolling and reached for Add most often wants a place
 * that **is already there** — and this hands it to them with a way to open
 * it, rather than telling them they have made a duplicate.
 */
function Row({ c, known, busy, onAdd, onOpen }: {
  c: Candidate;
  known: Known;
  busy: boolean;
  onAdd: () => void;
  onOpen: (slug: string) => void;
}) {
  const { t } = useI18n();
  const live = known.state === 'live';
  const mine = known.state === 'mine';

  return (
    <View style={[s.row, live && s.rowLive]}>
      <View style={[s.pin, live && s.pinLive]}>
        <Ionicons
          name={live || mine ? 'checkmark' : 'location-outline'}
          size={18}
          color={live ? colors.ok : mine ? colors.textSecondary : colors.accent}
        />
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={s.name} numberOfLines={1}>{c.name}</Text>
        <Text style={[s.sub, live && s.subLive]} numberOfLines={1}>
          {live
            ? t('Already on cityCrew', 'Đã có trên cityCrew', 'すでに cityCrew にあります')
            : mine
              ? t('You suggested this — awaiting review', 'Bạn đã đề xuất — đang chờ duyệt', '提案済み — 審査待ち')
              : c.address}
        </Text>
      </View>

      {live ? (
        <PressableScale onPress={() => onOpen(known.slug)} scaleTo={0.94} style={s.viewBtn}>
          <Text style={s.viewText}>{t('View', 'Xem', '見る')}</Text>
        </PressableScale>
      ) : mine ? null : busy ? (
        <ActivityIndicator color={colors.accent} />
      ) : (
        <PressableScale onPress={onAdd} scaleTo={0.9} style={s.addBtn} accessibilityRole="button">
          <Ionicons name="add" size={22} color={colors.accentInk} />
        </PressableScale>
      )}
    </View>
  );
}

export default function AddPlaceScreen({ navigation, route }: { navigation: Nav; route: RootRoute<'AddPlace'> }) {
  const { t } = useI18n();
  const { city } = useCity();
  const { session } = useAuth();
  const meId = session?.user?.id;
  const places = usePlaces();
  const tabClearance = useTabBarClearance();

  const [query, setQuery] = useState(route.params?.query ?? '');
  const [results, setResults] = useState<Candidate[] | null>(null);
  const [known, setKnown] = useState<Record<string, Known>>({});
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const input = useRef<TextInput>(null);

  const cityName = city ? t(city.short_en, city.short_vi, city.short_ja) : '';

  const run = useCallback(() => {
    const q = query.trim();
    if (!q || !city || searching) return;
    Keyboard.dismiss();
    setSearching(true);
    setResults(null);
    searchPlaces(q, city.id)
      .then((found) => {
        setResults(found);
        // Best effort, and deliberately not awaited: a failed duplicate
        // check should leave every row looking new rather than take the
        // search results down with it. The function still refuses a
        // duplicate either way.
        knownByPlaceId(found.map((c) => c.place_id), meId).then(setKnown).catch(() => {});
      })
      .catch((e: Error) => Alert.alert(t('Search failed', 'Tìm kiếm thất bại', '検索に失敗しました'), e.message))
      .finally(() => setSearching(false));
  }, [query, city?.id, searching, meId, t]);

  /**
   * Arrived from Search with the words already typed.
   *
   * Search has just told this person their words match nothing, and they
   * tapped the row that says "let us look it up". Landing on a field
   * holding their query and waiting to be told to search again would be
   * asking for the same thing twice — the tap *was* the instruction.
   *
   * Once, and only once the city is known: `run` refuses without one, so
   * firing during the city bootstrap would do nothing and never retry.
   */
  const pending = useRef(!!route.params?.query);
  useEffect(() => {
    if (!pending.current || !city) return;
    pending.current = false;
    run();
  }, [city?.id, run]);

  const add = (c: Candidate) => {
    if (!city || adding) return;
    setAdding(c.place_id);
    suggestPlace(c.place_id, city.id)
      .then((out) => {
        if (out.ok) {
          // Marked here rather than re-searched: the row changes state in
          // place, so adding several from one search does not mean
          // starting the search again after each.
          setKnown((k) => ({ ...k, [c.place_id]: { state: 'mine' } }));
          places.reload();
          Alert.alert(
            t('Thanks — it is in', 'Cảm ơn — đã nhận', 'ありがとうございます'),
            t(
              `${c.name} is on your Explore now. Suggestions are reviewed before they go live, so nobody else can see it yet.`,
              `${c.name} đã có trong mục Khám phá của bạn. Đề xuất sẽ được xem xét trước khi hiển thị, nên hiện chưa ai khác thấy được.`,
              `${c.name} はあなたの探索に表示されます。公開前に審査があるため、まだ他の人には見えません。`,
            ),
          );
          return;
        }
        if (out.reason === 'already_live') {
          setKnown((k) => ({ ...k, [c.place_id]: { state: 'live', slug: out.slug } }));
          return;
        }
        if (out.reason === 'already_known') {
          // Somebody else got there first, and whose suggestion it is is
          // not this reader's business — so the row says the place is
          // known, and stops.
          setKnown((k) => ({ ...k, [c.place_id]: { state: 'mine' } }));
          return;
        }
        Alert.alert(
          out.reason === 'daily_limit'
            ? t('That is enough for today', 'Hôm nay vậy là đủ', '本日はここまで')
            : t('Could not add it', 'Không thêm được', '追加できませんでした'),
          out.reason === 'daily_limit'
            ? t(
              `You can suggest ${out.limit} places a day. Come back tomorrow.`,
              `Mỗi ngày bạn có thể đề xuất ${out.limit} địa điểm. Mai quay lại nhé.`,
              `1日に${out.limit}件まで提案できます。また明日どうぞ。`,
            )
            : out.message,
        );
      })
      .finally(() => setAdding(null));
  };

  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <AmbientWarmth />
      <View style={s.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={s.title}>{t('Add a place', 'Thêm địa điểm', 'スポットを追加')}</Text>
      </View>

      <View style={s.field}>
        <Ionicons name="search" size={19} color={colors.textTertiary} />
        <TextInput
          ref={input}
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={run}
          returnKeyType="search"
          // Not when the query arrived with us: the search is already
          // running, and a keyboard that opens only to be dismissed a
          // moment later is motion for nothing.
          autoFocus={!route.params?.query}
          placeholder={t(
            `Name of a place in ${cityName}`,
            `Tên một địa điểm ở ${cityName}`,
            `${cityName}のスポット名`,
          )}
          placeholderTextColor={colors.textTertiary}
          style={s.input}
        />
        {query.length > 0 && (
          <PressableScale onPress={() => { setQuery(''); setResults(null); input.current?.focus(); }} scaleTo={0.9} hitSlop={8}>
            <Ionicons name="close-circle" size={19} color={colors.textTertiary} />
          </PressableScale>
        )}
      </View>

      {searching && <ActivityIndicator color={colors.accent} style={{ marginTop: 36 }} />}

      <FlatList
        data={results ?? []}
        keyExtractor={(c) => c.place_id}
        renderItem={({ item }) => (
          <Row
            c={item}
            known={known[item.place_id] ?? { state: 'none' }}
            busy={adding === item.place_id}
            onAdd={() => add(item)}
            onOpen={(slug) => navigation.navigate('PlaceDetail', { slug })}
          />
        )}
        ListEmptyComponent={!searching && results?.length === 0
          ? (
            <Text style={s.nothing}>
              {t(
                'Nothing found. Try the name as it appears on the door.',
                'Không tìm thấy. Thử tên đúng như trên biển hiệu xem sao.',
                '見つかりません。看板どおりの名前で試してください。',
              )}
            </Text>
          )
          : null}
        ListFooterComponent={results?.length
          ? (
            // Google requires the attribution wherever its results are
            // shown, and it is also the honest answer to "where did these
            // come from" — the same reason photo credits ride the cards.
            <Text style={s.credit}>
              {t(
                `Results from Google Maps · ${cityName}`,
                `Kết quả từ Google Maps · ${cityName}`,
                `Google マップの結果 · ${cityName}`,
              )}
            </Text>
          )
          : null}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingTop: 8, paddingBottom: tabClearance }}
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
  title: { color: colors.text, ...type.titleDetail },

  field: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: space.page, marginBottom: 14,
    paddingHorizontal: 14, height: 48,
    borderRadius: radius.input,
    backgroundColor: colors.surfaceCard,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderGlassSoft,
  },
  input: { flex: 1, color: colors.text, fontSize: 16, padding: 0 },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    marginHorizontal: space.page, marginBottom: space.cardGap,
    padding: 14,
    borderRadius: radius.card,
    backgroundColor: colors.surfaceCard,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderGlassSoft,
  },
  // A wash of the same green the "public" state uses, so "already here" is
  // good news in the colour good news is told in everywhere else.
  rowLive: { backgroundColor: colors.okSoft },

  pin: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.accentSoft,
  },
  pinLive: { backgroundColor: colors.surfaceGlass },

  name: { color: colors.text, fontSize: 16, fontWeight: font.semibold },
  sub: { color: colors.textTertiary, fontSize: 13.5 },
  subLive: { color: colors.ok, fontWeight: font.medium },

  addBtn: {
    width: 36, height: 36, borderRadius: 999,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  viewBtn: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceCard,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderGlassSoft,
  },
  viewText: { color: colors.text, fontSize: 14, fontWeight: font.semibold },

  nothing: {
    color: colors.textSecondary, ...type.meta, lineHeight: 22,
    paddingHorizontal: space.page, paddingTop: 24, textAlign: 'center',
  },
  credit: {
    color: colors.textTertiary, fontSize: 12.5,
    paddingHorizontal: space.page, paddingTop: 6, textAlign: 'center',
  },
});
