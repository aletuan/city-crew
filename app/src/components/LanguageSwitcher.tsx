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

import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LANGS, useI18n } from '../lib/i18n';
import { colors, font, radius, space } from '../theme';
import { PressableScale } from './ui';

export function LanguageSwitcherModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t, lang, setLang } = useI18n();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.scrim} onPress={onClose}>
        <Pressable style={[s.sheet, { paddingBottom: 14 + insets.bottom }]} onPress={() => {}}>
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
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  scrim: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
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
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: colors.borderGlassSoft, marginHorizontal: 4 },
});
