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
// ── no heading, no count (owner, 20 Nov 2026) ──
//
// The card was headed "Badges" with "3 / 9" across from it. The sheet is
// headed "Achievements" already, and the level's card above it has no
// heading of its own; and how many are held is what the grid shows at a
// glance, in colour against grey. Both came off, on the phone.
//
// ── the line under the grid ──
//
// Nine sentences under nine pictures is a page of small print. So one
// sentence at a time: the badge that was pressed, and until one is, the
// one the reader is nearest to (`nextBadge`) — the bar over the level
// says "two more places", and this says the same kind of thing about
// the badges without being asked.
//
// The sentence alone, centred under the grid (owner, 20 Nov 2026). It
// had the badge's name over it, with "1 / 5" or "Earned" across: the
// name is under the tinted cell already, which says which badge the
// sentence is about, and the owner found the count more detail than the
// sheet needs — the sentence says what it takes, the picture whether it
// is held.
//
// ── the dot ──
//
// On a badge earned since the sheet was last closed, in the accent. The
// tab bar and the "Lv" pill led here with the same mark from 17 to 20
// Nov 2026; under one bell (owner) this is the only place a new badge is
// marked, the banner having said so as it was earned. It goes when the
// sheet closes (`useRewards().closed`), not when it opens: opening is
// when the reader is looking for which one is new.

import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { sheetBody } from './ActionSheet';
import { BADGE_IMAGES } from './badgeImages';
import { PressableScale } from './ui';
import { BADGES, badgeHow, badgeName, nextBadge, type BadgeId } from '../lib/badges';
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

/** What earns the badge the grid has tinted. */
function About({ id }: { id: BadgeId }) {
  const { t } = useI18n();
  return <Text style={s.how} testID="badge-about">{badgeHow(id, t)}</Text>;
}

const s = StyleSheet.create({
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
  how: { color: colors.textSecondary, fontSize: 14, lineHeight: 19, textAlign: 'center' },
});
