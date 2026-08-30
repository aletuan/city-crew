// Language switcher — a bottom sheet with one row per supported
// language, opened from Profile's settings card. Same sheet grammar as
// the city switcher, which is the point: the same kind of choice should
// open the same kind of surface, sliding up from the bottom with a grab
// handle rather than interrupting from the centre of the screen.
//
// The rows carry no glyphs. Three identical language marks said nothing
// three times — the reasoning that removed the city rows' five identical
// buildings — and each label here is already its own best icon, written
// in its own script. The chosen row wears the tint and a tick instead
// (the tick stays: colour alone must never be the whole signal).

import React, { useEffect, useRef } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LANGS, useI18n } from '../lib/i18n';
import { colors, font, radius, space } from '../theme';
import { PressableScale } from './ui';

export function LanguageSwitcherModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t, lang, setLang } = useI18n();
  const insets = useSafeAreaInsets();
  // The house entrance (SaveSheet's, via PersonSheet): the modal only
  // fades — the scrim brightens in place — while the sheet alone rises
  // on a native-driven spring. See CitySwitcher for the longer note.
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
        <Text style={s.title}>{t('Choose a language', 'Chọn ngôn ngữ', '言語を選択')}</Text>
        {LANGS.map((l, i) => {
          const active = l.id === lang;
          return (
            <View key={l.id}>
              {i > 0 && <View style={s.sep} />}
              <PressableScale
                haptic="selection"
                style={[s.row, active && s.rowOn]}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                onPress={() => { setLang(l.id); onClose(); }}
              >
                <Text style={[s.rowTitle, { flex: 1 }, active && { color: colors.accent }]}>
                  {l.label}
                </Text>
                {active && <Ionicons name="checkmark" size={18} color={colors.accent} />}
              </PressableScale>
            </View>
          );
        })}
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
});
