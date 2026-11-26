// The map instead of the list: the floating filter row, the quick
// filters a person on a street asks, the pins, and the picked place.
//
// Over the list, not in its place (owner's recording, 25 Nov 2026): the
// list stays where it was underneath (`ExploreScreen` says why), and the
// map comes up over it on the page's own ground, fading in over
// `MAP_IN_MS`. The fade is for the map's first moments — its tiles
// arrive a beat after its box does, and a hard cut showed that beat as a
// grey flash. Going back is a cut: the list underneath is already
// drawn, so there is nothing to wait for and nothing to cover. Rejected:
// the map rising from the foot like a sheet, which says a swipe down
// closes it when a swipe on a map moves the map. A reader who asked for
// less motion gets the cut both ways.
//
// Out of `ExploreScreen` on 25 Nov 2026, as the screens of the 22 Nov code
// review were (F1, F5): the reasoning moved with the code, unchanged.

import React, { useEffect, useRef, type ReactElement } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { Glyph, ICON } from '../../components/ui/glyph';
import { PressableScale, useReducedMotion } from '../../components/ui';
import { statusLabel } from '../../components/ExploreFilterSheet';
import { Toast } from '../../components/Toast';
import PlacesMap from '../../components/PlacesMap';
import type { useCity } from '../../lib/city';
import type { useI18n } from '../../lib/i18n';
import { colors } from '../../theme';
import type { Nav } from '../../nav';
import ExploreStrip from './ExploreStrip';
import { s } from './styles';
import type { ExploreFiltering } from './useExploreFilters';

type City = NonNullable<ReturnType<typeof useCity>['city']>;

/** The map's fade in. As long as a sheet's dim takes to arrive (200):
 *  long enough to be a fade and not a flicker, short enough that the
 *  press still feels answered at once. */
export const MAP_IN_MS = 200;

export function ExploreMap({
  t, navigation, bar, barH, light, checkinOn, city, setCity, tabClearance, filters,
}: {
  t: ReturnType<typeof useI18n>['t'];
  navigation: Nav;
  /** The filter row, floating: there is no list for it to ride. */
  bar: ReactElement;
  barH: number;
  light: boolean;
  checkinOn: boolean;
  city: City;
  setCity: ReturnType<typeof useCity>['setCity'];
  tabClearance: number;
  filters: ExploreFiltering;
}) {
  const {
    appliedFilters, pickStatus, pickSaved, pickVisited, note, shown, selectedSlug, pickPin, picked,
    sortOrigin, elsewhere,
  } = filters;
  const still = useReducedMotion();
  const shownAs = useRef(new Animated.Value(still ? 1 : 0)).current;
  useEffect(() => {
    if (still) return;
    Animated.timing(shownAs, { toValue: 1, duration: MAP_IN_MS, useNativeDriver: true }).start();
  // Once, as the map comes up.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.bg, opacity: shownAs }]} testID="explore-map">
      {/* The bar's in-list copy has nothing to scroll away with
          here, so the floating copy stands in for it permanently:
          heading, switch, chips, all clear of the clock. */}
      {bar}
      {/* `marginTop`, not padding: the map fills its parent with
          `absoluteFill`, and an absolutely placed child ignores the
          parent's padding — it would sit under the opaque bar. The
          bar measures itself (it already carries `insets.top`), so
          nothing is added to the figure it reports. */}
      <View style={[s.mapBody, { marginTop: barH }]}>
        {/* Two of the sheet's questions, answerable without opening
            it — the two a person standing on a street asks. They
            write to what is applied, which is why nothing has to be
            synchronised: the badge, the sheet and this row read the
            same state. Sort stays in the sheet; a cycling button for
            three sorts is a slot machine. */}
        <View style={s.mapQuick}>
          {/* One pill, not two discs. Each disc wore the look's
              elevated ground, which is within a few points of the
              map's land colour in every look: 1.2:1 on Sand against
              Google's land tint, 1.1:1 on the white looks, 1.04:1
              on Midnight against its own night land (measured 13
              Oct 2026). On Sand the discs read as two faint rings
              on the tiles. A ground the same colour cannot be made
              to stand off the map by colour, so the pill stands off it the way
              the place card at the map's foot does — by shadow and
              a real border — and stays the look's own material,
              which is what the Profile's theme choice promises.
              The cells sit inside it as a segmented control does:
              the one that is on gets the accent wash the bar's
              chips wear, inset so nothing needs clipping and the
              shadow survives (iOS draws shadows outside bounds). */}
          <View style={[s.mapPill, { shadowOpacity: light ? 0.14 : 0.35 }]}>
            <PressableScale
              onPress={pickStatus}
              haptic="selection"
              accessibilityRole="button"
              accessibilityLabel={`${t('Opening hours', 'Giờ mở cửa', '営業時間', '营业时间', '營業時間')}: ${statusLabel(appliedFilters.status, t, appliedFilters.window)}`}
              accessibilityState={{ selected: appliedFilters.status !== 'any' }}
              hitSlop={4}
              contentStyle={[s.mapCell, appliedFilters.status !== 'any' && s.mapCellOn]}
            >
              <Glyph
                name={appliedFilters.status === 'closed' ? 'time' : 'time-outline'}
                size={ICON.action}
                color={appliedFilters.status !== 'any' ? colors.accent : colors.textSecondary}
              />
            </PressableScale>
            <View style={s.mapRule} />
            <PressableScale
              onPress={pickSaved}
              haptic="selection"
              accessibilityRole="button"
              accessibilityLabel={t('Bookmarked only', 'Chỉ nơi đã lưu', 'ブックマークのみ', '仅看已保存', '僅看已儲存')}
              accessibilityState={{ selected: appliedFilters.savedOnly }}
              hitSlop={4}
              contentStyle={[s.mapCell, appliedFilters.savedOnly && s.mapCellOn]}
            >
              <Glyph
                name={appliedFilters.savedOnly ? 'bookmark' : 'bookmark-outline'}
                size={ICON.action}
                color={appliedFilters.savedOnly ? colors.accent : colors.textSecondary}
              />
            </PressableScale>
            {/* The third question a person on a street asks — "have
                I been here?" — with the Check-in pill's own ring,
                and behind the same flag as the sheet's row. */}
            {checkinOn ? (
              <>
                <View style={s.mapRule} />
                <PressableScale
                  onPress={pickVisited}
                  haptic="selection"
                  testID="map-visited"
                  accessibilityRole="button"
                  accessibilityLabel={t('Visited only', 'Chỉ nơi đã check-in', '訪問済みのみ', '仅看已打卡', '僅看已打卡')}
                  accessibilityState={{ selected: appliedFilters.visitedOnly }}
                  hitSlop={4}
                  contentStyle={[s.mapCell, appliedFilters.visitedOnly && s.mapCellOn]}
                >
                  <Glyph
                    name={appliedFilters.visitedOnly ? 'checkmark-circle' : 'checkmark-circle-outline'}
                    size={ICON.action}
                    color={appliedFilters.visitedOnly ? colors.accent : colors.textSecondary}
                  />
                </PressableScale>
              </>
            ) : null}
          </View>
          {/* Beside the pill rather than centred or at the foot:
              the reader's eyes are on the cell they just pressed,
              and the foot of the map is spoken for — the selected
              place's strip and the tab bar both live there. Read as
              the pill's caption, which is what it is for two
              seconds. */}
          <Toast note={note} testID="explore-map-toast" />
        </View>
        <PlacesMap
          places={shown}
          selectedSlug={selectedSlug}
          onSelect={pickPin}
          // Under a chip the pins take the chip's colour; with none
          // chosen each speaks for itself. See the prop's own note.
          categories={picked}
          origin={sortOrigin}
          // Where the map opens with neither a fix nor a pin: the
          // city's own centre. `city` is in the render condition
          // above precisely so this never has to invent one.
          fallback={{ lat: city.center_lat, lng: city.center_lng }}
          // Everywhere else the app has places, for a reader who
          // zoomed out past this city — see the prop's own note.
          cities={elsewhere}
          onPickCity={setCity}
          // The map's box already starts under the bar (`marginTop`
          // above), so the top inset is only breathing room; the
          // bottom clears the strip and the tab bar beneath it: 124,
          // the strip's 108 (an 88pt photograph and its 10pt padding;
          // four short lines beside it since the route became a disc
          // in its corner, 24 Nov 2026) and the 12 it stands off the
          // bar, rounded up. It was 140 while the route was a 32pt
          // chip on a line of its own. The
          // right is 64, not 40, since the zoom controls took that
          // corner (`MapControls`, 42 wide at the page's gutter): a
          // fitted pin should not land under them.
          edgePadding={{ top: 24, right: 64, bottom: tabClearance + 124, left: 40 }}
        />
        <ExploreStrip filters={filters} navigation={navigation} tabClearance={tabClearance} />
      </View>
    </Animated.View>
  );
}
