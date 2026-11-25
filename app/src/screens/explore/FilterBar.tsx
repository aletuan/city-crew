// The row under the photograph: the heading, Filter, Map, and the kinds.
// Drawn twice, in the list and floating over the screen once it pins.
//
// Out of `ExploreScreen` on 25 Nov 2026, as the screens of the 22 Nov code
// review were (F1, F5): the reasoning moved with the code, unchanged.

import React from 'react';
import { Text, View } from 'react-native';
import { Glyph, ICON } from '../../components/ui/glyph';
import { PressableScale, UnderlineChoice } from '../../components/ui';
import { canDrawMap } from '../../components/MiniMap';
import { CATEGORIES, categoryLabel } from '../../lib/categories';
import type { ExploreView } from '../../lib/exploreView';
import type { useI18n } from '../../lib/i18n';
import { colors } from '../../theme';
import { FILTER_PAD, s } from './styles';

export function FilterBar({
  floating, t, insets, setBarH, filterCount, setFilterOpen, mapMode, pickView, cats, picked, pick,
}: {
  /** The copy over the screen, rather than the one in the list. */
  floating: boolean;
  t: ReturnType<typeof useI18n>['t'];
  insets: { top: number };
  setBarH: (h: number) => void;
  filterCount: number;
  setFilterOpen: (open: boolean) => void;
  mapMode: boolean;
  pickView: (v: ExploreView) => void;
  cats: string[];
  picked: string[];
  pick: (c: string | null) => void;
}) {
  return (
    <View
      style={floating
        ? [s.filterBar, s.filterBarFloating, { paddingTop: insets.top }]
        : [s.filterBar, { paddingTop: FILTER_PAD }]}
      testID={floating ? 'explore-pinned-bar' : undefined}
      onLayout={floating ? (e) => setBarH(Math.round(e.nativeEvent.layout.height)) : undefined}
    >
      <View style={s.filterHair} />
      <View style={s.placesHead}>
        <Text style={s.placesTitle}>{t('Places', 'Địa điểm', 'スポット', '地点', '地點')}</Text>
        <PressableScale
          onPress={() => setFilterOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={filterCount > 0
            ? t(
              `Filter and sort places, ${filterCount} applied`,
              `Lọc và sắp xếp địa điểm, đang áp dụng ${filterCount}`,
              `スポットを絞り込み・並べ替え、${filterCount}件適用中`,
              `筛选和排序地点，已应用 ${filterCount} 项`, `篩選和排序地點，已套用 ${filterCount} 項`,
            )
            : t('Filter and sort places', 'Lọc và sắp xếp địa điểm', 'スポットを絞り込み・並べ替え', '筛选和排序地点', '篩選和排序地點')}
          accessibilityState={{ selected: filterCount > 0 }}
          hitSlop={4}
          contentStyle={s.filterButton}
          testID={floating ? 'explore-filter-pinned' : 'explore-filter'}
        >
          {/* Ink at rest, coral once something is applied — and that is
              the correction to a coral-always glyph, which this was.
              The argument for coral-always was that a grey mark beside a
              heading reads as decoration. The argument against it is
              stronger: in this app coral means active, selected, acted
              upon. A control that wears it while nothing is filtered
              says the list has been narrowed when it has not, and it
              spends the one signal that would have said so.
              So the two states differ in the glyph's colour and in a
              badge counting the conditions. A badge alone is 16pt of
              evidence; colour is what carries across the screen, and the
              pair is the feedback for having pressed Apply. The disc
              behind it, which also turned coral, went (owner, 24 Oct
              2026): the pair says it already, and a filled disc beside
              the heading was the heaviest thing in the row.
              `accent` rather than `accentFill`: the paper theme's accent
              ink is deliberately the darker coral, because the button's
              bright one on a pale ground is a 3:1 glyph. Same accent,
              adjusted for ink — the app's own rule, not a second
              colour. */}
          <Glyph
            name="options-outline"
            size={ICON.action}
            color={filterCount > 0 ? colors.accent : colors.textSecondary}
          />
          {filterCount > 0 ? (
            <View style={s.filterBadge}>
              <Text style={s.filterBadgeText}>{filterCount}</Text>
            </View>
          ) : null}
        </PressableScale>
        {canDrawMap ? (
          // One button that names what it does, not two marks that leave
          // the reader to work out which is lit. The list is where this
          // screen lives; the map is somewhere it goes and comes back
          // from, and the way back has to say so — a reader who could
          // find the map and not the way out is the failure this fixes.
          // So the way in is one word, "Map" — and since 25 Nov 2026 the
          // way out is one too, "List" (owner): it says where the press
          // goes, which "Close Map" left the reader to work out. What
          // made the verb necessary was that the way out looked like
          // nothing; it is now the one filled pill on the screen (see
          // `viewBtnOn`), and a filled pill naming the other view is the
          // switch every map app has taught.
          <PressableScale
            contentStyle={[s.viewBtn, mapMode && s.viewBtnOn]}
            style={s.viewBtnSlot}
            scaleTo={0.94}
            haptic="selection"
            hitSlop={6}
            onPress={() => pickView(mapMode ? 'list' : 'map')}
            accessibilityRole="button"
            accessibilityLabel={mapMode
              ? t('List', 'Danh sách', 'リスト', '列表', '列表')
              : t('Map', 'Bản đồ', '地図', '地图', '地圖')}
            testID={floating ? 'explore-view-pinned' : 'explore-view'}
          >
            <Glyph
              name={mapMode ? 'list-outline' : 'map-outline'}
              size={ICON.text}
              color={mapMode ? colors.bg : colors.text}
            />
            <Text style={[s.viewBtnText, mapMode && s.viewBtnTextOn]}>
              {mapMode
                ? t('List', 'Danh sách', 'リスト', '列表', '列表')
                : t('Map', 'Bản đồ', '地図', '地图', '地圖')}
            </Text>
          </PressableScale>
        ) : null}
      </View>
      {/* Underlined rather than chipped (owner, 24 Oct 2026): see
          `UnderlineChoice`. */}
      <UnderlineChoice
        items={cats.map((c) => ({
          key: c, label: categoryLabel(c, t), icon: CATEGORIES[c]?.icon,
        }))}
        chosen={picked[0] ?? null}
        onPick={pick}
        all={t('All', 'Tất cả', 'すべて', '全部', '全部')}
        testID={floating ? undefined : 'explore-kinds'}
      />
    </View>
  );

}
