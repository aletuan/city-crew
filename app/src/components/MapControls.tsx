// Find me — one button, in the map's top-right corner (owner, 27 Nov 2026).
//
// There were three here from a sample (23 Nov): zoom in, zoom out, and back
// to every pin. Pinching already zooms, so the two went; and the owner
// chose the reader's own position over the fit-to-every-pin, which is the
// one move that is left without a button — after a pan away, the set is
// back by changing a chip or closing the map, as it was before 23 Nov. The
// crosshair centres the map on the reader (`mapBubbles` › `MapCorner`).
//
// The material is the quick-filter pill's at the other corner
// (`screens/explore/styles` › `mapPill`): the look's elevated ground, a
// real hairline and the place card's shadow, because the map's land is
// within a few points of that ground in every look and a ground cannot
// stand off it by colour. Columns rather than a row, so the pair reads as
// one control, as it does on every map; the fit stands apart below it,
// a different kind of act. The cells are the pill's 40 by 36, turned.

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Glyph, ICON } from './ui/glyph';
import { PressableScale } from './ui';
import { useI18n } from '../lib/i18n';
import { useScheme } from '../lib/theme';
import { colors, radius, space } from '../theme';

export default function MapControls({ onLocate }: {
  /** Centre on the reader. Left out, there is no button. */
  onLocate?: () => void;
}) {
  const { t } = useI18n();
  // The pill's own figures: a shadow that is enough on light tiles is
  // lost on the night style's.
  const lift = { shadowOpacity: useScheme().scheme === 'light' ? 0.14 : 0.35 };
  if (!onLocate) return null;
  return (
    <View style={s.stack}>
      <View style={[s.pill, lift]}>
        <PressableScale
          onPress={onLocate} haptic="selection" accessibilityRole="button" hitSlop={4} contentStyle={s.cell} testID="map-locate"
          accessibilityLabel={t('My location', 'Vị trí của tôi', '現在地', '我的位置', '我的位置')}
        >
          <Glyph name="locate" size={ICON.action} color={colors.textSecondary} />
        </PressableScale>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  // Level with the quick-filter pill (`mapQuick` › `top: 12`), at the
  // page's gutter from the edge.
  stack: { position: 'absolute', top: 12, right: space.page, gap: 8, zIndex: 5 },
  pill: {
    alignItems: 'center',
    padding: 3, borderRadius: radius.pill,
    backgroundColor: colors.bgElevated,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderGlass,
    shadowColor: '#000', shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  cell: { width: 36, height: 40, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
