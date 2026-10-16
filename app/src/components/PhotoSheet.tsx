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
// "Ảnh 4/6", whether it is the cover or hidden, and the score with its
// reasons. Where it came from was cut (owner, 16 Oct 2026): the icon and
// "Đã tải lên" told a guide nothing they act on — every row offers the
// same actions whoever added it. The reasons sit under the name, beside
// the number, so no gap opens below a name one line tall next to a
// number and its word two lines tall.
//
// ── the frame's shape ──
//
// Sized to the photograph rather than cropping it: a landscape fills the
// width at its own ratio, so nothing is lost, and anything squarer or
// taller sits whole in a square on a dark ground. Cropping a portrait to
// a landscape frame would cut off the very top and bottom a guide is
// judging. Capped at half the screen, so the name, the score and the
// rows are still on the first screen of a small phone. Until the picture
// has arrived its ratio is unknown; 4:3, a phone's own, is the guess
// that moves least for most of what a gallery holds.

import React, { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SheetRows, type SheetAction } from './ActionSheet';
import { ScoreTen, ScoreWhy } from './PhotoScore';
import PhotoViewer, { settledPage } from './PhotoViewer';
import { useSheetDrag } from './sheetDrag';
import { PressableScale } from './ui';
import type { GalleryPhoto } from '../lib/gallery';
import { useI18n } from '../lib/i18n';
import { colors, display, font, onPhoto, radius, space } from '../theme';

/** A phone's own ratio, for the moment before the picture says its own. */
const GUESS = 4 / 3;
/** The most of the screen's height the picture may take. */
const MAX_SHARE = 0.5;

/**
 * The frame's height for a picture `aspect` wide per unit tall, in a
 * frame `width` across on a screen `screen` tall: the picture's own
 * height when it is wider than tall, a square when it is not, and never
 * more than half the screen.
 */
export function frameHeight(aspect: number, width: number, screen: number): number {
  return Math.round(Math.min(width / Math.max(aspect, 1), screen * MAX_SHARE));
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

  // Each picture's own shape, by id, as each arrives.
  const [ratios, setRatios] = useState<Record<string, number>>({});
  const [full, setFull] = useState(false);

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
  const frameH = frameHeight(ratios[p.id] ?? GUESS, frameW, height);
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
          contentContainerStyle={[s.body, { paddingBottom: insets.bottom + 16 }]}
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
                    onLoad={(e) => {
                      const { width: w, height: h } = e.source;
                      if (w > 0 && h > 0) setRatios((was) => ({ ...was, [ph.id]: w / h }));
                    }}
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
              <View style={s.titleLine}>
                <Text style={s.title} numberOfLines={1}>{t('Photo', 'Ảnh', '写真')} {count}</Text>
                {status ? <Text style={s.status} numberOfLines={1} testID="photo-sheet-status">{status}</Text> : null}
              </View>
              {p.score && <ScoreWhy score={p.score} />}
            </View>
            {p.score && <ScoreTen score={p.score} />}
          </View>

          <SheetRows actions={visible ? actionsFor(p) : []} onClose={onClose} titlesOnly />
        </ScrollView>
      </Animated.View>

      {full && <PhotoViewer photos={all} index={at} onIndex={onIndex} onClose={closeFull} />}
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(6,5,8,0.62)' },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: colors.bgElevated,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderGlassSoft,
  },
  // The handle's touch area is the strip, not the 4pt bar: a pull has
  // to be easy to start.
  handle: { alignItems: 'center', paddingTop: 10, paddingBottom: 8 },
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
  titleLine: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  title: { flexShrink: 0, color: colors.text, fontSize: 20, fontFamily: display.semibold },
  status: { flexShrink: 1, color: colors.textTertiary, fontSize: 14 },
});
