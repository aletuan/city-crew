// A collection's cover, the head of its card.
//
// One block with the words under it (owner, 22 Nov 2026): it stood above
// the card with 12pt between, and drew narrower than the card and the
// tiles under it — two things side by side where there was one. Now it is
// the card's first child, the card's width and its top corners, and the
// face and the note follow it without a gap.
//
// On your own list it carries the camera of the person page's cover, and
// the cover itself is the press: they open `CollectionCoverSheet`, whose
// taps are tried on this very picture ("Trying it") until Save.
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
import { Alert, Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { setCollectionCover } from '../lib/data';
import { useI18n } from '../lib/i18n';
import type { Collection, Place } from '../lib/types';
import { MORPH_MS, measureWindow, usableRect, type CoverFrom, type Rect } from '../lib/coverMorph';
import { font, radius } from '../theme';
import { CollectionCoverSheet } from './CollectionCoverSheet';
import { useCoverTrial } from './useCoverTrial';
import { Glyph, ICON } from './ui/glyph';
import { useReducedMotion } from './ui/motion';
import { PHOTO_DISC } from './ui/controls';

/** Wide, as the tile's own photograph is on a place's card (`StopHero`). */
export const HERO_ASPECT = 2;

export default function CollectionHero({ list, members, from, owned, onChanged }: {
  list: Collection | undefined;
  members: readonly Place[];
  from?: CoverFrom;
  /** Your own list: the camera, and the cover as a door to the sheet. */
  owned?: boolean;
  /** The cover was saved: the page reads the list again. */
  onChanged?: () => void;
}) {
  const { t } = useI18n();
  const [sheet, setSheet] = useState(false);
  const [busy, setBusy] = useState(false);
  const trial = useCoverTrial(list, members, !!owned && sheet);
  const { picked, trying, uri } = trial;
  const close = () => { setSheet(false); trial.reset(); };
  const save = async () => {
    setBusy(true);
    try {
      await setCollectionCover(list!.slug, picked);
      close();
      onChanged?.();
    } catch {
      Alert.alert(t('Couldn\'t save the cover. Try again.', 'Chưa lưu được ảnh bìa. Thử lại nhé.', 'カバーを保存できませんでした。もう一度お試しください。', '未能保存封面，请重试。', '未能儲存封面，請重試。'));
    } finally {
      setBusy(false);
    }
  };
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
      <Pressable
        onPress={owned ? () => setSheet(true) : undefined}
        disabled={!owned}
        accessibilityRole={owned ? 'button' : undefined}
        accessibilityLabel={owned ? t('Change cover', 'Đổi ảnh bìa', 'カバーを変更', '更换封面', '更換封面') : undefined}
        style={StyleSheet.absoluteFill}
        testID="collection-hero-press"
      >
        <Image
          source={{ uri }}
          contentFit="cover"
          style={[s.image, live && s.hidden]}
          testID="collection-hero-image"
        />
      </Pressable>
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
      {/* The person page's camera, in the same glass: it says the
          picture is a control. The whole cover is the press. */}
      {owned ? (
        <View style={s.camera} pointerEvents="none" testID="collection-hero-camera">
          <Glyph name="camera-outline" size={ICON.action} color="#fff" />
        </View>
      ) : null}
      {trying ? (
        <View style={s.trying} pointerEvents="none" testID="collection-hero-trying">
          <Text style={s.tryingText}>{t('Trying it', 'Đang xem thử', '試しに表示中', '预览中', '預覽中')}</Text>
        </View>
      ) : null}
      {owned ? (
        <CollectionCoverSheet
          visible={sheet}
          onClose={close}
          choices={trial.choices}
          opened={trial.opened}
          picked={picked}
          autoUri={trial.autoUri}
          onPick={trial.pick}
          onSave={save}
          busy={busy}
        />
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  // The card's own width: the card clips the corners, so the picture is
  // square-cornered and flush with all three edges it shares.
  hero: { aspectRatio: HERO_ASPECT },
  image: { ...StyleSheet.absoluteFill },
  hidden: { opacity: 0 },
  grow: { position: 'absolute', borderRadius: radius.image, overflow: 'hidden' },
  // The person page's camera disc, figure for figure (`PersonScreen` ›
  // `coverEdit`, where the reasoning is): 36 with the action glyph and a
  // hairline ring, so it does not go under on a dark photograph.
  camera: {
    position: 'absolute', right: 10, bottom: 10, width: PHOTO_DISC, height: PHOTO_DISC, borderRadius: PHOTO_DISC / 2,
    alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: StyleSheet.hairlineWidth * 2, borderColor: 'rgba(255,255,255,0.45)',
  },
  trying: {
    position: 'absolute', bottom: 17, left: 10, paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.55)',
  },
  tryingText: { color: '#fff', fontSize: 12, fontWeight: font.medium },
});
