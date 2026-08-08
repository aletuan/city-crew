// Price as a small premium badge: champagne on a barely-there champagne
// tint, one style for free and paid alike — no new semantic colors.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { isFree, Place, priceLabel } from '../lib/data';
import { useI18n } from '../lib/i18n';
import { colors, font, radius } from '../theme';

export default function PricePill({ place, compact }: { place: Place; compact?: boolean }) {
  const { t } = useI18n();
  if (isFree(place)) {
    return (
      <View style={s.pill}>
        <Text style={[s.text, s.upper]}>{t('Free', 'Miễn phí')}</Text>
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
    borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 4,
    backgroundColor: 'rgba(232,212,155,0.08)',
    borderWidth: 1, borderColor: 'rgba(232,212,155,0.26)',
  },
  text: { color: colors.champagne, fontSize: 12.5, fontWeight: font.semibold },
  upper: { textTransform: 'uppercase', letterSpacing: 0.8, fontSize: 12 },
});
