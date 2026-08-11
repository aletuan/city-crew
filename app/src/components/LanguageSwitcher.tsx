// Language switcher modal — one row per supported language, opened from
// Profile's settings card. Same sheet language as the city switcher.

import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LANGS, useI18n } from '../lib/i18n';
import { colors, font, radius, space } from '../theme';
import { PressableScale } from './ui';

export function LanguageSwitcherModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t, lang, setLang } = useI18n();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.scrim} onPress={onClose}>
        <Pressable style={s.sheet} onPress={() => {}}>
          <Text style={s.title}>{t('Choose a language', 'Chọn ngôn ngữ', '言語を選択')}</Text>
          {LANGS.map((l) => {
            const active = l.id === lang;
            return (
              <PressableScale
                key={l.id}
                haptic="selection"
                style={s.row}
                onPress={() => { setLang(l.id); onClose(); }}
              >
                <Ionicons name="language-outline" size={18} color={active ? colors.accent : colors.textTertiary} />
                <Text style={[s.rowTitle, { flex: 1 }, active && { color: colors.accent }]}>{l.label}</Text>
                {active && <Ionicons name="checkmark" size={18} color={colors.accent} />}
              </PressableScale>
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
});
