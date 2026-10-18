// The gallery's pieces of photo scoring, after the owner's mockup
// (15 Oct 2026): the number on a tile, the number with its reasons in
// the photo's sheet, the dialog while the phone reads, and the card that
// says it has finished.
//
// The words and the arithmetic are `lib/photoScore`'s, and the reasons
// are the interpreter's of whichever scorer read the photograph; this
// only draws them, so a threshold corrected there changes every one of
// these at once.

import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, type ColorValue, Modal, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { band, bandLabel, interpreterOf, toTen, type Detail, type PhotoScore, type T } from '../lib/photoScore';
import { bothSources, kindNoun, type PhotoKind } from '../lib/photoKind';
import { percentText } from '../lib/standing';
import { useI18n } from '../lib/i18n';
import { colors, display, font, onPhoto, radius, space } from '../theme';
import { Card, PressableScale, useReducedMotion } from './ui';

/**
 * Each bar's travel, as shares of the glyph's height, and how long one
 * rise and fall takes. At rest every bar sits at its first figure —
 * short, tall, middling, the shape of the still glyph — so the static
 * icon and the first frame of the moving one are the same drawing.
 *
 * Made to read as "looking", not as a music player (owner, 15 Oct 2026):
 * an equalizer is fast, beat-locked, and bounces off the floor. These
 * are slow (a leg of 0.95 to 1.4 s, eased in and out), never drop under
 * two fifths of the height, and the middle bar starts tall and falls
 * while the others rise. The periods share no small multiple — 1.9, 2.2
 * and 2.8 s line up again only after 106.4 s — so the three are never
 * seen in step, and each loop is seamless on its own because it is a
 * there-and-back. Nothing random: a seed would make no two runs alike
 * and no test able to say what it draws.
 */
const BARS = [
  { from: 0.55, to: 0.95, ms: 2200 },
  { from: 1, to: 0.6, ms: 2800 },
  { from: 0.75, to: 0.4, ms: 1900 },
] as const;

/** Out and back in one stroke: 0 at both ends, 1 halfway, eased like a
 *  sine, so one timing is a whole rise and fall and the loop's seam is
 *  where the bar is already at rest. */
export const thereAndBack = (t: number) => (1 - Math.cos(2 * Math.PI * t)) / 2;

/**
 * One bar's wave, run entirely on the UI thread.
 *
 * Not `useLoop(ms, still, 'inOut')`, which the first build used and the
 * owner saw stand still on the phone (15 Oct 2026). That loop is a
 * sequence — up, then down — and React Native cannot loop a sequence
 * natively ("Loops run using the native driver cannot contain
 * Animated.sequence animations"), so every leg was started again from
 * JavaScript; while the phone reads a photograph the JS side is busy, and
 * each bar finished its leg and waited. A single timing whose easing goes
 * out and back is looped by the native driver itself — the easing is
 * sampled into frames once, at the start — and needs nothing from
 * JavaScript until it is stopped.
 */
function useWave(ms: number, still: boolean) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (still) { v.setValue(0); return; }
    const loop = Animated.loop(Animated.timing(v, {
      toValue: 1, duration: ms, easing: thereAndBack, useNativeDriver: true,
    }));
    loop.start();
    return () => { loop.stop(); v.setValue(0); };
  }, [ms, still, v]);
  return v;
}

/**
 * The scorer's one glyph, on the Gallery's button and the dialog it
 * opens: three bars, a measurement (owner, 15 Oct 2026, from a board of
 * eighteen). It was the sparkles, which in this app already stand for
 * suggestions — Explore's "for you" order and the planner's button — and
 * a score is the opposite of a suggestion: it is what was measured. The
 * bars are nobody else's glyph here, so they can mean this one thing.
 *
 * `active` sets them moving, which the dialog does while the phone
 * reads; the button's are still. Under Reduce Motion they are always
 * still, the plain three-bar mark.
 *
 * Drawn rather than taken from Ionicons, whose `stats-chart` has four
 * bars of its own proportions — a glyph cannot move bar by bar, and the
 * still one beside the button's word has to be the same drawing the
 * dialog sets moving. Each bar is scaled from its foot (`scaleY` with
 * `transformOrigin` at the bottom) on the native driver, so the motion
 * costs the JS thread nothing while Vision is busy — see `useWave`.
 */
export function ScoreGlyph({ size, color, active = false, testID = 'score-glyph' }: {
  size: number; color: ColorValue; active?: boolean; testID?: string;
}) {
  const still = useReducedMotion() || !active;
  const waves = [useWave(BARS[0].ms, still), useWave(BARS[1].ms, still), useWave(BARS[2].ms, still)];
  // Made once: the dialog renders again at every photo, and a new
  // interpolation each time would hand the native driver a new node to
  // attach mid-loop.
  const scales = useMemo(
    () => BARS.map((b, i) => waves[i].interpolate({ inputRange: [0, 1], outputRange: [b.from, b.to] })),
    // The three values are refs, made once with the component.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  // A fifth of the height wide and a seventh between, so three bars
  // fill the glyph's box the way Ionicons' marks fill theirs.
  const w = Math.max(2, Math.round(size * 0.2));
  const gap = Math.max(1, Math.round(size * 0.14));
  return (
    <View style={[s.glyph, { height: size, gap }]} testID={testID} aria-hidden>
      {scales.map((scale, i) => (
        <Animated.View
          key={i}
          testID={`${testID}-bar`}
          style={{
            width: w, height: size, borderRadius: w / 2, backgroundColor: color,
            transformOrigin: 'bottom',
            transform: [{ scaleY: scale }],
          }}
        />
      ))}
    </View>
  );
}

/** "8.4", the way every one of these writes it — one decimal, always,
 *  so a 7 and a 7.5 line up in a grid. */
export const tenText = (ten: number) => ten.toFixed(1);

/**
 * Bottom-left on a tile. The cover badge has the top-left and the tick
 * of a choice the top-right; a third corner is the one that says
 * nothing until a score exists. The scrim is the cover badge's, so the two read as one
 * family on a photograph of any colour.
 *
 * The number alone. It wore the sparkles glyph of the button that made
 * it for the first build, and on a scored gallery that was the same
 * glyph six times over, every one saying what the one before had said
 * (owner, 15 Oct 2026, from 99/81 Coffee's six). The cover keeps its
 * star because there is one cover; a glyph earns its place by telling
 * one tile from the rest, and on a scored gallery every tile has a
 * score. The button and the dialog still wear the scorer's bars
 * (`ScoreGlyph`), so the number is learned where it was asked for.
 */
export function ScoreBadge({ score, testID }: { score: PhotoScore; testID?: string }) {
  if (score.aesthetic == null) return null;
  return (
    <View style={s.badge} testID={testID}>
      <Text style={s.badgeText}>{tenText(toTen(score.aesthetic))}</Text>
    </View>
  );
}

/**
 * The number in the photo's sheet, out of ten with its word beside it —
 * right of what the photograph shows, where the design puts it (owner, 16
 * Oct 2026). One line, not the word beneath: the head is the kind on one
 * side and the score on the other, and a word on a second line made the
 * score twice the kind's height for one pill (owner, 18 Oct 2026).
 * Nothing for a row with no number.
 */
export function ScoreTen({ score, onDark }: {
  score: PhotoScore;
  /** Over a photograph (the full-screen viewer): the light inks. */
  onDark?: boolean;
}) {
  const { t } = useI18n();
  if (score.aesthetic == null) return null;
  const ten = toTen(score.aesthetic);
  const b = band(ten);
  return (
    <View style={s.tenRow} testID="score-ten">
      <View style={s.tenLine}>
        <Text style={[s.tenBig, onDark && s.tenBigDark]}>{tenText(ten)}</Text>
        <Text style={[s.tenOutOf, onDark && s.inkDark]}>/10</Text>
      </View>
      <View style={[s.bandPill, BAND_PILL[b], onDark && s.bandPillDark]} testID="score-band">
        <Text style={[s.bandText, BAND_TEXT[b], onDark && s.bandTextDark]}>{bandLabel(b, t)}</Text>
      </View>
    </View>
  );
}

/**
 * Why, in a sentence. A row from a scorer this build cannot interpret
 * says nothing here rather than reading its measurements on another
 * scorer's scales — its number, which every scorer shares, is still
 * `ScoreTen`'s to show.
 *
 * Shown in the full-screen viewer, which has no analysis rows. The photo
 * sheet led with it from 16 Oct 2026 and dropped it on 18 Oct: built from
 * the same findings as the rows under it, it said them twice (owner).
 *
 * Who measured is not said here any more. "Analysed on this phone by
 * Apple Vision" is a technical fact a guide does not act on, so it moved
 * into the detailed analysis (`ScoreDetails`), where a reader who opens
 * it has asked for that depth — and where it still tells two scorers'
 * numbers apart once there is more than one.
 */
export function ScoreWhy({ score, onDark }: { score: PhotoScore; onDark?: boolean }) {
  const { t } = useI18n();
  const how = interpreterOf(score.scorer);
  if (score.aesthetic == null || !how) return null;
  return (
    <Text
      style={[s.whyText, onDark && s.whyTextDark]}
      testID="score-why"
    >
      {how.explain(score, t)}
    </Text>
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
          {/* Moving while the phone reads; still once Cancel is in,
              because then it is only finishing the photo in hand. */}
          <ScoreGlyph size={22} color={colors.accent} active={!stopping} testID="scoring-glyph" />
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

/**
 * How a row went, in the ink of its words (owner, 17 Oct 2026). The
 * semantic tones and not the accent: the accent is the look's, and on
 * the standard look it is coral — a "good" in it read as an alarm beside
 * the amber of a "warn". `okInk` and `warnInk` are green and amber on
 * every look, tinted to its ground and held to 4.5:1, so the meaning
 * stays and only the shade moves. The words carry it too: the colour is
 * a second telling, never the only one.
 */
const TONE_INK = {
  good: colors.okInk,
  warn: colors.warnInk,
  plain: colors.textSecondary,
} as const;

/**
 * The bar's fill, the words' tones: green where something measured
 * helped, amber where it held the photograph back, and a neutral grey
 * where it did neither (owner, 17 Oct 2026). Composition passes every
 * check on 88% of the catalog, and its full bar in green read as "good
 * framing" beside the words "no problems found" — the bar saying more
 * than the checks can.
 */
const BAR_FILL = {
  good: colors.okInk,
  warn: colors.warnInk,
  plain: colors.textTertiary,
} as const;

/** The word beside the number, in the same two tones and a neutral:
 *  "very good" and "good" read as the rows that helped do, "weak" as
 *  the ones that held it back, and "fair" as neither. */
const BAND_PILL = {
  excellent: { backgroundColor: colors.okSoft },
  good: { backgroundColor: colors.okSoft },
  fair: { backgroundColor: colors.surfaceGlassStrong },
  weak: { backgroundColor: colors.warnSoft },
} as const;
const BAND_TEXT = {
  excellent: { color: colors.okInk },
  good: { color: colors.okInk },
  fair: { color: colors.textSecondary },
  weak: { color: colors.warnInk },
} as const;

/**
 * Where the number stands: higher than how many of the catalog's
 * photographs — of its own kind, when the photo labels are sure of it and
 * the scorer has a spread for that kind, else of them all. Under the head,
 * beside the number it explains (owner, 18 Oct 2026): 7.3 alone does not
 * say whether that is high, and folded inside the analysis it was a tap
 * away from the number it belonged to. A line of secondary type and not
 * the board's box, which held a sentence this sheet no longer has.
 *
 * The band's word and this line can seem to disagree — "Good", higher
 * than 40% of interiors — and both are true: the band is the absolute
 * scale, this the catalog's interiors, which are good on the whole. The
 * owner saw the pair before choosing it. Nothing where there is no spread
 * to stand in.
 */
export function ScoreStanding({ score, kind }: { score: PhotoScore; kind?: PhotoKind | null }) {
  const { t } = useI18n();
  const how = interpreterOf(score.scorer);
  if (score.aesthetic == null || !how) return null;
  const among = kind ? how.standingAmong(score, kind) : null;
  const standing = how.standing(score);
  if (kind && among !== null) {
    return (
      <Text style={s.standing} testID="score-standing">
        {t(
          `Higher than ${percentText(among)}% of ${kindNoun(kind, t)} photos`,
          `Cao hơn ${percentText(among)}% ảnh ${kindNoun(kind, t)}`,
          `${kindNoun(kind, t)}写真の${percentText(among)}%より高い`,
        )}
      </Text>
    );
  }
  if (standing === null) return null;
  return (
    <Text style={s.standing} testID="score-standing">
      {t(
        `Higher than ${percentText(standing)}% of the catalog's photos`,
        `Cao hơn ${percentText(standing)}% ảnh trong catalog`,
        `カタログの${percentText(standing)}%の写真より高い`,
      )}
    </Text>
  );
}

/**
 * The detailed analysis, folded under the head (design review, 16 Oct
 * 2026): each measured quality with what was measured, and what would
 * have helped. Where the number stands moved up beside it
 * (`ScoreStanding`). `open` is the sheet's to keep, so it stays open as
 * the guide swipes on. Nothing for a scorer this build cannot read, or a
 * row with no number.
 */
export function ScoreDetails({ score, kind, open, onToggle }: {
  score: PhotoScore;
  /** What the photograph shows, when the photo labels are sure of it
   *  (`photoKind`): the source then names both readers. */
  kind?: PhotoKind | null;
  open: boolean;
  onToggle: () => void;
}) {
  const { t } = useI18n();
  const how = interpreterOf(score.scorer);
  if (score.aesthetic == null || !how) return null;
  const rows = how.details(score, t);
  const tips = how.suggestions(score, t);
  return (
    <View style={s.detail} testID="score-detail">
      <PressableScale
        style={s.detailHead}
        scaleTo={0.99}
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        testID="score-detail-toggle"
      >
        <Text style={s.detailTitle}>{t('Detailed analysis', 'Phân tích chi tiết', '詳しい分析')}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textTertiary} />
      </PressableScale>
      {open && (
        <View style={s.detailBody}>
          {rows.map((d) => <DetailRow key={d.key} d={d} />)}
          {tips.length > 0 && (
            <View style={s.tips} testID="score-tips">
              <View style={s.tipsHead}>
                {/* Amber: every tip answers something that held the
                    photograph back, which is what the amber rows say. */}
                <Ionicons name="bulb-outline" size={16} color={colors.warnInk} />
                <Text style={s.tipsTitle}>{t('To improve', 'Gợi ý cải thiện', '改善のヒント')}</Text>
              </View>
              {/* Each under the mark of the quality it would help, so a
                  tip reads back to its row without saying which. */}
              {tips.map((tip) => (
                <View key={tip.text} style={s.tipRow}>
                  <Ionicons name={tip.icon} size={15} color={colors.textSecondary} style={s.tipIcon} />
                  <Text style={s.tip}>{tip.text}</Text>
                </View>
              ))}
            </View>
          )}
          {/* Who measured, last: provenance for the reader who came this
              far, moved here from under the sentence (see `ScoreWhy`).
              The ⓘ marks it as a note about the analysis, not a part of
              it. */}
          <View style={s.sourceRow} testID="score-source">
            <Ionicons name="information-circle-outline" size={14} color={colors.textTertiary} />
            <Text style={s.whySource}>{kind ? bothSources(t) : how.source(t)}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

/**
 * Each row's verdict, one word from the row's own tone: what held the
 * photograph back, what helped, or neither (owner, 18 Oct 2026, from the
 * "Photo Review" board, which drew "Khá" and "Trung bình" there). The
 * board's grades would need cut-offs on the bars that nobody has
 * measured; the tone is already what the findings said.
 */
function verdictOf(tone: Detail['tone'], t: T): string {
  switch (tone) {
    case 'good': return t('Good', 'Tốt', '良い');
    case 'warn': return t('Could improve', 'Cần cải thiện', '改善の余地あり');
    case 'plain': return t('Fine', 'Ổn', '問題なし');
  }
}

/**
 * Three tiers: the name and its verdict, the bar, then what was measured
 * in words (owner, 18 Oct 2026). The words sat on the name's line, right
 * of it, and a long finding — "a little dark, highlights blown out" —
 * wrapped against the name; under the bar it has the row's width.
 */
function DetailRow({ d }: { d: Detail }) {
  const { t } = useI18n();
  return (
    <View style={s.row} testID={`score-detail-${d.key}`}>
      <Ionicons name={d.icon} size={18} color={colors.textSecondary} />
      <View style={s.rowText}>
        <View style={s.rowLine}>
          <Text style={s.rowLabel}>{d.label}</Text>
          <Text style={[s.rowVerdict, { color: TONE_INK[d.tone] }]} testID={`score-detail-${d.key}-verdict`}>{verdictOf(d.tone, t)}</Text>
        </View>
        {/* Every row's bar, in the ink of its words. What fills it is
            the row's to say (`Detail.bar`). */}
        <View style={s.barTrack}>
          <View
            style={[s.barFill, { width: `${Math.round(d.bar * 100)}%`, backgroundColor: BAR_FILL[d.tone] }]}
            testID={`score-detail-${d.key}-bar`}
          />
        </View>
        <Text style={s.rowValue} testID={`score-detail-${d.key}-value`}>{d.value}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  glyph: { flexDirection: 'row', alignItems: 'flex-end' },
  badge: {
    position: 'absolute', bottom: 6, left: 6,
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 6, paddingVertical: 3, borderRadius: radius.pill,
    backgroundColor: 'rgba(6,5,8,0.62)',
  },
  // Tabular figures, so 7.2 and 8.3 are the same width and a row of
  // badges lines up the way the tiles above them do.
  badgeText: { color: onPhoto.text, fontSize: 12, fontWeight: font.semibold, fontVariant: ['tabular-nums'] },

  tenLine: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  tenBig: { color: colors.text, fontSize: 30, fontFamily: display.semibold, fontVariant: ['tabular-nums'] },
  tenOutOf: { color: colors.textTertiary, fontSize: 15, fontWeight: font.medium },
  bandPill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.pill },
  bandText: { fontSize: 13, fontWeight: font.semibold },

  detail: {
    backgroundColor: colors.surfaceCard,
    borderWidth: 1, borderColor: colors.borderGlassSoft, borderRadius: radius.card,
    overflow: 'hidden',
  },
  detailHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: space.cardPadding, paddingVertical: 13,
  },
  detailTitle: { color: colors.text, fontSize: 16, fontWeight: font.semibold },
  detailBody: { paddingHorizontal: space.cardPadding, paddingBottom: space.cardPadding, gap: 12 },
  standing: { color: colors.textSecondary, fontSize: 14 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  rowText: { flex: 1, gap: 6 },
  // The name left, its verdict right; what was measured under the bar.
  rowLine: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  rowLabel: { color: colors.text, fontSize: 15, fontWeight: font.medium },
  rowVerdict: { fontSize: 14, fontWeight: font.semibold },
  rowValue: { color: colors.textSecondary, fontSize: 14, lineHeight: 20 },
  barTrack: { height: 6, borderRadius: 3, backgroundColor: colors.surfaceGlassStrong, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3 },
  // The look's glass, not the accent's wash: a block of its own on any
  // look, without a colour that means something else here.
  tips: { gap: 6, padding: 12, borderRadius: 12, backgroundColor: colors.surfaceGlass },
  tipsHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tipsTitle: { color: colors.text, fontSize: 14, fontWeight: font.semibold },
  tipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  // Down to the first line's centre: 20pt lines, a 15pt glyph.
  tipIcon: { marginTop: 2 },
  tip: { flex: 1, color: colors.textSecondary, fontSize: 14, lineHeight: 20 },
  tenRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  // Over a photograph: `onPhoto`'s inks, and a translucent pill, since
  // the accent wash vanishes into a dark scrim.
  tenBigDark: { color: onPhoto.text },
  inkDark: { color: onPhoto.textSecondary },
  bandPillDark: { backgroundColor: onPhoto.line },
  bandTextDark: { color: onPhoto.text },
  whyTextDark: { color: onPhoto.text },
  whyText: { color: colors.textSecondary, fontSize: 15, lineHeight: 21 },
  sourceRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  whySource: { flexShrink: 1, color: colors.textTertiary, fontSize: 12 },

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
