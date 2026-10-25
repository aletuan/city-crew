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

import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, LayoutAnimation, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '../lib/i18n';
import { useScheme } from '../lib/theme';
import { bgElevatedHex, colors, display, font, radius, space } from '../theme';
import { fireHaptic, GradientCta, PressableScale, UnderlineChoice, useReducedMotion } from './ui';
import { SLIDE } from './SearchField';
import { useSheetDrag } from './sheetDrag';

/** What the sheet narrows by: a city and a kind, each null for all. */
export type CollectionFilters = { city: string | null; kind: string | null };

export default function CollectionFilterSheet({ visible, applied, cities, kinds, countFor, onClose, onApply }: {
  visible: boolean;
  applied: CollectionFilters;
  /** The choices the shelf holds, in the screen's order. A group with
   *  fewer than two is a fact rather than a choice and is not asked. */
  cities: { key: string; label: string }[];
  kinds: { key: string; label: string; icon?: keyof typeof Ionicons.glyphMap; iconColor?: string }[];
  /** How many lists a draft leaves, for the button. */
  countFor: (f: CollectionFilters) => number;
  onClose: () => void;
  onApply: (f: CollectionFilters) => void;
}) {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const ground = bgElevatedHex[useScheme().scheme];
  const rise = useRef(new Animated.Value(1)).current;
  const { drag, handlers } = useSheetDrag(visible, onClose);
  const [draft, setDraft] = useState(applied);
  const still = useReducedMotion();
  // Reset arriving or leaving is the one thing that moves; see Explore's.
  const slide = () => { if (!still) LayoutAnimation.configureNext(SLIDE); };

  useEffect(() => {
    if (!visible) { rise.setValue(1); return; }
    setDraft(applied);
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

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={s.backdrop} onPress={onClose} accessibilityLabel={t('Close', 'Đóng', '閉じる', '关闭', '關閉')} />
      <Animated.View
        {...handlers}
        style={[s.sheet, {
          paddingBottom: 14 + insets.bottom,
          transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [0, 420] }) }, { translateY: drag }],
        }]}
        testID="collections-filter-sheet"
      >
        <View style={s.handle} />
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
                items={cities}
                chosen={draft.city}
                onPick={(id) => choose({ ...draft, city: id === draft.city ? null : id })}
                all={all}
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
                items={kinds}
                chosen={draft.kind}
                onPick={(k) => choose({ ...draft, kind: k === draft.kind ? null : k })}
                all={all}
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
});
