// The picture at the top of a stop's card on the plan editor: the place's
// own photographs, one page each, with the count in a corner.
//
// Not `StopGallery`. That carousel pages across the *stops* of an outing —
// page `i` is stop `i` — and it belongs to screens that show the outing as
// one card. The editor lists the stops as cards already, so a band of all
// of them above the list would say the list twice. Here each card wears
// its own place, and the pages are that place's photographs, in the order
// its detail screen opens them.
//
// The page marks are `PageDots`, the same pill every carousel in the app
// wears, in the same corner. This band opened with a count in the top
// corner instead, on the argument that a 66pt band had no bottom edge to
// spare for dots; at 148pt it has, and a stop that marked its pages
// differently from the trip the plan becomes was one more thing to
// learn.
//
// ── how tall ──
//
// The reference draws the band at 66pt (767×158 px in a 942 px-wide
// capture of a 393pt phone, 4.85:1), and at that height a bar's interior
// was a stripe of lit shelving with the people cropped at the shoulder.
// The owner asked for more picture. 2:1 — 148pt on the 295pt a card has
// beside the rail — is where the photographs in the catalog, shot in
// landscape at 4:3 and 16:9, keep both the room and the people in it;
// 16:9 (166pt) showed no more of either and cost a stop's whole body
// below the fold on a 667pt screen. The options card, where three plans
// stack to be compared, stays a step shorter (see `PlanOptionsScreen`).
//
// Nothing at all for a place without a photograph. `StopGallery` draws an
// emoji on grey for such a stop because its index has to hold the stop's
// place in a row; this card says the name underneath, and a grey panel
// above it would be 66pt of nothing between the number and the name.

import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { photosOf } from '../lib/place';
import type { Place } from '../lib/types';
import { useFlag } from '../lib/useFlag';
import { colors, onPhoto } from '../theme';
import PageDots from './PageDots';
import { LIFT_AFTER_MS } from './useListDrag';

/** Width over height of the band — see "how tall" above. */
export const HERO_ASPECT = 2;

export default function StopHero({ place, onPress, onHold, onRelease, testID }: {
  place: Place;
  /**
   * The same open the card's identity band has. The pictures cannot sit
   * inside that pressable — a horizontal swipe and a press on one touch
   * are two responders arguing over a finger, and `StopGallery` records
   * that on the phone the swipe lost — so the band stands above the
   * pressable and takes its own tap. The pages are not announced as
   * buttons: the band below already is, once, with the place's name.
   */
  onPress: () => void;
  /**
   * The hold completed on a page, with the finger at `pageY`: the card's
   * lift, when the card can be moved. The picture is the biggest thing on
   * the card and the first thing a thumb lands on, so a hold that only
   * worked on the name under it would feel broken on the picture.
   */
  onHold?: (pageY: number) => void;
  /** The page let go of the touch — see `useListDrag`'s `onRelease`. */
  onRelease?: () => void;
  testID?: string;
}) {
  const photos = photosOf(place);
  const [width, setWidth] = useState(0);
  const [page, setPage] = useState(0);
  const credit = useFlag('photo_attribution');
  if (!photos.length) return null;

  // The credit belongs to the picture on screen, read from the page rather
  // than printed once — one photograph visible, one credit owed.
  const attr = credit ? photos[page].attribution_name : null;

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} testID={testID}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        // Clamped, so a momentum end reported past the last page cannot
        // index a photograph that is not there.
        onMomentumScrollEnd={(e) => setPage(Math.min(
          photos.length - 1,
          Math.max(0, Math.round(e.nativeEvent.contentOffset.x / width)),
        ))}
      >
        {photos.map((ph, i) => (
          <Pressable
            key={`shot-${i}`}
            onPress={onPress}
            onLongPress={onHold ? (e) => onHold(e.nativeEvent.pageY) : undefined}
            delayLongPress={LIFT_AFTER_MS}
            onPressOut={onRelease}
            accessible={false}
            testID="hero-page"
          >
            <Image
              source={{ uri: ph.photo_uri }}
              style={[s.shot, { width, aspectRatio: HERO_ASPECT }]}
              contentFit="cover"
              transition={200}
            />
          </Pressable>
        ))}
      </ScrollView>
      {attr ? <Text style={s.attr} numberOfLines={1}>{attr}</Text> : null}
      <PageDots count={photos.length} page={page} testID="hero-dots" />
    </View>
  );
}

const s = StyleSheet.create({
  shot: { backgroundColor: colors.surfaceGlass },
  // The same credit `StopGallery` prints, in the same corner, so one
  // photograph is signed the same way wherever it is shown.
  attr: {
    position: 'absolute', left: 12, bottom: 12, maxWidth: '50%',
    fontSize: 9, color: onPhoto.text, opacity: 0.55,
    textShadowColor: 'rgba(0,0,0,0.7)', textShadowRadius: 3,
  },
});
