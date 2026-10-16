// One photograph of a gallery, opened: the picture first and large, then
// its name, where it came from and its score, then what can be done to
// it (owner's design review, 16 Oct 2026).
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

export default function PhotoSheet({ photo, index, total, actions, onClose }: {
  /** The photograph open; null when the sheet is closed. */
  photo: GalleryPhoto | null;
  /** Its place in the gallery, from 0. */
  index: number;
  total: number;
  actions: SheetAction[];
  onClose: () => void;
}) {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const visible = photo !== null;

  // What it last showed, so it fades out showing it rather than empty.
  const last = useRef<{ photo: GalleryPhoto; index: number; actions: SheetAction[] } | null>(null);
  if (photo) last.current = { photo, index, actions };
  const shown = last.current;

  const [aspect, setAspect] = useState<{ id: string; ratio: number } | null>(null);

  const rise = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!visible) { rise.setValue(1); return; }
    Animated.spring(rise, { toValue: 0, useNativeDriver: true, speed: 14, bounciness: 3 }).start();
  }, [visible, rise]);
  // Pulled by its handle only: the body scrolls, and a pull that started
  // on the picture would take the scroll from it.
  const { drag, handlers } = useSheetDrag(visible, onClose);

  if (!shown) return null;
  const p = shown.photo;
  const frameW = width - space.page * 2;
  const ratio = aspect?.id === p.id ? aspect.ratio : GUESS;
  const fromGoogle = p.source === 'google';
  const meta = [
    fromGoogle ? t('From Google', 'Từ Google', 'Googleから') : t('Uploaded', 'Đã tải lên', 'アップロード'),
    p.is_cover ? t('Cover', 'Ảnh bìa', 'カバー') : null,
    p.is_hidden ? t('Hidden', 'Đã ẩn', '非表示') : null,
  ].filter(Boolean).join(' · ');
  const count = `${shown.index + 1}/${total}`;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
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
          <View style={[s.frame, { height: frameHeight(ratio, frameW, height) }]} testID="photo-sheet-frame">
            <Image
              source={{ uri: p.photo_uri }}
              style={StyleSheet.absoluteFill}
              contentFit="contain"
              transition={150}
              onLoad={(e) => {
                const { width: w, height: h } = e.source;
                if (w > 0 && h > 0) setAspect({ id: p.id, ratio: w / h });
              }}
              alt={`${t('Photo', 'Ảnh', '写真')} ${count}`}
            />
            <PressableScale
              style={s.close}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={t('Close', 'Đóng', '閉じる')}
              testID="photo-sheet-close"
            >
              <Ionicons name="close" size={18} color={onPhoto.text} />
            </PressableScale>
            <View style={s.count}>
              <Text style={s.countText}>{count}</Text>
            </View>
          </View>

          <View style={s.head}>
            <View style={s.name}>
              <Text style={s.title} numberOfLines={1}>{t('Photo', 'Ảnh', '写真')} {count}</Text>
              <View style={s.metaLine}>
                <Ionicons
                  name={fromGoogle ? 'logo-google' : 'cloud-upload-outline'}
                  size={13}
                  color={colors.textTertiary}
                />
                <Text style={s.meta} numberOfLines={1} testID="photo-sheet-meta">{meta}</Text>
              </View>
            </View>
            {p.score && <ScoreTen score={p.score} />}
          </View>

          {p.score && <ScoreWhy score={p.score} />}

          <SheetRows actions={shown.actions} onClose={onClose} titlesOnly />
        </ScrollView>
      </Animated.View>
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
  close: {
    position: 'absolute', top: 10, right: 10,
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(6,5,8,0.62)',
  },
  count: {
    position: 'absolute', bottom: 10, left: 10,
    paddingHorizontal: 9, paddingVertical: 4, borderRadius: radius.pill,
    backgroundColor: 'rgba(6,5,8,0.62)',
  },
  countText: { color: onPhoto.text, fontSize: 13, fontWeight: font.semibold, fontVariant: ['tabular-nums'] },

  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  name: { flex: 1, gap: 4 },
  title: { color: colors.text, fontSize: 20, fontFamily: display.semibold },
  metaLine: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  meta: { flexShrink: 1, color: colors.textTertiary, fontSize: 14 },
});
