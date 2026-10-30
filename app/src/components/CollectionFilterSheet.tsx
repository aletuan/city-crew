// The Collections screen's filter, as a sheet from below (owner, 25 Oct
// 2026): Explore's sheet, asked the two questions this screen has — which
// city, which kind of place. They were two rows in the search box's panel;
// the owner moved them out of the search and up beside the title, where
// Explore keeps its own, so the box is for words and the glyph is for
// narrowing, on both screens.
//
// Explore's shape on purpose — the backdrop, the rise, the drag to close,
// the handle, the title with its ✕, the answers drafted and only applied
// by the button that says how many lists they leave, Reset beside it once
// there is something to undo — so a reader who has used one sheet has used
// both. What differs is the questions: one city and one kind, each an
// underline row with "All" first, the rows Explore, this screen's panel
// and the visits panel already narrow with.
//
// Each answer says how many lists it would leave, given the other
// question's draft — "Huế (1)" while no kind is drafted, "Huế (0)" once
// Nightlife is — and an answer that would leave none is dimmed and cannot
// be taken (owner, 25 Oct 2026). Before, the sheet offered every city the
// shelf holds whatever kind was drafted, and the only way to learn that a
// pair held nothing was the button saying "Show 0".
//
// ── many cities (owner, 25 Oct 2026) ──
//
// The row holds every city while there are `CITY_ROW_MAX` or fewer. Past
// that it keeps the `CITY_ROW_KEEP` with the most places on the shelf and
// ends in "More (+N)", which turns the sheet into a city picker — the
// city sheet's own (`CitySwitcher`): a search that folds diacritics, the
// rows A to Z with their figures read down the right edge. The board the
// owner chose from had five ways; this is its third, a row that stays the
// row every filter here is, with its fourth behind it. Chosen and not
// among the kept, a city stands first after "All", so the row always
// shows what it is narrowed to. Several cities at once (the board's
// second and fifth) stay out: the owner took that out of every filter.

import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated, Keyboard, LayoutAnimation, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput,
  useWindowDimensions, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '../lib/i18n';
import { useScheme } from '../lib/theme';
import { bgElevatedHex, colors, display, font, radius, space } from '../theme';
import { fireHaptic, GradientCta, PressableScale, UnderlineChoice, useReducedMotion } from './ui';
import { SLIDE } from './SearchField';
import { useSheetDrag } from './sheetDrag';
import { cityBook } from '../lib/cityBook';

/** Up to this many cities the row holds them all. Agreed with the owner
 *  (25 Oct 2026) with seven on the busiest shelf, so it changes nothing
 *  until the catalog grows; any lower, and today's row would end in a
 *  "+1" or "+2" that hides less than it costs to open. */
export const CITY_ROW_MAX = 8;
/** Past it, how many the row keeps before "More": enough for the cities
 *  most of a shelf is about (Hà Nội, Sài Gòn and Melbourne hold 27 of
 *  the 32 lists today), few enough that "More" is in sight on a phone. */
export const CITY_ROW_KEEP = 5;
/** The key "More" answers to: never a city's. */
const MORE = '__more__';

/** What the sheet narrows by: a city and a kind, each null for all. */
export type CollectionFilters = { city: string | null; kind: string | null };

export default function CollectionFilterSheet({ visible, applied, cities, kinds, countFor, onClose, onApply }: {
  visible: boolean;
  applied: CollectionFilters;
  /** The choices the shelf holds, in the screen's order. A group with
   *  fewer than two is a fact rather than a choice and is not asked. */
  cities: { key: string; label: string; names?: (string | null | undefined)[] }[];
  kinds: { key: string; label: string; icon?: keyof typeof Ionicons.glyphMap }[];
  /** How many lists a draft leaves, for the button. */
  countFor: (f: CollectionFilters) => number;
  onClose: () => void;
  onApply: (f: CollectionFilters) => void;
}) {
  const { t, lang } = useI18n();
  const insets = useSafeAreaInsets();
  const ground = bgElevatedHex[useScheme().scheme];
  const rise = useRef(new Animated.Value(1)).current;
  const { drag, handlers } = useSheetDrag(visible, onClose);
  const [draft, setDraft] = useState(applied);
  // The city picker, when "More" has opened it, and what is typed there.
  const [picking, setPicking] = useState(false);
  const [query, setQuery] = useState('');
  const still = useReducedMotion();
  // Reset arriving or leaving is the one thing that moves; see Explore's.
  const slide = () => { if (!still) LayoutAnimation.configureNext(SLIDE); };

  useEffect(() => {
    if (!visible) { rise.setValue(1); return; }
    setDraft(applied);
    setPicking(false);
    setQuery('');
    Animated.spring(rise, { toValue: 0, useNativeDriver: true, speed: 14, bounciness: 3 }).start();
  }, [visible, applied, rise]);

  const dirty = (f: CollectionFilters) => f.city !== null || f.kind !== null;
  const choose = (next: CollectionFilters) => {
    fireHaptic('selection');
    if (dirty(next) !== dirty(draft)) slide();
    setDraft(next);
  };
  const count = countFor(draft);
  const all = t('All', 'Tất cả', 'すべて', '全部', '全部');
  // Each answer counted against the other question's draft: a city is
  // asked "how many, with this kind?", a kind "how many, in this city?".
  // A shelf is some thirty lists and the questions some sixteen answers,
  // so counting them all on each tap is cheap enough not to remember.
  const cityRow = cities.map((c) => {
    const n = countFor({ city: c.key, kind: draft.kind });
    return { ...c, count: n, off: n === 0 };
  });
  const kindRow = kinds.map((k) => {
    const n = countFor({ city: draft.city, kind: k.key });
    return { ...k, count: n, off: n === 0 };
  });
  // The row as drawn: whole, or cut to the most-held few with the chosen
  // one first and "More" last. `cities` arrives most-held first.
  const cut = cities.length > CITY_ROW_MAX;
  const kept = cut ? cityRow.slice(0, CITY_ROW_KEEP) : cityRow;
  const chosenCity = cut && draft.city && !kept.some((c) => c.key === draft.city)
    ? cityRow.find((c) => c.key === draft.city) : undefined;
  const shownCities = chosenCity ? [chosenCity, ...kept] : kept;
  const rest = cities.length - shownCities.length;
  const cityItems = cut
    ? [...shownCities, { key: MORE, label: `${t('More', 'Khác', 'その他', '更多', '更多')} (+${rest})`, testID: 'collections-filter-cities-more' }]
    : cityRow;

  // ── the picker ──
  //
  // Every name a city answers to, as the city sheet searches them, and
  // A to Z rather than by count: past the row, the reader is looking for
  // a name, not comparing sizes.
  const book = cityBook(cityRow.map((c) => ({ ...c, id: c.key })), {
    recent: [],
    query,
    label: (c) => c.label,
    names: (c) => c.names ?? [c.label],
    folded: lang !== 'ja',
  });
  const pickCity = (id: string | null) => {
    choose({ ...draft, city: id });
    setPicking(false);
    setQuery('');
  };
  // One row of the picker: the city sheet's — the name, its figure down
  // the right edge, the chosen one in the sheet's tint — with this
  // sheet's rule that a city holding nothing under the drafted kind is
  // dimmed and takes no tap, and the chosen one never is.
  const pickRow = (c: { key: string | null; label: string; count: number; off: boolean }) => {
    const on = c.key === draft.city;
    const dim = c.off && !on;
    return (
      <PressableScale
        key={c.key ?? 'all'}
        haptic="selection"
        contentStyle={[s.row, on && s.rowOn, dim && s.rowOff]}
        scaleTo={dim ? 1 : 0.985}
        onPress={() => pickCity(c.key)}
        disabled={dim}
        accessibilityRole="button"
        aria-selected={on}
        testID={`collections-filter-city-${c.key ?? 'all'}`}
      >
        <Text style={[s.rowTitle, on && s.rowTitleOn]} numberOfLines={1}>{c.label}</Text>
        <Text style={[s.count, on && s.rowTitleOn]}>{c.count}</Text>
      </PressableScale>
    );
  };
  // The city sheet's keyboard (`CitySwitcher`): measured, and the sheet
  // stood on it, on iOS only — the search field is at the sheet's foot's
  // mercy otherwise. Android resizes its own window.
  const { height: winH } = useWindowDimensions();
  const [kb, setKb] = useState(0);
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    const up = Keyboard.addListener('keyboardWillShow', (e) => setKb(e.endCoordinates.height));
    const down = Keyboard.addListener('keyboardWillHide', () => setKb(0));
    return () => { up.remove(); down.remove(); };
  }, []);

  // The picker's page: the field, then "All" and the cities, A to Z.
  const picker = (
    <>
      <View style={s.search}>
        <Ionicons name="search" size={17} color={colors.textTertiary} />
        <TextInput
          style={s.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder={t('Search cities…', 'Tìm thành phố…', '都市を検索…', '搜索城市…', '搜尋城市…')}
          placeholderTextColor={colors.textTertiary}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          accessibilityLabel={t('Search cities', 'Tìm thành phố', '都市を検索', '搜索城市', '搜尋城市')}
          testID="collections-filter-city-search"
        />
      </View>
      <ScrollView style={s.list} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} testID="collections-filter-city-list">
        {query.trim() ? null : pickRow({ key: null, label: all, count: countFor({ city: null, kind: draft.kind }), off: false })}
        {book.others.map((c) => pickRow(c))}
        {query.trim() !== '' && book.others.length === 0 && (
          <Text style={s.empty}>
            {t('No city by that name', 'Chưa có thành phố này', 'その名前の都市はありません', '没有这个城市', '沒有這個城市')}
          </Text>
        )}
      </ScrollView>
    </>
  );
  // The sheet's own page: the two questions and the button.
  const questions = (
    <>
      <View style={s.head}>
        <Text style={s.title}>{t('Filters', 'Bộ lọc', 'フィルター', '筛选', '篩選')}</Text>
        <PressableScale
          onPress={onClose}
          testID="collections-filter-close"
          accessibilityRole="button"
          accessibilityLabel={t('Close filters', 'Đóng bộ lọc', 'フィルターを閉じる', '关闭筛选', '關閉篩選')}
          contentStyle={s.close}
        >
          <Ionicons name="close" size={19} color={colors.text} />
        </PressableScale>
      </View>

      {cities.length > 1 ? (
        <>
          <Text style={[s.legend, s.legendFirst]}>{t('City', 'Thành phố', '都市', '城市', '城市')}</Text>
          {/* The sheet's padding taken back, so the row runs to its
              edges and fades into the sheet's own ground. */}
          <View style={s.bleed}>
            <UnderlineChoice
              items={cityItems}
              chosen={draft.city}
              onPick={(id) => (id === MORE ? setPicking(true) : choose({ ...draft, city: id === draft.city ? null : id }))}
              all={all}
              allCount={countFor({ city: null, kind: draft.kind })}
              ground={ground}
              testID="collections-filter-cities"
            />
          </View>
        </>
      ) : null}
      {kinds.length > 1 ? (
        <>
          <Text style={[s.legend, cities.length > 1 ? null : s.legendFirst]}>{t('Kind of place', 'Thể loại', '種類', '地点类型', '地點類型')}</Text>
          <View style={s.bleed}>
            <UnderlineChoice
              items={kindRow}
              chosen={draft.kind}
              onPick={(k) => choose({ ...draft, kind: k === draft.kind ? null : k })}
              all={all}
              allCount={countFor({ city: draft.city, kind: null })}
              ground={ground}
              testID="collections-filter-kinds"
            />
          </View>
        </>
      ) : null}

      {/* Explore's track: Reset when there is something to undo, and
          the button that applies, saying what it will show. */}
      <View style={s.actions}>
        {dirty(draft) ? (
          <PressableScale
            onPress={() => { slide(); setDraft({ city: null, kind: null }); }}
            testID="collections-filter-reset"
            accessibilityRole="button"
            contentStyle={s.reset}
          >
            <Ionicons name="refresh" size={17} color={colors.textSecondary} />
            <Text style={s.resetText}>{t('Reset', 'Đặt lại', 'リセット', '重置', '重設')}</Text>
          </PressableScale>
        ) : null}
        <View style={s.applyWrap}>
          <GradientCta
            icon="checkmark"
            wide
            onPress={() => onApply(draft)}
            testID="collections-filter-apply"
            label={`${t('Show', 'Hiện', '表示', '显示', '顯示')} ${count} ${t(count === 1 ? 'collection' : 'collections', 'bộ sưu tập', '件', '个合集', '個合集')}`}
          />
        </View>
      </View>
    </>
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={s.backdrop} onPress={onClose} accessibilityLabel={t('Close', 'Đóng', '閉じる', '关闭', '關閉')} />
      <Animated.View
        // A sheet that scrolls keeps the pull to its handle and title
        // (`sheetDrag`): the picker's list has a gesture of its own.
        {...(picking ? {} : handlers)}
        style={[s.sheet, {
          bottom: kb,
          paddingBottom: 14 + (kb ? 0 : insets.bottom),
          maxHeight: (winH - kb) * 0.92,
          transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [0, 420] }) }, { translateY: drag }],
        }]}
        testID="collections-filter-sheet"
      >
        <View {...(picking ? handlers : {})}>
          <View style={s.handle} />
          {picking ? (
            <View style={s.head}>
              <PressableScale
                onPress={() => { setPicking(false); setQuery(''); }}
                testID="collections-filter-back"
                accessibilityRole="button"
                accessibilityLabel={t('Back to filters', 'Quay lại bộ lọc', 'フィルターに戻る', '返回筛选', '返回篩選')}
                contentStyle={s.close}
              >
                <Ionicons name="chevron-back" size={20} color={colors.text} />
              </PressableScale>
              <Text style={[s.title, s.pickTitle]}>{t('Choose a city', 'Chọn thành phố', '都市を選択', '选择城市', '選擇城市')}</Text>
              {/* The ✕'s width again, so the title sits in the middle. */}
              <View style={s.close} />
            </View>
          ) : null}
        </View>
        {picking ? picker : questions}
      </Animated.View>
    </Modal>
  );
}

// Explore's sheet's measures (`ExploreFilterSheet`), by name: the two
// sheets are one design, and a number that drifted here would show.
const s = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(6,5,8,0.62)' },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingHorizontal: space.page, paddingTop: 8,
    backgroundColor: colors.bgElevated,
    borderTopLeftRadius: radius.card + 6, borderTopRightRadius: radius.card + 6,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderGlassSoft,
  },
  handle: { alignSelf: 'center', width: 38, height: 4, borderRadius: 2, backgroundColor: colors.textTertiary, marginBottom: 10 },
  head: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: space.titleToContent,
  },
  title: { color: colors.text, fontSize: 21, fontFamily: display.bold },
  close: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceGlass },
  legend: {
    color: colors.text, fontSize: 15, fontWeight: font.semibold,
    marginTop: space.titleToContent, marginBottom: space.headingToContent,
  },
  legendFirst: { marginTop: 0 },
  bleed: { marginHorizontal: -space.page },
  actions: {
    flexDirection: 'row', alignItems: 'center', gap: 4, padding: 4,
    marginTop: space.headingToContent + 8,
    backgroundColor: colors.surfaceGlass, borderRadius: radius.pill,
  },
  reset: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 48, paddingLeft: 12, paddingRight: 10 },
  resetText: { color: colors.textSecondary, fontSize: 14, fontWeight: font.semibold },
  applyWrap: { flex: 1 },
  // ── the picker: the city sheet's measures (`CitySwitcher`) ──
  pickTitle: { flex: 1, textAlign: 'center' },
  search: {
    flexDirection: 'row', alignItems: 'center', gap: 9,
    paddingHorizontal: 13, height: 44, marginBottom: 10,
    borderRadius: radius.card - 6, backgroundColor: colors.surfaceGlass,
  },
  searchInput: { flex: 1, color: colors.text, fontSize: 16, padding: 0 },
  // A ceiling, not a promise, and the part that yields to a keyboard.
  list: { maxHeight: 380, flexShrink: 1 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 15, paddingHorizontal: 12,
  },
  rowOn: { backgroundColor: colors.accentSoft, borderRadius: radius.card - 6 },
  // The row's own "not now", as `UnderlineChoice`'s and `ActionSheet`'s.
  rowOff: { opacity: 0.45 },
  rowTitle: { flex: 1, color: colors.text, fontSize: 16, fontWeight: font.medium },
  rowTitleOn: { color: colors.accent },
  count: { color: colors.textTertiary, fontSize: 15, fontVariant: ['tabular-nums'] },
  empty: { color: colors.textTertiary, fontSize: 14, paddingVertical: 22, textAlign: 'center' },
});
