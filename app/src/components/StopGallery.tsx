// The places of an outing, one page each, as the picture at the top of its
// card.
//
// Page `i` is stop `i` and stays stop `i`. A stop with no photograph draws
// its emoji on the grey a bare `PlaceCard` uses, and a stop whose place has
// left the catalog draws a pin: dropping either would be tidier and would
// break the one thing that makes the carousel more than decoration, which
// is that its index means something to the list underneath. The screen
// holding the page is what lets it point at a name there.
//
// Nothing at all when no stop has a picture. A row of grey panels with
// emoji on them is a control that costs a swipe and returns nothing.
//
// Lifted out of `TripDetailScreen`, which drew this inline, so that the
// plan options screen can wear the same picture: what a reader compares
// there is what they find again once the plan is saved.

import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { dotWindow } from '../lib/format';
import { coverOf } from '../lib/place';
import type { Place } from '../lib/types';
import { useFlag } from '../lib/useFlag';
import { colors, onPhoto, radius } from '../theme';

/** Whether any of these places has a photograph to page to. */
export function hasPicture(places: readonly (Place | null | undefined)[]): boolean {
  return places.some((p) => !!p && !!coverOf(p));
}

export default function StopGallery({ places, aspectRatio, page, onPage, onPressPage, testID }: {
  /** One per stop, in order; null for a place no longer listed. */
  places: readonly (Place | null | undefined)[];
  /** Width over height. The list's band and the detail's picture differ,
   *  for reasons their screens give. */
  aspectRatio: number;
  /** The page on screen, held by the screen so a row can be marked. */
  page: number;
  onPage: (i: number) => void;
  /**
   * A tap on any page, when the picture is also a way into what it shows.
   *
   * The plan options card passes its own open here, because the carousel
   * cannot live *inside* the card's pressable: a horizontal scroll and a
   * press on the same touch are two responders arguing over one finger,
   * and on the phone the swipe lost. So the picture stands beside the
   * pressable body rather than in it, and this is how a tap on it still
   * opens the plan. The pages are not announced as buttons — the body
   * already is, once, with the card's name — so VoiceOver meets one
   * control per card and not one per photograph.
   */
  onPressPage?: () => void;
  testID?: string;
}) {
  const [width, setWidth] = useState(0);
  const credit = useFlag('photo_attribution');
  if (!hasPicture(places)) return null;

  const here = places[page];
  // The credit belongs to the picture on screen, so it is read from the
  // current page rather than printed once. This is also why a carousel is
  // easier to license than a strip of thumbnails: one photograph visible,
  // one credit owed.
  const attr = credit && here ? coverOf(here)?.attribution_name : null;
  const shot = { aspectRatio, width };

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} testID={testID}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => onPage(Math.round(e.nativeEvent.contentOffset.x / width))}
      >
        {places.map((p, i) => {
          const ph = p ? coverOf(p) : undefined;
          const pageView = ph
            ? (
              <Image
                source={{ uri: ph.photo_uri }}
                style={[s.shot, shot]}
                contentFit="cover"
                transition={200}
              />
            )
            : (
              <View style={[s.shot, s.bare, shot]}>
                <Text style={s.emoji}>{p?.emoji ?? '📍'}</Text>
              </View>
            );
          return onPressPage
            ? (
              <Pressable key={`shot-${i}`} onPress={onPressPage} accessible={false} testID="gallery-page">
                {pageView}
              </Pressable>
            )
            : <React.Fragment key={`shot-${i}`}>{pageView}</React.Fragment>;
        })}
      </ScrollView>
      {attr ? <Text style={s.attr} numberOfLines={1}>{attr}</Text> : null}
      {places.length > 1 && (
        <View style={s.dots}>
          {dotWindow(places.length, page).map((i) => (
            <View key={i} style={[s.dot, i === page && s.dotOn]} />
          ))}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  shot: { backgroundColor: colors.surfaceGlass },
  bare: { alignItems: 'center', justifyContent: 'center' },
  // Sized for the smaller of the two pictures it draws, the list's band:
  // at 52pt, what the detail used, a 3:1 band held an emoji taller than
  // half its own height.
  emoji: { fontSize: 40 },
  // Required wherever the photo is shown; read from the page on screen.
  attr: {
    position: 'absolute', right: 12, bottom: 12, maxWidth: '50%',
    fontSize: 9, color: onPhoto.text, opacity: 0.55,
    textShadowColor: 'rgba(0,0,0,0.7)', textShadowRadius: 3,
  },
  // The same pill of dots `PlaceDetailScreen` floats over its hero, and
  // the same `dotWindow` behind it, so a long day gets a fixed strip
  // instead of a row that runs off the picture.
  dots: {
    position: 'absolute', bottom: 12, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: 'rgba(10,11,10,0.45)', borderRadius: radius.pill,
    paddingHorizontal: 11, paddingVertical: 8,
  },
  dot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: 'rgba(255,255,255,0.38)' },
  dotOn: { width: 8, height: 8, borderRadius: 4, backgroundColor: onPhoto.text },
});
