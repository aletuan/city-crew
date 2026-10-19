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
// What the photograph is, beside its score — and whether it is the cover
// or hidden (owner, 18 Oct 2026, from the "Photo Review" board: picture,
// then what it shows, then the number). The kind comes from the photo
// labels, with its mark, and is said only when the labels are sure of it
// (`photoKind`); otherwise the number stands alone. Its larger use is in
// the detailed analysis: "higher than X%" compares the photograph with
// its own kind, and the source line names Claude beside Apple Vision.
//
// Under the kind, where the number stands among the catalog's
// photographs (`ScoreStanding`): the one fact that says what 7.3 means,
// moved out of the folded analysis (owner, 18 Oct 2026).
//
// No sentence of reasons. The head used to lead with one ("Held back by:
// a little dark"), and the owner saw it said again under the bars: it was
// built from the very findings the Light, Focus and Composition rows
// print, so the head repeated the analysis in a line it could not
// explain. The rows say it once, each beside the bar it belongs to. The
// full-screen viewer keeps the sentence, having no rows to say it.
//
// Not "Ảnh 4/6" (owner, 16 Oct 2026): the count is already on the
// photograph. Where it came from was cut the same day: the icon and
// "Đã tải lên" told a guide nothing they act on.

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
import { ScoreDetails, ScoreStanding, ScoreTen } from './PhotoScore';
import PhotoViewer, { settledPage } from './PhotoViewer';
import { useSheetDrag } from './sheetDrag';
import { PressableScale } from './ui';
import type { GalleryPhoto } from '../lib/gallery';
import { useI18n } from '../lib/i18n';
import { KIND_ICON, kindName } from '../lib/photoKind';
import { colors, font, onPhoto, radius, space } from '../theme';

/** The head's lines: the kind's, then the 14pt lines under it (the
 *  standing and the status), with the gap between each. Fixed line
 *  heights, so the height held for them is a number and not the font's
 *  guess. */
const KIND_LINE = 23;
const TEXT_LINE = 20;
const HEAD_GAP = 4;
/** The standing wraps to two lines at most: the longest, in Vietnamese,
 *  takes two. */
const STANDING_LINES = 2;

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
  const scored = all.some((ph) => ph.score);
  const frameW = width - space.page * 2;
  const frameH = frameHeight(frameW, height);
  // The cover is a star beside the kind once there is a kind to sit
  // beside (owner, 18 Oct 2026, from the "Cover Photo UI" board): the
  // word under the standing was a third line saying one bit. With no
  // kind it stays a word, since a lone star in the head would mark
  // nothing.
  const status = [
    p.is_cover && !p.kind ? t('Cover', 'Ảnh bìa', 'カバー') : null,
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
            <View style={[s.name, scored && s.nameHeld]} testID="photo-sheet-name">
              {p.kind ? (
                <View style={s.kind} testID="photo-sheet-kind">
                  <Ionicons name={KIND_ICON[p.kind]} size={20} color={colors.text} />
                  <Text style={s.kindText}>{kindName(p.kind, t)}</Text>
                  {p.is_cover && (
                    <View accessibilityLabel={t('Cover', 'Ảnh bìa', 'カバー')} testID="photo-sheet-cover">
                      <Ionicons name="star" size={16} color={colors.okInk} />
                    </View>
                  )}
                </View>
              ) : null}
              {p.score && (
                <View style={p.kind ? s.underKind : null}>
                  <ScoreStanding score={p.score} kind={p.kind} lines={STANDING_LINES} />
                </View>
              )}
              {status ? <Text style={s.status} numberOfLines={1} testID="photo-sheet-status">{status}</Text> : null}
            </View>
            {p.score && <ScoreTen score={p.score} />}
          </View>

          {p.score && <ScoreDetails score={p.score} kind={p.kind} open={detail} onToggle={() => setDetail((was) => !was)} />}
        </ScrollView>

        {/* The actions as a dock, pinned under the scroll (owner, 17 Oct
            2026, from the "Bottom Action Dock" board). They were three
            full rows at the foot of the scroll: a screen down once the
            analysis was open, and folding them only then made the sheet
            change shape under the reader. Always the strip, always in
            reach — the analysis is what decides a cover or a hide, so the
            act stays one tap from the reading at any length. It sits on
            the home indicator's inset, not 10pt above it: the extra lift
            read as the strip floating high (owner, 18 Oct 2026). A phone
            with no inset still gets the 10pt, or the strip would touch
            the screen's edge. */}
        {visible && actionsFor(p).length > 0 && (
          <View style={[s.dock, { paddingBottom: Math.max(insets.bottom, 10) }]}>
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

  // The head is inset by the analysis card's own inset, its 1pt border
  // plus its padding, on both sides (owner, 18 Oct 2026, from the "Căn
  // chỉnh hàng thông tin" board). It used to start at the page's edge:
  // the kind's mark sat 17pt left of the Light, Focus and Composition
  // marks below it, and its name 17pt left of theirs, so two columns of
  // marks and two of words ran down one sheet. Inset, the 20pt mark and
  // 8pt gap put the name at 45pt, where the rows' 18pt mark and 10pt gap
  // put theirs. On the right, the number ends where the rows' verdicts
  // end, so both margins match.
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: space.cardPadding + 1 },
  // The words beside the number keep one height, so the sheet stays still
  // as the guide swipes (owner, 19 Oct 2026). Without it the head grew
  // and shrank by a line: "Higher than 20% of interior photos" fits on
  // one line, and the Vietnamese for food and drink ("Cao hơn 90% ảnh đồ
  // ăn & uống") takes two, so the whole sheet rose a line between two
  // photographs of one gallery. The height held is the kind and two lines
  // of standing, and only in a gallery with a score to stand: a gallery
  // the phone has not analysed shows the kind alone on every photograph,
  // and holding room there left 68pt of nothing above the dock. A first
  // build held a third line for "hidden" as well; the owner found the gap
  // under every ordinary photograph too wide for a line only a hidden one
  // shows (19 Oct 2026), so a hidden photograph grows by that line.
  name: { flex: 1, gap: HEAD_GAP },
  nameHeld: { minHeight: KIND_LINE + HEAD_GAP + STANDING_LINES * TEXT_LINE },
  // Under the kind's words, not its mark: 20pt glyph and 8pt gap.
  underKind: { marginLeft: 28 },
  status: { color: colors.textTertiary, fontSize: 14, lineHeight: TEXT_LINE },
  // The head's type, opposite the number: the sentence's ink and size
  // before it, since the kind took its place.
  kind: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  kindText: { color: colors.text, fontSize: 17, lineHeight: KIND_LINE, fontWeight: font.semibold },
});
