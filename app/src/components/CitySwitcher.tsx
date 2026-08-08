// City switcher modal — one row per supported city plus "Use my
// location" to re-enable auto. Opened from Profile's settings card.

import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCity } from '../lib/city';
import { useI18n } from '../lib/i18n';
import { colors, font, radius, space } from '../theme';
import { fireHaptic, PressableScale } from './ui';

export function CitySwitcherModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const { city, cities, mode, setCity, useMyLocation } = useCity();
  const [locating, setLocating] = useState(false);

  const locate = async () => {
    if (locating) return;
    setLocating(true);
    try { await useMyLocation(); } catch { /* permission denied — keep current */ }
    setLocating(false);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.scrim} onPress={onClose}>
        <Pressable style={s.sheet} onPress={() => {}}>
          <Text style={s.title}>{t('Choose a city', 'Chọn thành phố', '都市を選択')}</Text>

          <PressableScale haptic="selection" style={s.row} onPress={locate}>
            <Ionicons name="navigate-outline" size={18} color={colors.champagne} />
            <View style={{ flex: 1 }}>
              <Text style={s.rowTitle}>
                {locating ? t('Locating…', 'Đang định vị…', '位置情報を取得中…') : t('Use my location', 'Dùng vị trí của tôi', '現在地を使う')}
              </Text>
              <Text style={s.rowSub}>
                {mode === 'auto'
                  ? t('On — nearest city is selected for you', 'Đang bật — tự chọn thành phố gần nhất', 'オン — 最寄りの都市を自動選択')
                  : t('Currently picking manually', 'Đang chọn thủ công', '現在は手動で選択中')}
              </Text>
            </View>
          </PressableScale>

          <View style={s.divider} />

          {cities.map((c) => {
            const active = c.id === city?.id;
            return (
              <PressableScale
                key={c.id}
                haptic="selection"
                style={s.row}
                onPress={() => { fireHaptic('selection'); setCity(c.id); onClose(); }}
              >
                <Ionicons name="business-outline" size={18} color={active ? colors.champagne : colors.textTertiary} />
                <Text style={[s.rowTitle, { flex: 1 }, active && { color: colors.champagne }]}>
                  {t(c.name_en, c.name_vi, c.name_ja)}
                </Text>
                {active && <Ionicons name="checkmark" size={18} color={colors.champagne} />}
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
  rowSub: { color: colors.textTertiary, fontSize: 12.5, marginTop: 2 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.borderGlassSoft, marginVertical: 4 },
});
