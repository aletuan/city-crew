// Where a carousel is: "2 / 4", in one pill at the bottom right of the
// pictures it floats over.
//
// ── a count, not dots ──
//
// This drew a row of dots, the page in hand as a bar, for every carousel
// in the app, and before that a "1 / 6" counter sat in the hero's other
// corner; the counter went on 8 October 2026 because it said what the
// dots said. On 10 October the owner's reference put the count back and
// took the dots away instead, and the count is the one that does the
// job at a glance:
//
// - **It says the total.** Six dots 7pt across were six things to count;
//   "2 / 6" is read, not counted. The dots needed a window of seven
//   (`dotWindow`) for a long day, past which they stopped saying the
//   total at all.
// - **It is one size.** The strip grew a dot per photograph, from 37pt for
//   two to 91 for seven, and that width is what the kinds on the place's
//   cover had to be measured against. "2 / 4" and "12 / 12" differ by a
//   digit's width, and the digits are tabular so paging never moves the
//   slash.
// - **It is not read aloud.** Each photograph already names itself to
//   VoiceOver ("Photo 2 of 4"), as it did under the dots.
//
// Kept from the dots, with their reasons:
//
// - **Right, not centre.** The bottom edge of a photograph carries its
//   marks at one end, and the middle — where a photographer puts the
//   subject — is given back to the picture.
// - **Nothing for a single page.** There is nowhere to swipe to.
// - **One component.** Four carousels once drew four different marks,
//   each sure in a comment that it matched the hero.
//
// The pill is the labelled pill's glass (0.58, as the rating pill on a
// card and the kinds on the cover) rather than the dots' lighter 0.45:
// it holds type now. 13pt semibold, 16 to the line, 6 above and below:
// 28pt tall, which the hero's credit and the kinds are placed against
// (`PAGE_COUNT_H`).

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { font, onPhoto, radius } from '../theme';

/** The pill's height: 16pt of line and 6 above and below. */
export const PAGE_COUNT_H = 28;

export default function PageCount({ count, page, right = 12, bottom = 12, testID }: {
  count: number;
  /** The page on screen, zero-based. */
  page: number;
  /** The corner's inset. 12 on a card, whose picture already sits inside
   *  a padded page; the hero passes the page margin, since its picture
   *  runs to the screen's edge. */
  right?: number;
  bottom?: number;
  testID?: string;
}) {
  if (count < 2) return null;
  return (
    <View style={[s.pill, { right, bottom }]} aria-hidden testID={testID}>
      <Text style={s.text}>{`${page + 1} / ${count}`}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  pill: {
    position: 'absolute', height: PAGE_COUNT_H, justifyContent: 'center',
    backgroundColor: 'rgba(10,11,10,0.58)', borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth, borderColor: onPhoto.line,
    paddingHorizontal: 11,
  },
  text: {
    color: onPhoto.text, fontSize: 13, lineHeight: 16, fontWeight: font.semibold,
    fontVariant: ['tabular-nums'],
  },
});
