// Zoom in, zoom out, and back to every pin — in the map's top-right
// corner (owner, 23 Nov 2026, from a sample with the same three).
//
// Pinching already zooms, so the two zoom buttons are for a hand that is
// holding the phone and a reader who never learned the gesture. The third
// is the one there was no other way to do: after a pan or a zoom away,
// getting back to the whole set meant changing a filter or closing the
// map. It fits every pin on the map, as the map does when it opens — not
// the reader's own position, which was weighed and left out the same day:
// on this map a reader is often a city away from what they are looking at.
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

export default function MapControls({ map, still, onFit }: {
  /** The map's own handle, for its camera. */
  map: React.RefObject<{ getCamera: () => Promise<{ zoom?: number }>; animateCamera: (c: { zoom: number }, o: { duration: number }) => void } | null>;
  /** A setting asks for less motion: the camera goes there at once. */
  still: boolean;
  onFit: () => void;
}) {
  const { t } = useI18n();
  // One step of Google's zoom — the world twice or half as wide — from
  // wherever the reader has the camera, in the time the fit takes to feel
  // like the same kind of move.
  const zoomBy = async (by: number) => {
    const camera = await map.current?.getCamera();
    if (camera?.zoom == null) return;
    map.current?.animateCamera({ zoom: camera.zoom + by }, { duration: still ? 0 : 300 });
  };
  // The pill's own figures: a shadow that is enough on light tiles is
  // lost on the night style's.
  const lift = { shadowOpacity: useScheme().scheme === 'light' ? 0.14 : 0.35 };
  const cell = (name: 'add' | 'remove' | 'scan-outline', label: string, onPress: () => void, id: string) => (
    <PressableScale onPress={onPress} haptic="selection" accessibilityRole="button" accessibilityLabel={label} hitSlop={4} contentStyle={s.cell} testID={id}>
      <Glyph name={name} size={ICON.action} color={colors.textSecondary} />
    </PressableScale>
  );
  return (
    <View style={s.stack}>
      <View style={[s.pill, lift]}>
        {cell('add', t('Zoom in', 'Phóng to', '拡大', '放大', '放大'), () => { void zoomBy(1); }, 'map-zoom-in')}
        <View style={s.rule} />
        {cell('remove', t('Zoom out', 'Thu nhỏ', '縮小', '缩小', '縮小'), () => { void zoomBy(-1); }, 'map-zoom-out')}
      </View>
      <View style={[s.pill, lift]}>
        {cell('scan-outline', t('Show every place', 'Về trung tâm', 'すべての場所を表示', '显示全部地点', '顯示全部地點'), onFit, 'map-fit')}
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
  // Across the pill now, the glyph's width rather than the cell's.
  rule: { height: StyleSheet.hairlineWidth, width: 18, backgroundColor: colors.borderGlass },
});
