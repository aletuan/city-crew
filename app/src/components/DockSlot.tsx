// The tab bar's dock, lent to a screen while the bar is away.
//
// Scrolling down ducks the bar (`tabBarDuck`), and the slot it vacates is
// in thumb reach exactly when a reader is deep in a list and furthest
// from anything at its top. Explore was first to use it — "Not finding
// it?" — and the collection page borrows it for its own actions (owner,
// 16 Oct 2026). One component, so the two docks cannot drift: the same
// lift, width, height, radius and glass as the bar, so the slot reads as
// one place that changes content rather than two things fighting for it.
//
// The sharing rules are `lib/nudge`'s gate: the bar always wins the slot
// back the same frame, and every time it leaves, the dock takes it again
// one barely-visible beat behind, so the two never cross mid-dock.

import React, { useEffect, useRef, useState } from 'react';
import { Animated, type StyleProp, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { createNudgeGate, NUDGE_SETTLE_MS } from '../lib/nudge';
import { useScheme } from '../lib/theme';
import { colors, font, radius } from '../theme';
import { GlassMaterial, glassHalo, PressableScale, TAB_BAR_HEIGHT, useTabBarFrame, useTabBarLift } from './ui';

/**
 * Whether the dock may show: `eligible` held through the gate's settle
 * beat, and dropped the moment it is not. A navigation away hands the
 * slot back to the bar, so coming back starts the beat over.
 */
export function useDockOffer(
  eligible: boolean,
  navigation: { addListener: (e: 'focus', cb: () => void) => () => void },
): boolean {
  const gate = useRef(createNudgeGate()).current;
  const [on, setOn] = useState(false);
  useEffect(() => navigation.addListener('focus', () => {
    gate.reset();
    setOn(false);
  }), [navigation, gate]);
  useEffect(() => {
    setOn(gate.update(eligible, Date.now()));
    if (!eligible) return;
    // The gate keeps no timer, so eligibility re-polls it once the
    // settle time has passed.
    const id = setTimeout(() => setOn(gate.update(true, Date.now())), NUDGE_SETTLE_MS + 20);
    return () => clearTimeout(id);
  }, [eligible, gate]);
  return on;
}

/**
 * The dock itself. Rises into place from below — the direction the bar
 * left in — and fades out the moment the bar wants the slot back; while
 * hidden it takes no touches. Given `onPress`, the whole island is the
 * press (Explore's search); otherwise its children carry their own.
 */
export function DockSlot({ visible, onPress, accessibilityRole, style, testID, children }: {
  visible: boolean;
  /** The island is a press, always: both docks now say their offer in a
   *  sentence the whole island answers to (owner, 17 Oct 2026). The
   *  collection's held two buttons and no press of its own until then. */
  onPress: () => void;
  accessibilityRole?: 'button';
  style?: StyleProp<ViewStyle>;
  testID?: string;
  children: React.ReactNode;
}) {
  const lift = useTabBarLift();
  const frame = useTabBarFrame();
  const light = useScheme().scheme === 'light';
  const fade = useRef(new Animated.Value(0)).current;
  // Mounted only while shown or on its way out. A dock faded to nothing
  // but still in the tree kept its buttons for VoiceOver to find — a
  // second "Plan a trip" nobody could see — so once the fade ends, it goes.
  const [mounted, setMounted] = useState(visible);
  useEffect(() => {
    if (visible) setMounted(true);
    Animated.timing(fade, {
      toValue: visible ? 1 : 0,
      duration: visible ? 220 : 140,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && !visible) setMounted(false);
    });
  }, [visible, fade]);
  if (!mounted) return null;
  const island = [s.dock, { shadowOpacity: light ? 0.16 : 0.35 }, style];
  // Same clip-on-its-own-layer trick the bar uses: iOS draws shadows
  // outside bounds, so overflow:hidden on the shadowed view would eat them.
  const glass = <View style={s.clip}><GlassMaterial /></View>;
  return (
    <Animated.View
      pointerEvents={visible ? 'box-none' : 'none'}
      testID={testID}
      style={[
        s.wrap,
        {
          // The bar's own numbers, from its own hooks: these were once two
          // copies of one formula, and the copy drifted 28pt above the bar.
          bottom: lift,
          left: frame.left,
          width: frame.width,
          opacity: fade,
          transform: [{
            translateY: fade.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }),
          }],
        },
      ]}
    >
      <PressableScale onPress={onPress} scaleTo={0.985} style={island} accessibilityRole={accessibilityRole}>
        {glass}
        {children}
      </PressableScale>
    </Animated.View>
  );
}

/**
 * What the dock offers, said in a glyph and two lines: what it is, then
 * what it is for. Explore's "Not finding it?" first; the collection
 * page's "Plan a trip" since 17 Oct 2026, on the owner's ask that the two
 * docks be one design — a sentence on the left that the whole island
 * answers to, and the gradient pill at the right for the second act —
 * "+ Địa điểm" on both, where a place is what it adds.
 * Shared, so the two cannot drift apart a point at a time.
 *
 * The halo, because the glass under these words is thin and whatever
 * scrolls beneath it is unknown.
 */
export function DockOffer({ icon, title, sub }: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  sub: string;
}) {
  const light = useScheme().scheme === 'light';
  return (
    <>
      <Ionicons name={icon} size={18} color={colors.text} style={glassHalo(light)} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[s.title, glassHalo(light)]} numberOfLines={1}>{title}</Text>
        <Text style={[s.sub, glassHalo(light)]} numberOfLines={1}>{sub}</Text>
      </View>
    </>
  );
}

const s = StyleSheet.create({
  title: { color: colors.text, fontSize: 15, fontWeight: font.semibold },
  // Full strength, where this was `textTertiary` — which is #6E695E, the
  // exact mid-tone that could not be read on thin glass over a
  // photograph. Size and weight carry the hierarchy instead of colour:
  // 13 regular under 15 semibold is already two steps down, and it is
  // the pair of steps that survives an unknown ground.
  sub: { color: colors.text, fontSize: 13, opacity: 0.72 },
  wrap: { position: 'absolute' },
  dock: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    minHeight: TAB_BAR_HEIGHT,
    paddingLeft: 18, paddingRight: 10, paddingVertical: 8,
    borderRadius: radius.tabBar,
    shadowColor: '#000', shadowRadius: 18, shadowOffset: { width: 0, height: 8 },
    elevation: 8,
    // The same glass the bar is made of, because this *is* the bar's dock
    // — a solid panel arriving where a translucent one left reads as two
    // different objects sharing a slot. If motion under it smears on a
    // device, the fix is the blur, not a second material.
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderGlass,
    overflow: 'visible',
  },
  clip: {
    ...StyleSheet.absoluteFill,
    borderRadius: radius.tabBar,
    overflow: 'hidden',
  },
});
