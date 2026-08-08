// Price as quiet information, not a badge. Only FREE is a special
// state and keeps the champagne pill; a paid price is calm text —
// "~70k ₫" — that never competes with the place's name.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { isFree, Place, priceLabel } from '../lib/data';
import { useI18n } from '../lib/i18n';
import { colors, font, radius } from '../theme';

/** "70k₫" → "~70k ₫" — a breath before the currency. */
const quiet = (label: string) => `~${label.replace('₫', ' ₫').trim()}`;

export default function PricePill({ place, compact }: { place: Place; compact?: boolean }) {
  const { t } = useI18n();
  if (isFree(place)) {
    return (
      <View style={s.pill}>
        <Text style={s.pillText}>{t('Free', 'Miễn phí', '無料')}</Text>
      </View>
    );
  }
  const label = priceLabel(place);
  if (!label) return null;
  return (
    <Text style={s.price}>
      {compact ? quiet(label) : t(`${quiet(label)} / person`, `${quiet(label)} / người`, `${quiet(label)} / 1人`)}
    </Text>
  );
}

const s = StyleSheet.create({
  pill: {
    borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 4,
    backgroundColor: 'rgba(232,212,155,0.08)',
    borderWidth: 1, borderColor: 'rgba(232,212,155,0.26)',
  },
  pillText: {
    color: colors.champagne, fontSize: 12, fontWeight: font.semibold,
    textTransform: 'uppercase', letterSpacing: 0.8,
  },
  price: { color: colors.textSecondary, fontSize: 13.5, fontWeight: font.medium },
});
