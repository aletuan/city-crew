// Appearance picker — the two grounds the app can stand on, opened from
// Profile's settings card. Same sheet grammar as the city and language
// switchers, because it is the same kind of choice.
//
// Three rows, and Auto is the first of them because it is the default.
// This sheet once carried a note saying the opposite — two rows, no
// "match the system", on the argument that light is a different reading
// of the design rather than a courtesy to a phone in light mode. The
// reading holds; the conclusion did not. Deferring to the phone is not a
// third design, it is a way of picking between the two we have, and it
// is the pick most people would make by hand anyway. Anyone who wants
// one ground regardless of the hour still says so on the other two rows.
//
// Unlike its siblings this sheet keeps its glyphs: a moon and a sun are
// two different marks carrying meaning, where the language rows' three
// identical marks carried none. And it keeps its "Done": choosing here
// repaints the whole screen behind the sheet, which is the one moment
// both readings can be seen against each other — closing on the tap
// would hide the result of the tap. A bottom sheet makes that view
// better, not worse: everything above it is the screen repainting.

import React, { useEffect, useRef } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '../lib/i18n';
import { Pref, Scheme, useScheme } from '../lib/theme';
import { colors, font, radius, space } from '../theme';
import { PressableScale } from './ui';

const OPTIONS: { id: Pref; icon: keyof typeof Ionicons.glyphMap }[] = [
  // The phone's own mark for "this device" — the same glyph iOS uses in
  // its Display settings, and the one row of the three whose icon names
  // a place rather than a time of day.
  { id: 'system', icon: 'phone-portrait-outline' },
  { id: 'dark', icon: 'moon-outline' },
  { id: 'light', icon: 'sunny-outline' },
];

/** The label for a setting, in the app's three languages. */
export function schemeLabel(id: Pref, t: (en: string, vi: string, ja?: string) => string): string {
  if (id === 'system') return t('Automatic', 'Tự động', '自動');
  return id === 'dark'
    ? t('Dark', 'Tối', 'ダーク')
    : t('Light', 'Sáng', 'ライト');
}

/** The second line on the Auto row: what the phone is doing right now.
 *  Without it the sheet can show a tick on Auto while the screen is
 *  plainly dark, and nothing on it explains which of the two won. */
function systemNow(scheme: Scheme, t: (en: string, vi: string, ja?: string) => string): string {
  return scheme === 'dark'
    ? t('Following the phone · Dark', 'Theo máy · Tối', '端末に合わせる · ダーク')
    : t('Following the phone · Light', 'Theo máy · Sáng', '端末に合わせる · ライト');
}

export function ThemeSwitcherModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const { scheme, pref, setPref } = useScheme();
  const insets = useSafeAreaInsets();
  // The house entrance (SaveSheet's, via PersonSheet): the modal only
  // fades — the scrim brightens in place — while the sheet alone rises
  // on a native-driven spring. See CitySwitcher for the longer note.
  // It matters most here of the three: the whole screen repaints behind
  // this sheet, and the calmer the sheet's own motion, the more that
  // repaint reads as the event.
  const rise = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!visible) { rise.setValue(1); return; }
    Animated.spring(rise, { toValue: 0, useNativeDriver: true, speed: 14, bounciness: 3 }).start();
  }, [visible, rise]);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={s.backdrop} onPress={onClose} accessibilityLabel={t('Close', 'Đóng', '閉じる')} />
      <Animated.View
        style={[s.sheet, {
          paddingBottom: 14 + insets.bottom,
          transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [0, 320] }) }],
        }]}
      >
        <View style={s.handle} />
        <Text style={s.title}>{t('Appearance', 'Giao diện', '外観')}</Text>
        {OPTIONS.map((o, i) => {
          const active = o.id === pref;
          return (
            <View key={o.id}>
              {i > 0 && <View style={s.sep} />}
              <PressableScale
                haptic="selection"
                style={[s.row, active && s.rowOn]}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                // The sheet stays open — see the note in the header.
                onPress={() => setPref(o.id)}
              >
                <Ionicons name={o.icon} size={18} color={active ? colors.accent : colors.textTertiary} />
                <View style={{ flex: 1 }}>
                  <Text style={[s.rowTitle, active && { color: colors.accent }]}>
                    {schemeLabel(o.id, t)}
                  </Text>
                  {o.id === 'system' && (
                    <Text style={s.rowNote}>{systemNow(scheme, t)}</Text>
                  )}
                </View>
                {active && <Ionicons name="checkmark" size={18} color={colors.accent} />}
              </PressableScale>
            </View>
          );
        })}
        <PressableScale onPress={onClose} accessibilityRole="button" style={s.done}>
          <Text style={s.doneText}>{t('Done', 'Xong', '完了')}</Text>
        </PressableScale>
      </Animated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
  // SaveSheet's backdrop, so the five sheets dim the room identically.
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(6,5,8,0.62)' },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: colors.bgElevated,
    borderTopLeftRadius: radius.card + 6, borderTopRightRadius: radius.card + 6,
    paddingHorizontal: space.cardPadding, paddingTop: 8,
  },
  handle: {
    alignSelf: 'center', width: 36, height: 4, borderRadius: 2,
    backgroundColor: colors.borderGlass, marginBottom: 12,
  },
  title: {
    color: colors.text, fontSize: 18, fontWeight: font.semibold,
    marginBottom: 12, paddingHorizontal: 4,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 15, paddingHorizontal: 12,
  },
  // The city sheet's own material for "this is the special one".
  rowOn: { backgroundColor: colors.accentSoft, borderRadius: radius.card - 6 },
  rowTitle: { color: colors.text, fontSize: 16, fontWeight: font.medium },
  rowNote: { color: colors.textTertiary, fontSize: 12.5, fontWeight: font.regular, marginTop: 2 },
  // `marginVertical`, and it is the whole reason this line is visible.
  //
  // Without it the hairline sits flush against the next row, which is fine
  // between two plain ones and invisible against the selected pill: an 8%
  // hairline touching the top edge of an `accentSoft` fill reads as the
  // pill's own border, not as a divider. The language sheet got away with
  // it because its selected row is usually the first, so its dividers fall
  // between plain rows; the appearance sheet has three rows and two
  // dividers, and whichever row is chosen at least one divider hugs the
  // pill — Auto, the default, has one on its underside from first launch.
  //
  // Three points either side is enough to put sheet colour between the
  // line and the fill, and small enough that the rhythm between plain rows
  // does not change.
  sep: {
    height: StyleSheet.hairlineWidth, backgroundColor: colors.borderGlassSoft,
    marginHorizontal: 4, marginVertical: 3,
  },
  done: { paddingVertical: 12, marginTop: 4, alignSelf: 'center' },
  doneText: { color: colors.textSecondary, fontSize: 15, fontWeight: font.medium },
});
