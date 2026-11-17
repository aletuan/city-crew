// The picture on your own profile, with its ring and the level's pill on
// it — and the sheet that says what the level is.
//
// ── a badge explains itself in a sheet (owner, 16 Nov 2026) ──
//
// The role's disc had always answered a press with a system alert. The
// level's pill answered with nothing until that day, then with an alert
// of its own for an hour — and the owner, seeing it on the phone, asked
// for the level drawn rather than written: its title, a bar, what the
// next level takes, the rule. An alert cannot draw a bar, wears iOS's
// grey whatever look the reader chose, and is the system's way of
// stopping someone for a thing that matters; a level is a note.
//
// So a sheet, in the reader's look, and for both badges: two marks that
// open two kinds of thing is one of them a surprise.
//
// A sheet from the bottom, not a bubble hung from the pill. A popover
// was what the owner was first shown, and it is the tidier picture — but
// the collection page's ⋯ was a popover until 13 Nov 2026 and was made a
// sheet so that every pop-up in the app rises and is closed the same way
// (`CollectionDetailScreen`). `ActionSheet` is that sheet: its backdrop,
// its spring, its grabber, and the header card naming what it is about.
//
// The bar is the ring's reading, not the count's — `levelSteps`.
//
// ── the role's disc left the picture (owner, 17 Nov 2026) ──
//
// It lay on the ring's top-right corner, and this file held one sheet
// for the two badges. It stands after the name now (`HeroName`, and
// `components/RoleBadge` for why), and took its sheet with it: the same
// `ActionSheet`, opened from where the disc is. What is on the picture
// is the level's alone — a ring and a pill that say one thing.
//
// ── the badges, under the level (owner, 17 Nov 2026) ──
//
// Nine badges came to stand beside the level (`lib/badges` for what they
// are and why the level stays). The owner weighed a card of their own on
// this tab, as the reference drew one, and kept them in this sheet: the
// tab is long already, and "Lv" is where a reader asks how they are
// doing. So the sheet is the level's card and then the badges'
// (`BadgeShelf`), in a scroll for the phone too short for both.
//
// The pill wears a dot while a badge is new, and the banner that
// announced it opens this sheet from wherever it was pressed
// (`useRewards().wanted`): the sheet is here and nowhere else, so the
// banner asks and this answers.
//
// ── out of `AccountProfile` ──
//
// The ring was drawn there, and its function is at its ceiling
// (`oversize.js`); a sheet's state and body had nowhere to go. They
// moved here together, and the ceiling came down by what left.

import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import ActionSheet, { sheetBody, sheetTitleRow, sheetTitleText } from '../../components/ActionSheet';
import AvatarPicker from '../../components/AvatarPicker';
import BadgeShelf from '../../components/BadgeShelf';
import EngagementRing from '../../components/EngagementRing';
import { Glyph } from '../../components/ui/glyph';
import { useI18n } from '../../lib/i18n';
import { levelFromSaves, levelSteps, levelWords } from '../../lib/level';
import { useRewards } from '../../lib/rewards';
import { colors, font } from '../../theme';
import { s } from './styles';

export function HeroFace({ saved }: {
  /** The distinct places the reader keeps — what the level is made of. */
  saved: number;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const { height } = useWindowDimensions();
  const { unseen, wanted, opened, closed } = useRewards();
  const show = useCallback(() => { setOpen(true); opened(); }, [opened]);
  const close = () => { setOpen(false); closed(); };
  // The banner was pressed: it has brought the reader to this tab, and
  // asks for the sheet. Answered here, mounted before the press or after.
  useEffect(() => { if (wanted) show(); }, [wanted, show]);
  const { level, progress } = levelFromSaves(saved);

  return (
    <>
      {/* No camera badge here: the level badge takes that corner, and
          Edit profile shows the same picker with its badge intact. */}
      <View style={s.avatarBox} testID="avatar-box">
        <EngagementRing size={88} level={level} progress={progress} fresh={unseen.length > 0} onExplain={show}>
          <AvatarPicker showCamera={false} />
        </EngagementRing>
      </View>

      <ActionSheet
        visible={open}
        onClose={close}
        header={(
          // What the sheet is about, on nothing, as a sheet's title is:
          // the level's card and the badges' are under it, and it is
          // neither's — see `Level`.
          <View style={sheetTitleRow} testID="badge-sheet-head">
            <Glyph name="ribbon-outline" size={20} color={colors.textSecondary} />
            <Text style={sheetTitleText} accessibilityRole="header">
              {t('Achievements', 'Thành tích', '実績', '成就', '成就')}
            </Text>
          </View>
        )}
      >
        {/* Two cards, and a scroll for the phone they do not fit.
            `ROOM` of the screen is theirs; the rest is the header, and
            the page left showing above to close it by. */}
        <ScrollView
          style={{ maxHeight: Math.round(height * ROOM) }}
          contentContainerStyle={h.cards}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
        <Level saved={saved} />
        <BadgeShelf />
        </ScrollView>
      </ActionSheet>
    </>
  );
}

/**
 * The level's card: a mark, the level, what the next one takes, how far
 * through it — and under them the bar.
 *
 * Laid out from the owner's reference (17 Nov 2026), which drew it as a
 * title, one line and a bar, where this had been a bar over two
 * sentences with the level itself up in the sheet's header:
 *
 *   - the level is this card's title, since it is this card that is
 *     about it; the header says what the whole sheet is, now that the
 *     badges are half of it;
 *   - one sentence, not two (`levelWords` for what went and why);
 *   - the steps beside the title, where the header had them: the bar's
 *     figure, read;
 *   - the bar last, across the card, under everything it measures.
 *
 * The mark is a trophy on the accent's tint — the look's own, where the
 * reference's was gold whatever the theme — and the banner that says a
 * level was reached wears the same one (`RewardBanner`).
 */
export function Level({ saved }: { saved: number }) {
  const { t } = useI18n();
  const words = levelWords(saved, t);
  const steps = levelSteps(saved);
  return (
    <View style={sheetBody} testID="badge-sheet-body">
      <View style={h.level}>
        <View style={h.mark}>
          <Glyph name="trophy-outline" size={22} color={colors.accent} />
        </View>
        <View style={h.words}>
          <View style={h.titleRow}>
            <Text style={h.title} numberOfLines={1} accessibilityRole="header">{words.title}</Text>
            <View style={h.steps}>
              <Text style={h.stepsText} testID="level-steps">{`${steps.done} / ${steps.of}`}</Text>
            </View>
          </View>
          <Text style={h.next}>{words.next}</Text>
        </View>
      </View>
      <View
        style={h.track}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: steps.of, now: steps.done }}
        // Said, too: a bar's value alone is read as a percentage.
        accessibilityLabel={t(
          `${steps.done} of ${steps.of} places toward the next level`,
          `${steps.done} trên ${steps.of} địa điểm để lên level tiếp theo`,
          `次のレベルまで${steps.of}件中${steps.done}件`,
          `距下一级：${steps.of} 个地点中的 ${steps.done} 个`, `距下一級：${steps.of} 個地點中的 ${steps.done} 個`,
        )}
        testID="level-bar"
      >
        <View style={[h.fill, { width: `${(steps.done / steps.of) * 100}%` }]} testID="level-bar-fill" />
      </View>
    </View>
  );
}

/** The bar's thickness. 8: the ring it repeats is a 4pt stroke seen from
 *  a hand's length on an 88pt picture; alone on a card the width of the
 *  phone, 4 is a hairline and 8 is a bar. */
const BAR = 8;

/** How much of the screen's height the two cards may take before they
 *  scroll: 0.7. Drawn in a web build with the real sheet, the two are
 *  550 tall at 393 wide (the level's 99, the gap, the badges' 439). On
 *  an 852pt phone 0.7 is 596, so nothing scrolls; on a 667pt one it is
 *  467, which leaves the header (about 70 with the grabber) and 100 of
 *  page above the sheet to close it by, and the third row of badges is
 *  a scroll away. Not yet seen on a phone. */
const ROOM = 0.7;

const h = StyleSheet.create({
  // The cards' own gap, as between the header and the first.
  cards: { gap: 12 },
  // The steps, on a tint of the accent — the reader's look, as the
  // Statistics well on the Activity page is. A count's pill in shape.
  steps: {
    minWidth: 32, height: 24, paddingHorizontal: 10, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentSoft,
  },
  stepsText: { color: colors.accent, fontSize: 13, fontWeight: font.semibold, fontVariant: ['tabular-nums'] },
  // The accent on its own tint: both follow the look the reader chose.
  track: { height: BAR, borderRadius: BAR / 2, backgroundColor: colors.accentSoft, overflow: 'hidden' },
  fill: { height: BAR, borderRadius: BAR / 2, backgroundColor: colors.accent },
  // The mark, then the words; the steps ride the title's line, so the
  // sentence under it has the words' whole width and stays on one line
  // where it can ("Lưu thêm 2 địa điểm để đạt Level 19." is 36
  // characters at 14).
  level: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  // 44, the banner's mark: the two lines' height beside it.
  mark: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.accentSoft,
  },
  words: { flex: 1, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  // A step over the badges' heading (16) in the card below: the level is
  // the first thing the sheet is asked about.
  title: { flexShrink: 1, color: colors.text, fontSize: 18, lineHeight: 24, fontWeight: font.semibold },
  next: { color: colors.textSecondary, fontSize: 14, lineHeight: 19 },
});
