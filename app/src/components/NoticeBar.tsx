// The line `lib/notice` says, drawn: over whichever screen is up, above
// the tab bar, with its one door on the right.
//
// ── how long ──
//
// Six seconds (`NOTICE_MS`), then it goes by itself. It is not something
// to answer: making a reader dismiss a line they did not ask for is one
// more press for the regular who checks in four times a week, and until
// they did it would sit over the foot of the place's screen. Missing it
// costs nothing — the card is on the page whenever they go.
//
// Six and not the banner's four: this one is read *and decided on* by
// somebody whose eyes were on a sheet a moment ago, and the thing to
// press is a single word at the edge. Material's range for a line with
// an action is four to ten seconds; this is its near end.
//
// With a screen reader on it does not go by the clock at all. Finding a
// line and its button by swipe takes longer than any timer a sighted
// reader would put up with, and a control that vanishes while it is
// being read is worse than one that stays; it leaves when its door is
// used, when it is swiped away, or when another line takes its place.
//
// ── putting it away ──
//
// A swipe down on it, for the reader who wants the foot of the screen
// back now. No ×: a second target on a line this size, for something
// that leaves by itself. A press on the words does nothing — the door is
// the word in the accent — so a thumb that lands on the line while
// scrolling goes nowhere.
//
// ── what moves ──
//
// Up 16 and in, over 200ms; out over 240. Reduce Motion: it is there,
// then it is not. The timers decide when it is gone, as the toast's do,
// not the animation's end.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, PanResponder, StyleSheet, Text, View } from 'react-native';
import { useNotice } from '../lib/notice';
import { colors, font, radius, space } from '../theme';
import { PressableScale, SECONDARY_CONTROL_H, useReducedMotion, useTabBarClearance } from './ui';
import { Glyph, ICON } from './ui/glyph';

/** How long a line stays, from the moment it starts to appear. */
export const NOTICE_MS = 6000;
const IN_MS = 200;
const OUT_MS = 240;
/** How far under its place it starts. */
const RISE = 16;
/** A swipe down: a thumb's worth of travel, more down than across. A
 *  press that trembles moves two or three points and is not one. */
const SWIPE = 12;
export const swipedDown = (g: { dx: number; dy: number }): boolean => g.dy > SWIPE && g.dy > Math.abs(g.dx);

export default function NoticeBar({ onOpen }: {
  /** Take the reader through the line's door — see `Note.action`. */
  onOpen: () => void;
}) {
  const { note, dismiss } = useNotice();
  // 14 over the bar. It was 8, and on the phone the line read as stuck
  // to the bar (owner's recording, 24 Nov 2026); 14 is the gap between
  // two cards in a column (`space.cardGap`), so it reads as a thing of
  // its own lying above the bar.
  const bottom = useTabBarClearance(space.cardGap);
  const still = useReducedMotion();
  const slide = useRef(new Animated.Value(0)).current;
  const [spoken, setSpoken] = useState(false);

  useEffect(() => {
    let live = true;
    AccessibilityInfo.isScreenReaderEnabled().then((on) => { if (live) setSpoken(on); });
    const sub = AccessibilityInfo.addEventListener('screenReaderChanged', setSpoken);
    return () => { live = false; sub.remove(); };
  }, []);

  useEffect(() => {
    if (!note) return undefined;
    if (still) slide.setValue(1);
    else {
      slide.setValue(0);
      Animated.timing(slide, { toValue: 1, duration: IN_MS, useNativeDriver: true }).start();
    }
    AccessibilityInfo.announceForAccessibility(`${note.text}. ${note.action}`);
    if (spoken) return undefined;
    const out = setTimeout(() => {
      if (!still) Animated.timing(slide, { toValue: 0, duration: OUT_MS, useNativeDriver: true }).start();
    }, NOTICE_MS - OUT_MS);
    const gone = setTimeout(dismiss, NOTICE_MS);
    return () => { clearTimeout(out); clearTimeout(gone); };
  }, [note, slide, dismiss, still, spoken]);

  const pan = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_e, g) => swipedDown(g),
    onPanResponderRelease: (_e, g) => { if (swipedDown(g)) dismiss(); },
  }), [dismiss]);

  if (!note) return null;
  return (
    // The strip takes no touches of its own: only the line is in the way
    // of what is under it.
    <View style={[s.strip, { bottom }]}>
      <Animated.View
        {...pan.panHandlers}
        style={[s.line, {
          opacity: slide,
          transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [RISE, 0] }) }],
        }]}
        testID="notice"
      >
        <Glyph name="checkmark-circle" size={ICON.action} color={colors.okInk} />
        <Text style={s.text} numberOfLines={1} testID="notice-text">{note.text}</Text>
        <PressableScale
          onPress={() => { dismiss(); onOpen(); }}
          haptic="selection"
          scaleTo={0.94}
          contentStyle={s.door}
          accessibilityRole="button"
          accessibilityLabel={note.action}
          testID="notice-action"
        >
          <Text style={s.doorText}>{note.action}</Text>
        </PressableScale>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  strip: { position: 'absolute', left: 16, right: 16, pointerEvents: 'box-none' },
  // The banner's card (`RewardBanner`): the cards' surface, a hairline,
  // and a shadow because it lies over a screen that is still there.
  line: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingLeft: 14, paddingRight: 4,
    backgroundColor: colors.surfaceCard, borderRadius: radius.card,
    borderWidth: 1, borderColor: colors.borderGlassSoft,
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  text: { flex: 1, color: colors.text, fontSize: 15, fontWeight: font.medium },
  // 44 tall, the secondary control's height: the door is the line's one
  // target and sets the line's height.
  door: { height: SECONDARY_CONTROL_H, paddingHorizontal: 12, justifyContent: 'center' },
  doorText: { color: colors.accent, fontSize: 15, fontWeight: font.semibold },
});
