// The map's place cards as a row to swipe (owner, 26 Nov 2026).
//
// One card was all the strip held, and the next place nearby was a pin to
// find and tap. Now the strip is a row of the places round the tapped one
// (`lib/mapDeck`), and a swipe moves to the next: left for the one after,
// right for the one before, a rubber band at either end, no loop.
//
// ── how it is found ──
//
// Nothing says "swipe" in words. The card is narrower than the screen so
// the next one shows at its edge (12 left, 8 between, the rest the next
// card's corner), and the first time a deck has more than one place the
// row nudges a few points and comes back (`nudge`), once for the device
// (`stored`). A deck of one has neither: an edge with nothing behind it
// would be a lie.
//
// ── how it stays quick ──
//
// There is no network on a swipe: the catalogue is already in memory.
// What can be slow is a photograph, so the covers of the cards ahead are
// fetched into the image cache when the deck is built and as the reader
// moves (`ahead`), and `FlatList` keeps only the cards near the viewport
// mounted — three at a time, not twenty. No smaller rendition of a cover
// exists (`photo_uri` is the one file), so what is fetched is that file;
// the cards decode it at their own size.
//
// Not measured on a device: that the snap feels right and that the peek
// reads at 320 pt. Both are for a phone in hand.

import React, { useEffect, useRef } from 'react';
import { FlatList, type NativeScrollEvent, type NativeSyntheticEvent, useWindowDimensions, View } from 'react-native';
import { Image } from 'expo-image';
import { coverOf } from '../lib/place';
import type { Place } from '../lib/types';
import { oneOf, useStored } from '../lib/stored';
import { useReducedMotion } from './ui';

/** Left of the first card, and between cards. */
const LEFT = 12;
const GAP = 8;
/** What shows of the next card: the screen less the card, the left margin
 *  and the gap. 32 pt on a 320 pt phone, where it was drawn. */
const PEEK = 32;
/** How far the first-time nudge pulls the row, and how long it takes. */
const NUDGE = 36;
const NUDGE_MS = 320;
/** Cards ahead whose cover is fetched. */
const AHEAD = 2;

const NUDGED = oneOf('0', '1');

export default function MapDeck({ places, selectedSlug, onSwipe, renderCard }: {
  /** The deck, in order: the tapped place first. */
  places: readonly Place[];
  selectedSlug: string;
  /** The reader swiped to this place. */
  onSwipe: (slug: string) => void;
  renderCard: (place: Place, swipe: { next?: () => void; previous?: () => void }) => React.ReactElement;
}) {
  const { width } = useWindowDimensions();
  const still = useReducedMotion();
  const card = width - LEFT - GAP - PEEK;
  const step = card + GAP;
  const list = useRef<FlatList<Place>>(null);
  const index = Math.max(0, places.findIndex((p) => p.slug === selectedSlug));

  // The covers of this card and the ones ahead. A failure is a card that
  // loads its photograph when it is shown, as it did before.
  useEffect(() => {
    const urls = places.slice(index, index + 1 + AHEAD).map((p) => coverOf(p)?.photo_uri).filter((u): u is string => !!u);
    if (urls.length) Image.prefetch(urls, 'memory-disk').catch(() => {});
  }, [places, index]);

  const [nudged, markNudged, origin] = useStored('map_deck_nudged', '0', NUDGED);
  useEffect(() => {
    if (origin === 'reading' || nudged === '1' || places.length < 2) return;
    markNudged('1');
    if (still) return;
    // After the strip has risen (220 ms), so the nudge is seen and not
    // spent behind its own arrival.
    const out = setTimeout(() => list.current?.scrollToOffset({ offset: NUDGE, animated: true }), 300);
    const back = setTimeout(() => list.current?.scrollToOffset({ offset: 0, animated: true }), 300 + NUDGE_MS);
    return () => { clearTimeout(out); clearTimeout(back); };
  }, [origin, nudged, places.length, still, markNudged]);

  const go = (i: number) => {
    list.current?.scrollToOffset({ offset: i * step, animated: true });
    onSwipe(places[i].slug);
  };
  const settle = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const at = Math.min(Math.max(Math.round(e.nativeEvent.contentOffset.x / step), 0), places.length - 1);
    if (places[at].slug !== selectedSlug) onSwipe(places[at].slug);
  };

  return (
    <FlatList
      ref={list}
      testID="map-deck"
      horizontal
      data={places as Place[]}
      keyExtractor={(p) => p.slug}
      showsHorizontalScrollIndicator={false}
      snapToInterval={step}
      snapToAlignment="start"
      decelerationRate="fast"
      disableIntervalMomentum
      windowSize={3}
      initialNumToRender={2}
      maxToRenderPerBatch={2}
      getItemLayout={(_, i) => ({ length: step, offset: i * step, index: i })}
      contentContainerStyle={{ paddingLeft: LEFT, paddingRight: width - LEFT - card }}
      onMomentumScrollEnd={settle}
      renderItem={({ item, index: i }) => (
        <View style={{ width: card, marginRight: GAP }}>
          {renderCard(item, {
            next: i < places.length - 1 ? () => go(i + 1) : undefined,
            previous: i > 0 ? () => go(i - 1) : undefined,
          })}
        </View>
      )}
    />
  );
}
