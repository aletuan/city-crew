// A collection's cover, across the top of its page.
//
// Opened from a tile, the cover grows out of it: a copy of the tile's
// picture is drawn at the tile's own place and grown into the cover's, over
// `MORPH_MS`, and the real cover shows the moment the copy has arrived.
// Both are the same picture cropped the same way (`cover`), so nothing
// jumps when one takes over from the other. Opened any other way — Explore,
// a person's page, a link — or with Reduce Motion on, it is simply there.
//
// The copy's box is animated on the JS thread (`left`, `top`, `width` and
// `height` cannot ride the native driver), the one place in the app that
// does. Scaling instead would be native, and would squash the picture: a
// tile is nearly square and the cover is 2:1, so the crop has to change on
// the way, and only a real resize changes it. Not measured on a device yet.
//
// There is no title on it: the page's header already says the name, and the
// tile's caption fades with the tile.

import React, { type ComponentRef, useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { coverUriOf } from '../lib/place';
import type { Collection, Place } from '../lib/types';
import { MORPH_MS, measureWindow, usableRect, type CoverFrom, type Rect } from '../lib/coverMorph';
import { radius, space } from '../theme';
import { useReducedMotion } from './ui/motion';

/** Wide, as the tile's own photograph is on a place's card (`StopHero`). */
export const HERO_ASPECT = 2;

export default function CollectionHero({ list, members, from }: {
  list: Collection | undefined;
  members: readonly Place[];
  from?: CoverFrom;
}) {
  const uri = list ? coverUriOf(list, members) : undefined;
  const still = useReducedMotion();
  const box = useRef<ComponentRef<typeof View>>(null);
  const grow = useRef(new Animated.Value(0)).current;
  const [to, setTo] = useState<Rect | null>(null);
  const [done, setDone] = useState(false);
  const live = !!from && usableRect(from.rect) && !still && !done && !(to && !usableRect(to));

  useEffect(() => {
    if (!live || !to) return;
    const run = Animated.timing(grow, {
      toValue: 1,
      duration: MORPH_MS,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
      // Layout properties: see the note at the top.
      useNativeDriver: false,
    });
    run.start(({ finished }) => { if (finished) setDone(true); });
    return () => run.stop();
  }, [live, to, grow]);

  // A collection with no picture of its own has no cover to grow into.
  if (!uri) return null;
  const grown = (a: number, b: number) => grow.interpolate({ inputRange: [0, 1], outputRange: [a, b] });
  return (
    <View
      ref={box}
      onLayout={() => { if (from) measureWindow(box.current).then(setTo); }}
      style={s.hero}
      testID="collection-hero"
    >
      <Image
        source={{ uri }}
        contentFit="cover"
        style={[s.image, live && s.hidden]}
        testID="collection-hero-image"
      />
      {live && from && to ? (
        <Animated.View
          pointerEvents="none"
          testID="collection-hero-grow"
          style={[s.grow, {
            left: grown(from.rect.x - to.x, 0),
            top: grown(from.rect.y - to.y, 0),
            width: grown(from.rect.w, to.w),
            height: grown(from.rect.h, to.h),
          }]}
        >
          <Image source={{ uri: from.uri }} contentFit="cover" style={StyleSheet.absoluteFill} />
        </Animated.View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  hero: { marginHorizontal: space.page, marginBottom: 12, aspectRatio: HERO_ASPECT },
  image: { ...StyleSheet.absoluteFill, borderRadius: radius.image },
  hidden: { opacity: 0 },
  grow: { position: 'absolute', borderRadius: radius.image, overflow: 'hidden' },
});
