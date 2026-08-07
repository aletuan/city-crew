// Price as a quiet badge instead of bare text. Free places say so in a
// soft green — "0₫" read like missing data, and free is a selling point.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { isFree, Place, priceLabel } from '../lib/data';
import { useI18n } from '../lib/i18n';
import { colors, font, radius } from '../theme';

export default function PricePill({ place, compact }: { place: Place; compact?: boolean }) {
  const { t } = useI18n();
  if (isFree(place)) {
    return (
      <View style={[s.pill, s.free]}>
        <Text style={[s.text, s.freeText]}>{t('Free', 'Miễn phí')}</Text>
      </View>
    );
  }
  const label = priceLabel(place);
  if (!label) return null;
  return (
    <View style={s.pill}>
      <Text style={s.text}>
        {compact ? `~${label}` : t(`~${label} / person`, `~${label} / người`)}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  pill: {
    borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4,
    backgroundColor: colors.surfaceGlass, borderWidth: 1, borderColor: colors.borderGlassSoft,
  },
  text: { color: colors.textSecondary, fontSize: 12.5, fontWeight: font.semibold },
  free: { backgroundColor: 'rgba(143,191,138,0.12)', borderColor: 'rgba(143,191,138,0.30)' },
  freeText: { color: colors.ok },
});
