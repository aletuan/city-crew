// The page marks a carousel floats over its pictures: one pill, bottom
// right, the page in hand drawn as a bar.
//
// Four carousels drew this and no two drew it the same — bottom right on
// the place's hero, bottom centre on the trip's card and the plan card,
// a count in the top corner on the editor's stop — and each said in a
// comment that it matched the hero. One component, so "the same" is a
// fact about the code rather than a hope about four files.
//
// The hero's decisions, kept, with their reasons:
//
// - **Right, not centre.** The bottom edge of a photograph then carries
//   its marks at one end, and the middle — where a photographer puts the
//   subject — is given back to the picture. A card's picture is smaller
//   than the hero's, which makes the middle dearer, not cheaper.
// - **The one in hand is a bar, not a bigger dot.** Six photographs is
//   six marks 7pt across, and telling which of them was a point wider
//   meant looking rather than glancing — the thing a page indicator
//   exists to spare you. Length reads at a distance where diameter does
//   not. Same height as the rest, so the row keeps one baseline; and
//   since exactly one is ever in hand the strip's total width never
//   changes as the reader pages, which is what would have made it twitch.
// - **A window of seven** (`dotWindow`), so a long day gets a fixed strip
//   instead of a row that runs off the picture.
// - **Nothing for a single page.** There is nowhere to swipe to, and a
//   lone dot is a control that promises one.
//
// The pill's scrim is the lightest of the three the hero wears
// (0.45, under the 44pt discs' 0.55 and the labelled counter's 0.58),
// because it holds no type.

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { dotWindow } from '../lib/format';
import { onPhoto, radius } from '../theme';

export default function PageDots({ count, page, right = 12, bottom = 12, testID }: {
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
      {dotWindow(count, page).map((i) => (
        <View key={i} style={[s.dot, i === page && s.dotOn]} />
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  pill: {
    position: 'absolute',
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: 'rgba(10,11,10,0.45)', borderRadius: radius.pill,
    paddingHorizontal: 11, paddingVertical: 8,
  },
  dot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: 'rgba(255,255,255,0.38)' },
  dotOn: { width: 17, height: 7, borderRadius: 3.5, backgroundColor: onPhoto.text },
});
