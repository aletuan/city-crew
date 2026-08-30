// Appearance picker — the two grounds the app can stand on, opened from
// Profile's settings card. Same sheet grammar as the city and language
// switchers, because it is the same kind of choice.
//
// Two rows, not three: there is no "match the system" option. This app
// ships a design, and the light one is a different reading of it rather
// than a courtesy for people whose phone is in light mode — the choice
// should be theirs to make here, once, deliberately.
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
import { Scheme, useScheme } from '../lib/theme';
import { colors, font, radius, space } from '../theme';
import { PressableScale } from './ui';

const OPTIONS: { id: Scheme; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'dark', icon: 'moon-outline' },
  { id: 'light', icon: 'sunny-outline' },
];

/** The label for a scheme, in the app's three languages. */
export function schemeLabel(id: Scheme, t: (en: string, vi: string, ja?: string) => string): string {
  return id === 'dark'
    ? t('Dark', 'Tối', 'ダーク')
    : t('Light', 'Sáng', 'ライト');
}

export function ThemeSwitcherModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const { scheme, setScheme } = useScheme();
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
          const active = o.id === scheme;
          return (
            <View key={o.id}>
              {i > 0 && <View style={s.sep} />}
              <PressableScale
                haptic="selection"
                style={[s.row, active && s.rowOn]}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                // The sheet stays open — see the note in the header.
                onPress={() => setScheme(o.id)}
              >
                <Ionicons name={o.icon} size={18} color={active ? colors.accent : colors.textTertiary} />
                <Text style={[s.rowTitle, { flex: 1 }, active && { color: colors.accent }]}>
                  {schemeLabel(o.id, t)}
                </Text>
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
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(6,5,8,0.62)' },
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
  // `marginVertical`, and it is the whole reason this line is visible.
  //
  // Without it the hairline sits flush against the next row, which is fine
  // between two plain ones and invisible against the selected pill: an 8%
  // hairline touching the top edge of an `accentSoft` fill reads as the
  // pill's own border, not as a divider. The language sheet got away with
  // it because its selected row is usually the first, so its dividers fall
  // between plain rows; the appearance sheet has two rows and one divider,
  // and when Light is chosen that divider is the one hugging the pill.
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
