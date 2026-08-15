// One Google result, in whichever of its three states it is in.
//
// The "already here" state is the one worth having. Somebody who could not
// find a place by scrolling and reached for Add most often wants a place
// that **is already there** — and this hands it to them with a way to open
// it, rather than telling them they have made a duplicate.
//
// Shared by Add a place, which shows every result Google returned, and by
// Search, which shows only the ones the catalog has never heard of. Both
// need the row to look the same; only which rows reach it differs.

import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AddIconButton } from './add';
import { PressableScale } from './ui';
import type { Candidate, Known } from '../lib/suggest';
import { useI18n } from '../lib/i18n';
import { colors, font, radius, space, type } from '../theme';

export default function CandidateRow({ c, known, busy, away, onAdd, onOpen }: {
  c: Candidate;
  known: Known;
  busy: boolean;
  /** How far from the reader, already formatted — or '' when there is no
   *  position to measure from, which is a state the row simply wears. */
  away: string;
  onAdd: () => void;
  onOpen: (slug: string) => void;
}) {
  const { t } = useI18n();
  const live = known.state === 'live';
  const mine = known.state === 'mine';

  return (
    <View style={[s.row, live && s.rowLive]}>
      <View style={[s.pin, live && s.pinLive]}>
        <Ionicons
          name={live || mine ? 'checkmark' : 'location-outline'}
          size={18}
          color={live ? colors.ok : mine ? colors.textSecondary : colors.accent}
        />
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={s.name} numberOfLines={1}>{c.name}</Text>
        <Text style={[s.sub, live && s.subLive]} numberOfLines={1}>
          {live
            ? t('Already on cityCrew', 'Đã có trên cityCrew', 'すでに cityCrew にあります')
            : mine
              ? t('You added this — only you can see it', 'Bạn đã thêm — hiện chỉ mình bạn thấy', '追加済み — まだあなただけに表示')
              // Distance first, then the address as far as it fits.
              //
              // Three shops called "So Coffee" arrive with three addresses
              // identical for their first several words and cut at one
              // line — "…, Hà Nội 1…", "…, Thanh Xuân,…" — so the one
              // field that told them apart was the field being truncated.
              // A distance is four characters, never cut, and is the
              // actual answer to which one you meant. Without a position
              // it falls back to the address alone, as it always was.
              : away ? `${away} · ${c.address}` : c.address}
        </Text>
      </View>

      {live ? (
        <PressableScale onPress={() => onOpen(known.slug)} scaleTo={0.94} style={s.viewBtn}>
          <Text style={s.viewText}>{t('View', 'Xem', '見る')}</Text>
        </PressableScale>
      ) : mine ? null : busy ? (
        <ActivityIndicator color={colors.accent} />
      ) : (
        <AddIconButton
          onPress={onAdd}
          accessibilityLabel={t(`Add ${c.name}`, `Thêm ${c.name}`, `${c.name} を追加`)}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    marginHorizontal: space.page, marginBottom: space.cardGap,
    padding: 14,
    borderRadius: radius.card,
    backgroundColor: colors.surfaceCard,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderGlassSoft,
  },
  rowLive: { backgroundColor: 'transparent', borderColor: colors.borderGlassSoft },
  pin: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.accentSoft,
  },
  pinLive: { backgroundColor: colors.surfaceGlass },

  name: { color: colors.text, fontSize: 16, fontWeight: font.semibold },
  sub: { color: colors.textTertiary, fontSize: 13.5 },
  subLive: { color: colors.ok, fontWeight: font.medium },

  viewBtn: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceCard,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderGlassSoft,
  },
  viewText: { color: colors.text, fontSize: 14, fontWeight: font.semibold },
});
