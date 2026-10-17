// One photograph of a gallery, opened: the picture first and large, then
// its name and its score, then what can be done to it (owner's design
// review, 16 Oct 2026).
//
// ── why the picture leads ──
//
// The sheet it replaces led with a 52pt thumbnail. A guide opens a
// photograph to decide about it — the cover, hide it, keep it — and at
// 52pt there is nothing to decide on: the score said "horizon tilted 6°"
// about a picture too small to see the horizon in. So the photograph
// takes the sheet's width, and one tap on a tile opens this directly;
// the ⋯ that marked every tile, and the quick menu it would have opened,
// were dropped as a step between the guide and the picture (owner).
//
// ── moving between photographs ──
//
// The picture is a pager: a swipe left or right moves to the next
// photograph without closing the sheet and finding the tile (owner, 16
// Oct 2026), and a tap on it, or ⛶, opens the full-screen viewer
// (`PhotoViewer`), which pages the same way. Both report the photograph
// they rest on to the gallery, which owns which one is open, so closing
// the viewer lands the sheet on the photograph that was being looked at.
// The viewer is drawn inside this sheet's Modal rather than as a second
// one: two Modals at once is where iOS's presentation stack and React
// Native disagree.
//
// ── what the head says ──
//
// What the photograph is like, in a sentence, beside its score — and
// whether it is the cover or hidden. Not "Ảnh 4/6" (owner, 16 Oct 2026):
// the count is already on the photograph, and saying it twice gave the
// head's biggest type to the one fact the reader could see anyway. Where
// it came from was cut the same day: the icon and
// "Đã tải lên" told a guide nothing they act on — every row offers the
// same actions whoever added it. The reasons sit under the name, beside
// the number, so no gap opens below a name one line tall next to a
// number and its word two lines tall.
//
// ── the frame's shape ──
//
// One square for every photograph of the gallery, the picture whole in
// it on a dark ground: a landscape with a band above and below, a
// portrait with one either side. The first build sized the frame to each
// picture, and the sheet grew and shrank as the guide swiped between a
// portrait and a landscape, the rows jumping under it (owner, 16 Oct
// 2026, from Bold Brew's 6/10 and 7/10). A frame that never moves is
// worth the bands. Square rather than 4:3, because a portrait in a 4:3
// frame is a strip down the middle; capped at half the screen, so the
// name, the score and the rows are still on a small phone's first
// screen. The whole picture at full size is the viewer's.
//
// ── the screen behind ──
//
// Blurred as well as dimmed (owner, 16 Oct 2026): behind this sheet is
// the gallery's grid, photographs under a photograph, and dimmed alone it
// read as two screens stacked, each asking to be looked at. Blurred, the
// grid is a place to come back to rather than a second picture.

import React, { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SheetStrip, type SheetAction } from './ActionSheet';
import { ScoreDetails, ScoreTen, ScoreWhy } from './PhotoScore';
import PhotoViewer, { settledPage } from './PhotoViewer';
import { useSheetDrag } from './sheetDrag';
import { PressableScale } from './ui';
import type { GalleryPhoto } from '../lib/gallery';
import { useI18n } from '../lib/i18n';
import { colors, font, onPhoto, radius, space } from '../theme';

/** The most of the screen's height the picture may take. */
const MAX_SHARE = 0.5;
/**
 * How far the screen behind is blurred, on expo-blur's 0–100. The tab
 * bar's glass is 38 (`GlassMaterial`), a blur that keeps what is behind
 * it legible; behind a sheet it should not be, so more than that. A
 * first value, to be judged on a phone: jsdom draws no blur.
 */
const BLUR = 50;

/** The frame's height, the same for every photograph: a square `width`
 *  across, never more than half a screen `screen` tall. */
export function frameHeight(width: number, screen: number): number {
  return Math.round(Math.min(width, screen * MAX_SHARE));
}

export default function PhotoSheet({ photos, index, onIndex, actionsFor, onClose }: {
  photos: GalleryPhoto[];
  /** The photograph open, by its place in `photos`; null when closed. */
  index: number | null;
  /** A swipe, here or in the viewer, came to rest on another. */
  onIndex: (i: number) => void;
  actionsFor: (p: GalleryPhoto) => SheetAction[];
  onClose: () => void;
}) {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const visible = index !== null && photos[index] !== undefined;

  // What it last showed, so it fades out showing it rather than empty.
  const last = useRef<{ photos: GalleryPhoto[]; index: number } | null>(null);
  if (visible) last.current = { photos, index };

  // Where the pager starts, and a key that makes a fresh one: set at each
  // opening and as the viewer closes, never while the finger is on it —
  // the offset is the finger's, and moving it to follow the index would
  // fight the swipe that changed the index.
  const pager = useRef({ key: 0, start: 0, open: false });
  if (visible && !pager.current.open) pager.current = { key: pager.current.key + 1, start: index, open: true };
  if (!visible) pager.current.open = false;

  const [full, setFull] = useState(false);
  // The detailed analysis, open or folded: kept while the gallery is,
  // so a guide who opened it reads it on every photograph they swipe to.
  const [detail, setDetail] = useState(false);

  const rise = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!visible) { rise.setValue(1); setFull(false); return; }
    Animated.spring(rise, { toValue: 0, useNativeDriver: true, speed: 14, bounciness: 3 }).start();
  }, [visible, rise]);
  // Pulled by its handle only: the body scrolls, and a pull that started
  // on the picture would take the scroll from it.
  const { drag, handlers } = useSheetDrag(visible, onClose);

  const shown = last.current;
  if (!shown) return null;
  const all = shown.photos;
  const at = shown.index;
  const p = all[at];
  const frameW = width - space.page * 2;
  const frameH = frameHeight(frameW, height);
  const status = [
    p.is_cover ? t('Cover', 'Ảnh bìa', 'カバー') : null,
    p.is_hidden ? t('Hidden', 'Đã ẩn', '非表示') : null,
  ].filter(Boolean).join(' · ');
  const count = `${at + 1}/${all.length}`;
  const closeFull = () => {
    pager.current = { ...pager.current, key: pager.current.key + 1, start: at };
    setFull(false);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={full ? closeFull : onClose} statusBarTranslucent>
      <BlurView intensity={BLUR} tint="dark" style={StyleSheet.absoluteFill} testID="photo-sheet-blur" />
      <Pressable style={s.backdrop} onPress={onClose} accessibilityLabel={t('Close', 'Đóng', '閉じる')} />
      <Animated.View
        style={[s.sheet, {
          maxHeight: height - insets.top - 8,
          transform: [
            { translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [0, 480] }) },
            { translateY: drag },
          ],
        }]}
        testID="photo-sheet"
      >
        <View style={s.handle} {...handlers}>
          <View style={s.grabber} />
        </View>

        <ScrollView
          bounces={false}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[s.body, { paddingBottom: 16 }]}
        >
          <View style={[s.frame, { height: frameH }]} testID="photo-sheet-frame">
            <ScrollView
              key={pager.current.key}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              contentOffset={{ x: pager.current.start * frameW, y: 0 }}
              scrollEventThrottle={16}
              onScroll={(e) => {
                const i = settledPage(e.nativeEvent.contentOffset.x, frameW, all.length);
                if (i !== null && i !== at) onIndex(i);
              }}
              testID="photo-sheet-pager"
            >
              {all.map((ph, i) => (
                <Pressable
                  key={ph.id}
                  style={{ width: frameW, height: frameH }}
                  onPress={() => setFull(true)}
                  accessibilityRole="imagebutton"
                  accessibilityLabel={`${t('Photo', 'Ảnh', '写真')} ${i + 1}/${all.length}`}
                  accessibilityHint={t('Opens it full screen.', 'Mở toàn màn hình.', '全画面で開きます。')}
                  testID={`photo-sheet-page-${ph.id}`}
                >
                  <Image
                    source={{ uri: ph.photo_uri }}
                    style={StyleSheet.absoluteFill}
                    contentFit="contain"
                    transition={150}
                  />
                </Pressable>
              ))}
            </ScrollView>
            <PressableScale
              style={[s.round, s.close]}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={t('Close', 'Đóng', '閉じる')}
              testID="photo-sheet-close"
            >
              <Ionicons name="close" size={18} color={onPhoto.text} />
            </PressableScale>
            <View style={s.count} pointerEvents="none">
              <Text style={s.countText}>{count}</Text>
            </View>
            <PressableScale
              style={[s.round, s.expand]}
              onPress={() => setFull(true)}
              accessibilityRole="button"
              accessibilityLabel={t('Full screen', 'Toàn màn hình', '全画面')}
              testID="photo-sheet-full"
            >
              <Ionicons name="expand" size={17} color={onPhoto.text} />
            </PressableScale>
          </View>

          <View style={s.head}>
            <View style={s.name}>
              {p.score && <ScoreWhy score={p.score} lead />}
              {status ? <Text style={s.status} numberOfLines={1} testID="photo-sheet-status">{status}</Text> : null}
            </View>
            {p.score && <ScoreTen score={p.score} />}
          </View>

          {p.score && <ScoreDetails score={p.score} open={detail} onToggle={() => setDetail((was) => !was)} />}
        </ScrollView>

        {/* The actions as a dock, pinned under the scroll (owner, 17 Oct
            2026, from the "Bottom Action Dock" board). They were three
            full rows at the foot of the scroll: a screen down once the
            analysis was open, and folding them only then made the sheet
            change shape under the reader. Always the strip, always in
            reach — the analysis is what decides a cover or a hide, so the
            act stays one tap from the reading at any length. The dock's
            own padding clears the home indicator. */}
        {visible && actionsFor(p).length > 0 && (
          <View style={[s.dock, { paddingBottom: insets.bottom + 10 }]}>
            <SheetStrip actions={actionsFor(p)} onClose={onClose} />
          </View>
        )}
      </Animated.View>

      {full && <PhotoViewer photos={all} index={at} onIndex={onIndex} onClose={closeFull} />}
    </Modal>
  );
}

const s = StyleSheet.create({
  // Lighter than the action sheets' 0.62: the blur does half the work of
  // pushing the grid back, and both at full strength turn it to mud.
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(6,5,8,0.4)' },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: colors.bgElevated,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderGlassSoft,
  },
  // The handle's touch area is the strip, not the 4pt bar: a pull has
  // to be easy to start.
  handle: { alignItems: 'center', paddingTop: 10, paddingBottom: 8 },
  dock: { paddingHorizontal: space.page, paddingTop: 8 },
  grabber: { width: 38, height: 4, borderRadius: 2, backgroundColor: colors.textTertiary },
  body: { paddingHorizontal: space.page, gap: 14 },

  // The dark ground a squarer picture sits on — the scrim's ink, so the
  // bars either side read as the frame and not as part of the photo.
  frame: { borderRadius: radius.card, overflow: 'hidden', backgroundColor: 'rgb(6,5,8)' },
  round: {
    position: 'absolute',
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(6,5,8,0.62)',
  },
  close: { top: 10, right: 10 },
  expand: { bottom: 10, right: 10 },
  count: {
    position: 'absolute', bottom: 10, left: 10,
    paddingHorizontal: 9, paddingVertical: 4, borderRadius: radius.pill,
    backgroundColor: 'rgba(6,5,8,0.62)',
  },
  countText: { color: onPhoto.text, fontSize: 13, fontWeight: font.semibold, fontVariant: ['tabular-nums'] },

  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  name: { flex: 1, gap: 8 },
  status: { color: colors.textTertiary, fontSize: 14 },
});
