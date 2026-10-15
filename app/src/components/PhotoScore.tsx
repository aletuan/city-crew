// The gallery's four pieces of photo scoring, after the owner's mockup
// (15 Oct 2026): the number on a tile, the number with its reasons in
// the photo's sheet, the dialog while the phone reads, and the card that
// says it has finished.
//
// The words and the arithmetic are `lib/photoScore`'s; this only draws
// them, so a threshold corrected there changes every one of these at once.

import React, { useRef } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { band, bandLabel, explainScore, toTen, type PhotoScore } from '../lib/photoScore';
import { useI18n } from '../lib/i18n';
import { colors, display, font, onPhoto, radius, space } from '../theme';
import { Card, PressableScale } from './ui';

/** "8.4", the way every one of these writes it — one decimal, always,
 *  so a 7 and a 7.5 line up in a grid. */
export const tenText = (ten: number) => ten.toFixed(1);

/**
 * Bottom-left on a tile. The cover badge has the top-left and the menu
 * the top-right; a third corner is the one that says nothing until a
 * score exists. The scrim is the cover badge's, so the two read as one
 * family on a photograph of any colour.
 *
 * The number alone. It wore the sparkles glyph of the button that made
 * it for the first build, and on a scored gallery that was the same
 * glyph six times over, every one saying what the one before had said
 * (owner, 15 Oct 2026, from 99/81 Coffee's six). The cover keeps its
 * star because there is one cover; a glyph earns its place by telling
 * one tile from the rest, and on a scored gallery every tile has a
 * score. The button, the dialog and the sheet still wear the sparkles,
 * so the number is learned where it was asked for.
 */
export function ScoreBadge({ score, testID }: { score: PhotoScore; testID?: string }) {
  if (score.aesthetic == null) return null;
  return (
    <View style={s.badge} testID={testID}>
      <Text style={s.badgeText}>{tenText(toTen(score.aesthetic))}</Text>
    </View>
  );
}

/** The score in the photo's sheet: the number, its word, and why. */
export function ScoreBlock({ score }: { score: PhotoScore }) {
  const { t } = useI18n();
  if (score.aesthetic == null) return null;
  const ten = toTen(score.aesthetic);
  return (
    <View style={s.block} testID="score-block">
      <View style={s.blockTop}>
        <Text style={s.blockTen}>{tenText(ten)}</Text>
        <Text style={s.blockOutOf}>/10</Text>
        <View style={s.bandPill}>
          <Text style={s.bandText}>{bandLabel(band(ten), t)}</Text>
        </View>
      </View>
      <Text style={s.blockWhy} testID="score-why">{explainScore(score, t)}</Text>
      <Text style={s.blockSource}>{t('Measured on this phone by Apple Vision.', 'Đo trên máy bằng Apple Vision.', 'この端末でApple Visionが測定。')}</Text>
    </View>
  );
}

/**
 * While the phone reads: how far it has got, and the way out. A dialog
 * and not a banner, because the grid underneath should not be touched
 * mid-run — a photo deleted while it is being read would be saved a
 * score for a row that is gone. Cancel stops after the photo in hand;
 * what was read is kept.
 */
export function ScoringDialog({ visible, done, total, stopping, onCancel }: {
  visible: boolean; done: number; total: number;
  /** Cancel was tapped and the photo in hand is still being read. */
  stopping: boolean;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  // What the dialog last said while it was up. The Modal fades out after
  // `visible` goes false, and the caller has nothing to count by then —
  // without this the closing frames read "0/0".
  const said = useRef({ done, total, stopping });
  if (visible) said.current = { done, total, stopping };
  ({ done, total, stopping } = said.current);
  // The photo being read, counted from one, never past the last.
  const at = Math.min(done + 1, total);
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onCancel}>
      <View style={s.scrim}>
        <View style={s.dialog} testID="scoring-dialog">
          <Ionicons name="sparkles" size={22} color={colors.accent} />
          <Text style={s.dialogTitle}>
            {stopping
              ? t('Stopping after this photo…', 'Đang dừng sau ảnh này…', 'この写真のあとで停止します…')
              : `${t('Reading the photos…', 'Đang phân tích ảnh…', '写真を分析中…')} ${at}/${total}`}
          </Text>
          <View style={s.track}>
            <View style={[s.fill, { width: `${total ? (done / total) * 100 : 0}%` }]} testID="scoring-fill" />
          </View>
          <Text style={s.dialogNote}>
            {/* Where the work happens, and no more: a promise about
                what is not sent invites the question of what is (the
                scores are, to the gallery), so the owner kept it to the
                one fact (15 Oct 2026). */}
            {t('Analysed on this phone.', 'Phân tích ngay trên máy.', '端末内で分析します。')}
          </Text>
          <PressableScale
            onPress={onCancel}
            disabled={stopping}
            scaleTo={0.96}
            style={s.dialogCancel}
            accessibilityRole="button"
            accessibilityLabel={t('Cancel', 'Huỷ', 'キャンセル')}
            testID="scoring-cancel"
          >
            <Text style={s.dialogCancelText}>{t('Cancel', 'Huỷ', 'キャンセル')}</Text>
          </PressableScale>
        </View>
      </View>
    </Modal>
  );
}

/**
 * The run is over: how many were read, which came out best, and — only
 * when there were any — how many could not be read. Stays until closed,
 * because it is the answer to a question the guide just asked.
 */
export function ScoredCard({ scored, failed, best, onClose }: {
  scored: number; failed: number;
  /** The best photo's place in the grid, counted from one, and its score. */
  best: { n: number; ten: number } | null;
  onClose: () => void;
}) {
  const { t } = useI18n();
  return (
    <Card style={s.done} testID="scored-card">
      <View style={s.doneIcon}>
        <Ionicons name="checkmark" size={16} color={colors.accentInk} />
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={s.doneTitle}>
          {t(`Scored ${scored} photo${scored === 1 ? '' : 's'}`, `Đã chấm xong ${scored} ảnh`, `${scored}枚を採点しました`)}
        </Text>
        {best ? (
          <Text style={s.doneLine}>
            {t(`Best: photo ${best.n} · ${tenText(best.ten)}`, `Cao nhất: ảnh ${best.n} · ${tenText(best.ten)}`, `最高：写真${best.n}・${tenText(best.ten)}`)}
          </Text>
        ) : null}
        {failed > 0 ? (
          <Text style={s.doneLine} testID="scored-failed">
            {t(`${failed} could not be read`, `${failed} ảnh không đọc được`, `${failed}枚は読み込めませんでした`)}
          </Text>
        ) : null}
      </View>
      <PressableScale
        onPress={onClose}
        scaleTo={0.9}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={t('Close', 'Đóng', '閉じる')}
        testID="scored-close"
      >
        <Ionicons name="close" size={18} color={colors.textTertiary} />
      </PressableScale>
    </Card>
  );
}

const s = StyleSheet.create({
  badge: {
    position: 'absolute', bottom: 6, left: 6,
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 6, paddingVertical: 3, borderRadius: radius.pill,
    backgroundColor: 'rgba(6,5,8,0.62)',
  },
  // Tabular figures, so 7.2 and 8.3 are the same width and a row of
  // badges lines up the way the tiles above them do.
  badgeText: { color: onPhoto.text, fontSize: 12, fontWeight: font.semibold, fontVariant: ['tabular-nums'] },

  block: {
    gap: 6, padding: space.cardPadding, marginTop: 10,
    backgroundColor: colors.surfaceCard,
    borderWidth: 1, borderColor: colors.borderGlassSoft, borderRadius: radius.card,
  },
  blockTop: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  blockTen: { color: colors.text, fontSize: 30, fontFamily: display.semibold },
  blockOutOf: { color: colors.textTertiary, fontSize: 15, fontWeight: font.medium },
  bandPill: {
    marginLeft: 8, alignSelf: 'center',
    paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
  },
  bandText: { color: colors.accent, fontSize: 13, fontWeight: font.semibold },
  blockWhy: { color: colors.textSecondary, fontSize: 14, lineHeight: 20 },
  blockSource: { color: colors.textTertiary, fontSize: 12 },

  scrim: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    padding: space.page, backgroundColor: 'rgba(6,5,8,0.62)',
  },
  dialog: {
    width: '100%', maxWidth: 320, alignItems: 'center', gap: 12,
    padding: 22, borderRadius: radius.card, backgroundColor: colors.bgElevated,
  },
  dialogTitle: { color: colors.text, fontSize: 17, fontWeight: font.semibold, textAlign: 'center' },
  track: {
    alignSelf: 'stretch', height: 6, borderRadius: 3, overflow: 'hidden',
    backgroundColor: colors.surfaceGlassStrong,
  },
  fill: { height: 6, borderRadius: 3, backgroundColor: colors.accentFill },
  dialogNote: { color: colors.textTertiary, fontSize: 13, textAlign: 'center' },
  dialogCancel: {
    marginTop: 4, height: 40, paddingHorizontal: 22, borderRadius: radius.pill,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceGlassStrong,
  },
  dialogCancelText: { color: colors.accent, fontSize: 15, fontWeight: font.semibold },

  done: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: space.cardPadding },
  doneIcon: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentFill,
  },
  doneTitle: { color: colors.text, fontSize: 15, fontWeight: font.semibold },
  doneLine: { color: colors.textSecondary, fontSize: 13 },
});
