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
import { PressableScale, SelectTick } from './ui';
import { ItemState, locksRow } from '../lib/batch';
import type { Candidate, Known } from '../lib/suggest';
import { useI18n } from '../lib/i18n';
import { colors, font, radius, space, type } from '../theme';

export default function CandidateRow({ c, known, busy, away, item, selected, onToggle, onOpen }: {
  c: Candidate;
  known: Known;
  busy: boolean;
  /** How far from the reader, already formatted — or '' when there is no
   *  position to measure from, which is a state the row simply wears. */
  away: string;
  /** Where this one is in a batch, when there is one running or finished.
   *  Absent on the single-add path, which has no batch to be part of. */
  item?: ItemState;
  /** Ticked for a batch. Only meaningful with `onToggle`. */
  selected?: boolean;
  /** Multi-select — the whole row is the target, because a checkbox you
   *  have to hit exactly is a worse row than one you can tap anywhere.
   *  Both screens give this now; the single-shot ⊕ that Search used to
   *  carry is gone, along with the five round trips it took to add five
   *  places. */
  onToggle?: () => void;
  onOpen: (slug: string) => void;
}) {
  const { t } = useI18n();
  const live = known.state === 'live';
  const mine = known.state === 'mine';
  // A row that can name its place can open it. Both flavours of known
  // carry a slug now — `live` always, `mine` when it is *your* place (a
  // fresh import, or your pending submission found by the lookup). The
  // one 'mine' without a slug is somebody else's suggestion, which the
  // server will not name and this row honestly cannot open.
  //
  // This is what makes the end of an import consistent: "Added — only
  // you can see it" used to be a dead end unless the typed query also
  // happened to substring-match the new place's record, which a
  // Google-loose query like "xoa socialroom" does not. Now the road to
  // the detail screen is on the row itself, every time.
  const openable = known.state !== 'none' && known.slug ? known.slug : null;
  // What the row says about itself while a batch is running, in place of
  // the address — the reader is watching progress, not reading streets.
  const status = item === 'running'
    ? t('Fetching name, photos and hours…', 'Đang lấy tên, ảnh và giờ mở cửa…', '名前・写真・営業時間を取得中…')
    : item === 'done'
      ? t('Added — only you can see it', 'Đã thêm — chỉ mình bạn thấy', '追加済み — あなただけに表示')
      : item === 'skipped'
        ? t('Already here — skipped', 'Đã có sẵn — bỏ qua', 'すでにあります — スキップ')
        : item === 'failed'
          ? t('Could not add this one', 'Không thêm được chỗ này', '追加できませんでした')
          // Neither a failure nor the silence this used to be. The
          // account's goes for the day ran out before this one's turn
          // came; nothing is wrong with the place, and tomorrow the same
          // tap works.
          : item === 'held'
            ? t(
              'Not added — no goes left today',
              'Chưa thêm — hết lượt hôm nay',
              '未追加 — 本日の上限に達しました',
            )
            : '';

  const body = (
    <View style={[s.row, live && s.rowLive, selected && s.rowOn]}>
      {/* Unchanged by selection. The pin says what kind of thing this
          row is; the tick on the right says whether you chose it, and one
          mark per question is enough. */}
      <View style={[s.pin, live && s.pinLive]}>
        {item === 'running' ? (
          <ActivityIndicator size="small" color={colors.accent} />
        ) : (
          <Ionicons
            name={live || mine || item === 'done' ? 'checkmark' : 'location-outline'}
            size={18}
            color={live || item === 'done' ? colors.ok : mine ? colors.textSecondary : colors.accent}
          />
        )}
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={s.name} numberOfLines={1}>{c.name}</Text>
        <Text style={[s.sub, live && s.subLive, !!status && s.subStatus, item === 'failed' && s.subBad]} numberOfLines={1}>
          {status || (live
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
              : away ? `${away} · ${c.address}` : c.address)}
        </Text>
      </View>

      {openable ? (
        <PressableScale onPress={() => onOpen(openable)} scaleTo={0.94} style={s.viewBtn}>
          <Text style={s.viewText}>{t('View', 'Xem', '見る')}</Text>
        </PressableScale>
      ) : mine || locksRow(item) ? null : busy ? (
        <ActivityIndicator color={colors.accent} />
      ) : onToggle ? (
        // Drawn, not pressed. The whole row is the target, so a second hit
        // area inside it would give one action two of them and VoiceOver
        // two stops.
        <SelectTick on={!!selected} />
      ) : null}
    </View>
  );

  if (!onToggle || live || mine || locksRow(item)) return body;
  return (
    <PressableScale
      onPress={onToggle}
      scaleTo={0.985}
      haptic="selection"
      accessibilityRole="checkbox"
      accessibilityState={{ checked: !!selected }}
    >
      {body}
    </PressableScale>
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

  rowOn: { backgroundColor: colors.accentSoft, borderColor: colors.accentLine },
  subStatus: { color: colors.textSecondary, fontWeight: font.medium },
  subBad: { color: colors.bad },
});
