// Price as quiet information, not a badge. Only FREE is a special
// state and keeps the accented pill; a paid price is calm text —
// "~70k ₫" — that never competes with the place's name.
//
// The `overlay` variant is the exception: sitting on photography it has to
// carry its own contrast, so both states become a dark glass pill. The
// tilde stays — most prices are inferred from Google's price level, and a
// badge that looks exact would be claiming more than we know.
//
// On the photo the two states are the same pill in the same voice, which
// they were not. Free wore the accent in caps and could not be read: over
// a bright sky the 58% scrim lands near #5A636A, and the bright coral
// against it measures 2.24:1 — for 12.5pt text, which wants 4.5. The paid
// label on the identical scrim measures 5.71. One pill, one ground, and
// only one of the two inks survived it.
//
// Coral could not be rescued by making the pill louder either. Filling it
// with coral and writing in white is 2.55:1; the pairing that works,
// `accentInk` on coral at 6.79, is the primary-button treatment, and a
// price badge that looks like a button is a worse mistake than a quiet
// one. And the accent has a job on a photo already — it marks the saved
// bookmark, a state you toggle. A price is not a state.
//
// So free says its price the way a number says its price. The word is the
// distinction, and unlike the colour it can actually be read.
//
// The in-card pill keeps the accent: measured on its own ground it is
// 4.63:1 in light and 5.82:1 in dark. Nothing was wrong there.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { isFree, Place, priceLabel } from '../lib/data';
import { useI18n } from '../lib/i18n';
import { colors, font, onPhoto, radius } from '../theme';

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
        <Text style={s.overlayText}>
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
    backgroundColor: colors.accentSoft,
    borderWidth: 1, borderColor: colors.accentLine,
  },
  pillText: {
    color: colors.accent, fontSize: 12, fontWeight: font.semibold,
    textTransform: 'uppercase', letterSpacing: 0.8,
  },
  price: { color: colors.textSecondary, fontSize: 13.5, fontWeight: font.medium },

  // On a photo the pill supplies its own ground, because a photograph can
  // be any brightness and no ink can be trusted against it unaided. The
  // scrim only does that job for ink bright enough to use it — which is
  // the whole reason the accent had to go and `onPhoto.text` stayed.
  overlay: {
    borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 7,
    backgroundColor: 'rgba(10,11,10,0.58)',
    borderWidth: StyleSheet.hairlineWidth, borderColor: onPhoto.line,
  },
  overlayText: { color: onPhoto.text, fontSize: 15, fontWeight: font.semibold },
});
