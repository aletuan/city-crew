// The bar over a person page whose cover runs to the screen's edges
// (owner, 22 Nov 2026).
//
// ── at the top: on the photograph ──
//
// The cover runs under the clock and to both edges, and nothing is laid
// over it but what has to be: the way back on somebody else's page, and
// the page's tools on the right, both in the dark glass of the cover's
// camera — one pill for the three tools rather than a disc each, the
// shape the owner picked from his own mock-up, and a disc for the lone
// way back. Their glyphs are `onPhoto.text` (`BarInk`); the clock is
// light ink over the cover's own scrim (`Head`).
//
// ── past the photograph: on the page ──
//
// Over the last 44pt of photograph leaving the bar, the page's own
// ground fades in behind the bar, the person's name with it, and the
// glass fades out; at the crossing the glyphs and the clock turn to the
// page's ink — one change, not a dozen frames of half-ink. Explore's
// hero does the same (`ExploreScreen`'s `veilOpacity`), and the clock
// is owned the way it owns it (`useOwnedStatusBar`).
//
// Rejected the same morning: icons standing on the photograph with no
// ground (a pale sky took them, as it takes the clock), and the inset,
// rounded cover with the glass pill over it (the cover a card among the
// cards under it, smaller, and the head no longer the page's own).

import React, { useRef, useState } from 'react';
import { Animated, StyleSheet, View, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BarInk, RoundIconButton, useOwnedStatusBar } from '../../components/ui';
import { ICON } from '../../components/ui/glyph';
import { useI18n } from '../../lib/i18n';
import { atHandle } from '../../lib/handle';
import type { FriendProfile } from '../../lib/data';
import { colors, display, onPhoto, space } from '../../theme';

/** The glass the cover's camera wears: the photograph's own dark. */
const GLASS = 'rgba(0,0,0,0.42)';
/** The bar's own height under the clock: the header's 44 and its 6 over. */
export const BAR_H = 50;
/** The run of scroll the page's ground takes to come in. */
const FADE = 44;

/**
 * Where the scroll is, against the foot of the cover: `y` for the fades,
 * and `past` once the cover has left the bar.
 */
export function usePastCover(coverH: number, person: FriendProfile | null, searching: boolean) {
  const insets = useSafeAreaInsets();
  const y = useRef(new Animated.Value(0)).current;
  const [past, setPast] = useState(false);
  const pastRef = useRef(false);
  // Inside the fade: the name is drawn from here on, and read aloud. Not
  // before, where it would be a second copy of the head's name, hidden.
  const [near, setNear] = useState(false);
  const nearRef = useRef(false);
  // The cover's foot reaches the bar's when the page has scrolled this far.
  const end = coverH - insets.top - BAR_H;
  // Light ink on the photograph; past it, the scheme's own (null).
  const applyBar = useOwnedStatusBar(() => (pastRef.current ? null : 'light'));
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const at = e.nativeEvent.contentOffset.y;
    y.setValue(at);
    const close = at >= end - FADE;
    if (close !== nearRef.current) { nearRef.current = close; setNear(close); }
    const now = at >= end;
    if (now !== pastRef.current) {
      pastRef.current = now;
      setPast(now);
      applyBar();
    }
  };
  const ground = y.interpolate({ inputRange: [end - FADE, end], outputRange: [0, 1], extrapolate: 'clamp' });
  const glass = y.interpolate({ inputRange: [end - FADE, end], outputRange: [1, 0], extrapolate: 'clamp' });
  // Only over a cover: not before the page has a person, nor while the
  // search box stands in the head's place.
  const bleed = !!person && !searching;
  return { past, near, onScroll, ground, glass, bleed, person, scroll: y };
}

/**
 * The head's fade as the page carries it up under the bar (owner's
 * recording, 28 Nov 2026: the face under the clock and the name cut by
 * the tools, a second after the page began to move). The head stands on
 * the cover since that day, so it passes behind the bar's glass on its
 * way out; before, it stood on the page under the cover and the bar had
 * its own ground by the time they met.
 *
 * Explore's rule for its hero's words, and for the same reason
 * (`explore/Hero`): from 24 before the head's top meets the bar's foot
 * to where 60% of it has gone under. Until the head is measured nothing
 * fades: words gone because a layout has not arrived are worse than
 * words under a bar.
 */
export function useHeadFade(scroll: Animated.Value) {
  const top = useSafeAreaInsets().top;
  const [at, setAt] = useState<{ y: number; h: number } | null>(null);
  const onLayout = (e: LayoutChangeEvent) => {
    const { y, height } = e.nativeEvent.layout;
    setAt((was) => (was && was.y === y && was.h === height ? was : { y, h: height }));
  };
  if (!at) return { opacity: 1 as const, onLayout };
  // How far the page scrolls before the head's top is at the bar's foot.
  const meet = at.y - top - BAR_H;
  const from = Math.max(0, meet - 24);
  const opacity = scroll.interpolate({
    inputRange: [from, Math.max(from + 1, meet + at.h * 0.6)],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });
  return { opacity, onLayout };
}

export function CoverBar({ bar, onBack, backTestID, tools }: {
  bar: ReturnType<typeof usePastCover>;
  /** Somebody else's page, opened from somewhere: the way back. */
  onBack?: () => void;
  backTestID?: string;
  tools: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  if (!bar.bleed || !bar.person) return null;
  // The name as the head shows it: given, or the handle.
  const title = bar.person.full_name || atHandle(bar.person.handle);
  return (
    <View style={[s.bar, { paddingTop: insets.top }]} pointerEvents="box-none" testID="person-bar">
      <Animated.View style={[StyleSheet.absoluteFill, s.ground, { opacity: bar.ground }]} pointerEvents="none" testID="person-bar-ground" />
      <BarInk.Provider value={bar.past ? null : onPhoto.text}>
        <View style={s.row} pointerEvents="box-none">
          {onBack ? (
            <View style={s.backBox}>
              <Animated.View style={[s.disc, { opacity: bar.glass }]} pointerEvents="none" testID="person-back-glass" />
              <RoundIconButton icon="chevron-back" size={ICON.nav} bare onPress={onBack} label={t('Back', 'Quay lại', '戻る', '返回', '返回')} testID={backTestID} />
            </View>
          ) : null}
          {bar.near
            ? <Animated.Text style={[s.title, { opacity: bar.ground }]} numberOfLines={1} testID="person-bar-title">{title}</Animated.Text>
            : <View style={s.gap} />}
          <View>
            <Animated.View style={[s.pill, { opacity: bar.glass }]} pointerEvents="none" testID="person-tools-glass" />
            {tools}
          </View>
        </View>
      </BarInk.Provider>
    </View>
  );
}

const s = StyleSheet.create({
  bar: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 2 },
  // The page's ground, and the hairline the inline header stands on.
  ground: { backgroundColor: colors.bg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderGlass },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44,
    paddingHorizontal: space.page, marginTop: 6,
  },
  title: { flex: 1, color: colors.text, fontSize: 17, fontFamily: display.bold },
  gap: { flex: 1 },
  // The way back in a disc of its own, the control's 44 box less 4 a
  // side, the disc's edge 4 inside the page's margin.
  backBox: { marginLeft: -4 },
  disc: { position: 'absolute', left: 4, top: 4, width: 36, height: 36, borderRadius: 18, backgroundColor: GLASS },
  // The pill behind the tools: from 2 inside the first 44 box to 10 past
  // the last glyph's ink (the row is hung by `INK_GAP_END`, so its box
  // ends at the ink), 4 in from top and foot — 36 tall, the disc's.
  pill: { position: 'absolute', left: 2, right: -10, top: 4, bottom: 4, borderRadius: 18, backgroundColor: GLASS },
});
