// Appearance picker — the two grounds the app can stand on, opened from
// Profile's settings card. Same sheet language as the city and language
// switchers, because it is the same kind of choice.
//
// Two rows, not three: there is no "match the system" option. This app
// ships a design, and the light one is a different reading of it rather
// than a courtesy for people whose phone is in light mode — the choice
// should be theirs to make here, once, deliberately.

import React from 'react';
import { Modal, Pressable, StyleSheet, Text } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
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
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.scrim} onPress={onClose}>
        <Pressable style={s.sheet} onPress={() => {}}>
          <Text style={s.title}>{t('Appearance', 'Giao diện', '外観')}</Text>
          {OPTIONS.map((o) => {
            const active = o.id === scheme;
            return (
              <PressableScale
                key={o.id}
                haptic="selection"
                style={s.row}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                // The sheet stays open. The whole screen repaints behind it,
                // which is the one moment you can see both choices against
                // each other — closing on the tap would hide the result of
                // the tap.
                onPress={() => setScheme(o.id)}
              >
                <Ionicons name={o.icon} size={18} color={active ? colors.accent : colors.textTertiary} />
                <Text style={[s.rowTitle, { flex: 1 }, active && { color: colors.accent }]}>
                  {schemeLabel(o.id, t)}
                </Text>
                {active && <Ionicons name="checkmark" size={18} color={colors.accent} />}
              </PressableScale>
            );
          })}
          <PressableScale onPress={onClose} accessibilityRole="button" style={s.done}>
            <Text style={s.doneText}>{t('Done', 'Xong', '完了')}</Text>
          </PressableScale>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  scrim: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center', padding: space.page,
  },
  sheet: {
    backgroundColor: colors.bgElevated, borderRadius: radius.card,
    borderWidth: 1, borderColor: colors.borderGlassSoft,
    padding: space.cardPadding, gap: 2,
  },
  title: {
    color: colors.text, fontSize: 17, fontWeight: font.semibold,
    marginBottom: 10, paddingHorizontal: 4,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 13, paddingHorizontal: 4,
  },
  rowTitle: { color: colors.text, fontSize: 15.5, fontWeight: font.medium },
  done: { paddingVertical: 12, marginTop: 4, alignSelf: 'center' },
  doneText: { color: colors.textSecondary, fontSize: 15, fontWeight: font.medium },
});
