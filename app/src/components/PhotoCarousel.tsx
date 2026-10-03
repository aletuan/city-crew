// The paging under every photo carousel in the app.
//
// Three carousels page across photographs — the place's hero
// (`PlaceDetailScreen`), the stops of an outing (`StopGallery`), a stop's
// own pictures on the editor's card (`StopHero`) — and until 3 Oct 2026
// each wrote the same ScrollView, the same momentum-end arithmetic, the
// same credit for the page on screen, beside the same `PageDots`. Two of
// the three clamped the page; the hero did not, and a momentum end
// reported past the last photograph could index one that was not there.
// This is the one copy. What a page *is* stays with the caller, as
// `renderPage`: a plain picture, a picture that lifts on a hold, a grey
// panel with an emoji where a stop has no photograph.
//
// ── controlled ──
//
// The page is the caller's: two of the three screens need it (the trip
// marks the row its picture is on, the hero prints a counter), and the
// third keeps a state of its own and hands it down. One shape, not two.
//
// ── width ──
//
// Measured from the container unless given. A card's picture is as wide
// as the card and the card is as wide as the page allows, so it is
// measured; the hero is as wide as the screen and as tall as the screen
// says, so it is given both. The page style hands back whichever pair
// decides the picture's shape, and the caller spreads it on its image.
//
// ── where the marks and the credit sit ──
//
// The marks are `PageDots`', in the corner it documents; the inset is
// the caller's, since a card's picture sits inside a padded page and the
// hero's runs to the screen's edge. The credit is bottom left by default
// — the marks have the right corner — and the hero moves it to the middle
// for a reason it gives. Overlays a screen lays over the picture (the
// hero's scrims, its floating buttons, its counter) go between the pages
// and the marks, so the marks stay on top of the scrim they were sized
// against.

import React, { useState } from 'react';
import {
  ScrollView, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle,
} from 'react-native';
import { useFlag } from '../lib/useFlag';
import { onPhoto } from '../theme';
import PageDots from './PageDots';

/** The pair that decides a page's shape — spread onto the caller's picture. */
export type PageSize = { width: number; height: number } | { width: number; aspectRatio: number };

export default function PhotoCarousel<T>({
  pages, page, onPage, renderPage, attributionOf, width, height, aspectRatio,
  dotsRight, dotsBottom, attrStyle, scrollKey, children, style, testID,
}: {
  pages: readonly T[];
  /** The page on screen, zero-based, held by the caller. */
  page: number;
  onPage: (i: number) => void;
  /** One page, at the size the carousel decided. Keyed by the caller. */
  renderPage: (item: T, i: number, size: PageSize) => React.ReactNode;
  /** The credit a page owes, printed for the page on screen while the
   *  attribution switch is on. */
  attributionOf: (item: T) => string | null | undefined;
  /** Given, or measured from the container when absent. */
  width?: number;
  /** One of the two decides the height; `height` wins when both are given. */
  height?: number;
  aspectRatio?: number;
  dotsRight?: number;
  dotsBottom?: number;
  /** The credit's whole style, when the default corner is not the one —
   *  it replaces the default rather than merging over it, so a caller
   *  that centres the line does not inherit `left: 12`. */
  attrStyle?: StyleProp<TextStyle>;
  /** Remounts the scroll view — the hero does this when the cover changes
   *  under it, so the strip starts again at the new first page. */
  scrollKey?: string;
  /** Overlays between the pages and the marks. */
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const [measured, setMeasured] = useState(0);
  const credit = useFlag('photo_attribution');
  if (!pages.length) return null;
  const w = width ?? measured;
  const size: PageSize = height != null ? { width: w, height } : { width: w, aspectRatio: aspectRatio ?? 1 };
  const attr = credit ? attributionOf(pages[page]) : null;

  return (
    <View
      style={style}
      onLayout={width == null ? (e) => setMeasured(e.nativeEvent.layout.width) : undefined}
      testID={testID}
    >
      <ScrollView
        key={scrollKey}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        // Clamped, so a momentum end reported past the last page cannot
        // name a page that is not there; rounded to the nearer page, as
        // the scroll view itself settles.
        onMomentumScrollEnd={(e) => onPage(Math.min(
          pages.length - 1,
          Math.max(0, Math.round(e.nativeEvent.contentOffset.x / w)),
        ))}
      >
        {pages.map((item, i) => renderPage(item, i, size))}
      </ScrollView>
      {children}
      {attr ? <Text style={attrStyle ?? s.attr} numberOfLines={1}>{attr}</Text> : null}
      <PageDots count={pages.length} page={page} right={dotsRight} bottom={dotsBottom} testID={testID ? `${testID}-dots` : undefined} />
    </View>
  );
}

const s = StyleSheet.create({
  // Required wherever the photo is shown; read from the page on screen.
  // Bottom left: the page marks have the right-hand corner on every card.
  attr: {
    position: 'absolute', left: 12, bottom: 12, maxWidth: '50%',
    fontSize: 9, color: onPhoto.text, opacity: 0.55,
    textShadowColor: 'rgba(0,0,0,0.7)', textShadowRadius: 3,
  },
});
