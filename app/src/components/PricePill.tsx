// Price as quiet information, not a badge. Only FREE is a special
// state and keeps the champagne pill; a paid price is calm text —
// "~70k ₫" — that never competes with the place's name.
//
// The `overlay` variant is the exception: sitting on photography it has to
// carry its own contrast, so both states become a dark glass pill. The
// tilde stays — most prices are inferred from Google's price level, and a
// badge that looks exact would be claiming more than we know.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { isFree, Place, priceLabel } from '../lib/data';
import { useI18n } from '../lib/i18n';
import { colors, font, radius } from '../theme';

/** "70k₫" → "~70k ₫" — a breath before the currency. */
const quiet = (label: string) => `~${label.replace('₫', ' ₫').trim()}`;

export default function PricePill({ place, compact, overlay }: {
  place: Place;
  compact?: boolean;
  /** Rendered on top of a photo rather than in a card body. */
  overlay?: boolean;
}) {
  const { t } = useI18n();
  if (overlay) {
    const free = isFree(place);
    const label = free ? null : priceLabel(place);
    if (!free && !label) return null;
    return (
      <View style={s.overlay}>
        <Text style={free ? s.overlayFreeText : s.overlayText}>
          {free ? t('Free', 'Miễn phí', '無料') : quiet(label!)}
        </Text>
      </View>
    );
  }
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

  // On a photo the pill supplies its own ground: a photograph can be any
  // brightness, so neither the champagne nor plain text can be trusted to
  // read against it unaided.
  overlay: {
    borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 7,
    backgroundColor: 'rgba(10,11,10,0.58)',
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(247,247,245,0.22)',
  },
  overlayText: { color: '#FFFFFF', fontSize: 15, fontWeight: font.semibold },
  overlayFreeText: {
    color: colors.champagne, fontSize: 12.5, fontWeight: font.semibold,
    textTransform: 'uppercase', letterSpacing: 0.8,
  },
});
