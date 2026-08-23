// Price as quiet information, not a badge. Only FREE is a special
// state and keeps the accented pill; a paid price is calm text —
// "~70k ₫" — that never competes with the place's name.
//
// The tilde is doing honest work: most prices are inferred from Google's
// price level, and a label that looks exact would be claiming more than
// we know.
//
// This renders on surfaces only — today, the detail screen's fact row.
// There was an `overlay` variant that rode the card photograph in a dark
// glass pill of its own, with a contrast story as long as this file; it
// went when the tile's corner passed to the bookmark. An approximate
// number is detail-tier information about a place you are already
// considering, and the detail screen is where it says it — on its own
// ground, where the accented FREE pill measures 4.63:1 in light and
// 5.82:1 in dark.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { isFree, Place, priceLabel } from '../lib/data';
import { useI18n } from '../lib/i18n';
import { colors, font, radius } from '../theme';

/** "70k₫" → "~70k ₫" — a breath before the currency. */
const quiet = (label: string) => `~${label.replace('₫', ' ₫').trim()}`;

export default function PricePill({ place, compact }: {
  place: Place;
  compact?: boolean;
}) {
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
    backgroundColor: colors.accentSoft,
    borderWidth: 1, borderColor: colors.accentLine,
  },
  pillText: {
    color: colors.accent, fontSize: 12, fontWeight: font.semibold,
    textTransform: 'uppercase', letterSpacing: 0.8,
  },
  price: { color: colors.textSecondary, fontSize: 13.5, fontWeight: font.medium },
});
