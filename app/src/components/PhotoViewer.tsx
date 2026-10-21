// A gallery's photographs, one at a time and the whole screen each:
// swiped through, pinched to look closer, and read with their score
// (owner's design review, 16 Oct 2026, the fourth screen).
//
// ── what is here and what is not ──
//
// Looking only. The design drew a ⋯ in the corner for the cover, hide
// and delete; it was left off, because the sheet underneath already
// lists them and closing this lands on whichever photograph was being
// looked at — the same one tap away, from one place instead of two, and
// no delete within reach of a thumb that is swiping.
//
// ── the gestures, and why they are the platform's ──
//
// Paging is a horizontal ScrollView with `pagingEnabled`; the pinch is a
// ScrollView per page with a zoom scale, which on iOS is UIScrollView's
// own zoom — the one Photos uses — run natively, with no library to add
// and so no binary to ship. Android has no ScrollView zoom; there the
// pages still swipe and the pinch does nothing, and City Crew ships to
// iOS. A tap shows or hides the bar and the score, as Photos does, so a
// picture can be seen with nothing over it.

import React, { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScoreTen, ScoreWhy } from './PhotoScore';
import { PressableScale } from './ui';
import type { GalleryPhoto } from '../lib/gallery';
import { useI18n } from '../lib/i18n';
import { font, onPhoto, radius, space } from '../theme';

/**
 * The page a pager has come to rest on, or null while it is between
 * pages. On a page means within a point of its offset: the scroll events
 * of a swipe pass through every offset between two pages and settle on
 * one exactly, so the index moves once the finger's work is done rather
 * than at the halfway mark, where a change of the frame's height would
 * jump under the finger. Shared with the sheet's own pager.
 */
export function settledPage(x: number, pageWidth: number, pages: number): number | null {
  if (pageWidth <= 0) return null;
  const i = Math.round(x / pageWidth);
  if (i < 0 || i >= pages || Math.abs(x - i * pageWidth) > 1) return null;
  return i;
}

/** How far a pinch may enlarge: enough to read a sign across a room,
 *  and short of the pixels running out on a 1,600-pixel Google photo. */
const MAX_ZOOM = 3;

export default function PhotoViewer({ photos, index, onIndex, onClose }: {
  photos: GalleryPhoto[];
  /** The photograph shown, by its place in `photos`. */
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [chrome, setChrome] = useState(true);
  // Where the pages start, fixed at opening: the offset is the finger's
  // from then on, and moving it as the index follows would fight it.
  const start = useRef(index).current;

  const p = photos[index];
  if (!p) return null;
  const count = `${index + 1}/${photos.length}`;

  return (
    <View style={s.root} testID="photo-viewer">
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        contentOffset={{ x: start * width, y: 0 }}
        scrollEventThrottle={16}
        onScroll={(e) => {
          const i = settledPage(e.nativeEvent.contentOffset.x, width, photos.length);
          if (i !== null && i !== index) onIndex(i);
        }}
        testID="photo-viewer-pager"
      >
        {photos.map((ph, i) => (
          <ScrollView
            key={ph.id}
            style={{ width, height }}
            contentContainerStyle={{ width, height }}
            minimumZoomScale={1}
            maximumZoomScale={MAX_ZOOM}
            centerContent
            bouncesZoom
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
          >
            <Pressable
              style={{ width, height }}
              onPress={() => setChrome((on) => !on)}
              accessibilityRole="image"
              accessibilityLabel={`${t('Photo', 'Ảnh', '写真', '照片', '照片')} ${i + 1}/${photos.length}`}
              testID={`photo-viewer-page-${ph.id}`}
            >
              <Image source={{ uri: ph.photo_uri }} style={StyleSheet.absoluteFill} contentFit="contain" transition={150} />
            </Pressable>
          </ScrollView>
        ))}
      </ScrollView>

      {chrome && (
        <>
          <View style={[s.top, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
            <PressableScale
              contentStyle={s.round}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={t('Close', 'Đóng', '閉じる', '关闭', '關閉')}
              testID="photo-viewer-close"
            >
              <Ionicons name="close" size={20} color={onPhoto.text} />
            </PressableScale>
            <Text style={s.count} testID="photo-viewer-count">{count}</Text>
            {/* The ×'s width on the other side, so the count is centred. */}
            <View style={s.balance} />
          </View>

          {p.score?.aesthetic != null && (
            <View style={[s.bottom, { marginBottom: insets.bottom + 12 }]} testID="photo-viewer-score">
              <ScoreTen score={p.score} onDark />
              <ScoreWhy score={p.score} onDark />
            </View>
          )}
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { ...StyleSheet.absoluteFill, backgroundColor: '#000' },
  top: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: space.page,
  },
  round: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(6,5,8,0.62)',
  },
  balance: { width: 36 },
  count: { color: onPhoto.text, fontSize: 16, fontWeight: font.semibold, fontVariant: ['tabular-nums'] },
  bottom: {
    position: 'absolute', left: space.page, right: space.page, bottom: 0,
    gap: 8, padding: space.cardPadding, borderRadius: radius.card,
    backgroundColor: 'rgba(6,5,8,0.62)',
  },
});
