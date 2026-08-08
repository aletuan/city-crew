// City switcher: a header chip (📍 Saigon ⌄) and the modal it opens —
// one row per supported city plus "Use my location" to re-enable auto.

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
          <Text style={s.title}>{t('Choose a city', 'Chọn thành phố')}</Text>

          <PressableScale haptic="selection" style={s.row} onPress={locate}>
            <Ionicons name="navigate-outline" size={18} color={colors.champagne} />
            <View style={{ flex: 1 }}>
              <Text style={s.rowTitle}>
                {locating ? t('Locating…', 'Đang định vị…') : t('Use my location', 'Dùng vị trí của tôi')}
              </Text>
              <Text style={s.rowSub}>
                {mode === 'auto'
                  ? t('On — nearest city is selected for you', 'Đang bật — tự chọn thành phố gần nhất')
                  : t('Currently picking manually', 'Đang chọn thủ công')}
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
                  {t(c.name_en, c.name_vi)}
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

/** Header chip showing the current city; opens the switcher. */
export function CityChip() {
  const { t } = useI18n();
  const { city } = useCity();
  const [open, setOpen] = useState(false);
  return (
    <>
      <PressableScale
        haptic="selection"
        style={s.chip}
        onPress={() => setOpen(true)}
        accessibilityLabel="Switch city"
      >
        <Ionicons name="location-outline" size={13} color={colors.champagne} />
        <Text style={s.chipText}>{t(city?.short_en ?? '…', city?.short_vi ?? '…')}</Text>
        <Ionicons name="chevron-down" size={12} color={colors.textTertiary} />
      </PressableScale>
      <CitySwitcherModal visible={open} onClose={() => setOpen(false)} />
    </>
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
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1, borderColor: colors.borderGlassSoft, borderRadius: radius.pill,
    paddingHorizontal: 11, paddingVertical: 6, marginRight: 8,
  },
  chipText: { color: colors.champagne, fontSize: 12.5, fontWeight: font.semibold },
});
