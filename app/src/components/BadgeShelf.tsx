// The nine badges, as the sheet a press on "Lv" opens draws them under
// the level: three rows of three, and a line about one of them.
//
// ── all nine, always ──
//
// The ones not yet earned are drawn too, in grey, with what each takes.
// A shelf that showed only what is held would be a record and nothing
// else; what is not held yet is the part that says what there is to do
// here, which is what the badges are for (`lib/badges`).
//
// ── the line under the grid ──
//
// Nine sentences under nine pictures is a page of small print. So one
// sentence at a time: the badge that was pressed, and until one is, the
// one the reader is nearest to (`nextBadge`) — the bar over the level
// says "two more places", and this says the same kind of thing about
// the badges without being asked.
//
// ── the dot ──
//
// On a badge earned since the sheet was last closed, in the accent, the
// mark the tab bar and the "Lv" pill led here with. It goes when the
// sheet closes (`useRewards().closed`), not when it opens: opening is
// when the reader is looking for which one is new.

import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { sheetBody } from './ActionSheet';
import { BADGE_IMAGES } from './badgeImages';
import { PressableScale } from './ui';
import { BADGES, badgeHow, badgeName, badgeSteps, nextBadge, type BadgeId } from '../lib/badges';
import { useI18n } from '../lib/i18n';
import { useRewards } from '../lib/rewards';
import { colors, font } from '../theme';

/** A badge's picture in the grid: 56, so three sit across the card of a
 *  375pt phone (99pt a cell) with room either side for the name under
 *  each. Drawn in a web build at 393 and 375 wide, with the real sheet
 *  round it; not yet seen on a phone. */
export const BADGE = 56;
/** How much of the grey picture shows. At all of it the nine read as
 *  nine held, some in black and white; at 0.45, tried first, the ones on
 *  a light page were hard to make out. Compared side by side on the
 *  paper, charcoal and navy grounds. */
const OFF = 0.6;
/** A name's line under its picture. */
const NAME_LINE = 15;

export default function BadgeShelf() {
  const { t } = useI18n();
  const { facts, earned, unseen } = useRewards();
  const [picked, setPicked] = useState<BadgeId | null>(null);
  const about = picked ?? nextBadge(facts);

  return (
    <View style={sheetBody} testID="badge-shelf">
      <View style={s.head}>
        <Text style={s.title} accessibilityRole="header">{t('Badges', 'Huy hiệu', 'バッジ', '徽章', '徽章')}</Text>
        <Text style={s.count} testID="badge-count">{`${earned.length} / ${BADGES.length}`}</Text>
      </View>
      <View style={s.grid}>
        {BADGES.map((id) => {
          const has = earned.includes(id);
          const name = badgeName(id, t);
          return (
            <PressableScale
              key={id}
              scaleTo={0.94}
              haptic="selection"
              style={s.cell}
              contentStyle={[s.cellIn, about === id && s.cellPicked]}
              onPress={() => setPicked(id)}
              accessibilityRole="button"
              accessibilityState={{ selected: about === id }}
              // Said whole: the picture is the only thing that shows
              // whether it is held.
              accessibilityLabel={has
                ? t(`${name}, earned`, `${name}, đã đạt`, `${name}、獲得済み`, `${name}，已获得`, `${name}，已獲得`)
                : t(`${name}, not yet earned`, `${name}, chưa đạt`, `${name}、未獲得`, `${name}，尚未获得`, `${name}，尚未獲得`)}
              testID={`badge-${id}`}
            >
              <View>
                <Image
                  source={has ? BADGE_IMAGES[id].on : BADGE_IMAGES[id].off}
                  style={[s.picture, !has && s.off]}
                  contentFit="contain"
                  accessible={false}
                />
                {unseen.includes(id) ? <View style={s.dot} testID={`badge-new-${id}`} /> : null}
              </View>
              <Text style={[s.name, !has && s.nameOff]} numberOfLines={2}>{name}</Text>
            </PressableScale>
          );
        })}
      </View>
      {about ? <About id={about} /> : null}
    </View>
  );
}

/** One badge, said: its name, how far along, and what earns it. */
function About({ id }: { id: BadgeId }) {
  const { t } = useI18n();
  const { facts, earned } = useRewards();
  const has = earned.includes(id);
  const { done, of } = badgeSteps(id, facts);
  return (
    <View style={s.about} testID="badge-about">
      <View style={s.aboutHead}>
        <Text style={s.aboutName} numberOfLines={1}>{badgeName(id, t)}</Text>
        {/* A first has no "0 / 1" worth reading; the two that count say
            how many. */}
        {has
          ? <Text style={[s.steps, s.stepsDone]} testID="badge-steps">{t('Earned', 'Đã đạt', '獲得済み', '已获得', '已獲得')}</Text>
          : of > 1 ? <Text style={s.steps} testID="badge-steps">{`${done} / ${of}`}</Text> : null}
      </View>
      <Text style={s.how}>{badgeHow(id, t)}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  // The card's own heading: a step under the level's, in the card above
  // (`HeroFace`'s `title`, 18), which is the first thing the sheet is
  // asked about.
  title: { color: colors.text, fontSize: 16, lineHeight: 22, fontWeight: font.semibold },
  count: { color: colors.textTertiary, fontSize: 13, fontWeight: font.semibold, fontVariant: ['tabular-nums'] },
  // Three across. Each cell is a third of the row, so the columns line
  // up whatever the names' lengths.
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 6 },
  cell: { width: '33.333%' },
  cellIn: { alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 2, borderRadius: 14 },
  // The badge the line below is about: the accent's tint, as the steps'
  // pill over the level is.
  cellPicked: { backgroundColor: colors.accentSoft },
  picture: { width: BADGE, height: BADGE },
  off: { opacity: OFF },
  // The tab bar's mark and its size, at the picture's shoulder. No ring
  // of card round it: a border in a colour that follows the look can
  // come back stale after a change of look (`EngagementRing`), and on a
  // pastel rim the accent parts from the picture without one.
  dot: {
    position: 'absolute', top: 1, right: 1, width: 9, height: 9, borderRadius: 4.5,
    backgroundColor: colors.accent,
  },
  // Two lines' room for every name, whether it takes them: in that web
  // build "Người tuyển chọn" ran to a second line at 12 in a 105pt cell
  // and its row stood 15 taller than the two under it. A name cut to fit
  // one line was the other way, and "Người tuyển…" names nothing.
  name: {
    minHeight: NAME_LINE * 2,
    color: colors.text, fontSize: 12, lineHeight: NAME_LINE, fontWeight: font.medium, textAlign: 'center',
  },
  nameOff: { color: colors.textTertiary },
  about: { gap: 2 },
  aboutHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  aboutName: { flexShrink: 1, color: colors.text, fontSize: 15, lineHeight: 20, fontWeight: font.semibold },
  steps: { color: colors.textTertiary, fontSize: 13, fontWeight: font.semibold, fontVariant: ['tabular-nums'] },
  stepsDone: { color: colors.ok },
  how: { color: colors.textSecondary, fontSize: 14, lineHeight: 19 },
});
