// Shared UI atoms: screen scaffold with header + language pill, chips,
// translucent charcoal cards — the cityCrew design system in React Native.

import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, PressableProps, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useI18n } from '../lib/i18n';
import { useScheme } from '../lib/theme';
import { colors, display, font, gradAI, radius, space, type } from '../theme';

// ── tab bar geometry ──
// A full-width Apple-style bar over blur; position:absolute so content
// scrolls beneath it, which means screens must clear it themselves.
export const TAB_BAR_HEIGHT = 62;

/** Bottom padding that clears the translucent tab bar plus breathing room. */
export function useTabBarClearance(extra = 18): number {
  const insets = useSafeAreaInsets();
  return insets.bottom + TAB_BAR_HEIGHT + extra;
}

export type HapticKind = 'light' | 'selection' | 'none';

export function fireHaptic(kind: HapticKind) {
  if (kind === 'light') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  else if (kind === 'selection') Haptics.selectionAsync().catch(() => {});
}

/** Success tick for completed actions (signed in, saved, …). */
export function successHaptic() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

/**
 * Pressable that sinks slightly under the finger (spring scale) and gives
 * a small haptic tap — the default press feedback for cards and buttons.
 * `style` lands on the animated inner view, so pass layout styles as usual.
 */
export function PressableScale({ children, style, containerStyle, haptic = 'light', scaleTo = 0.97, onPress, onPressIn, onPressOut, ...rest }: PressableProps & {
  haptic?: HapticKind;
  scaleTo?: number;
  style?: StyleProp<ViewStyle>;
  /** Styles that must stay on the outer Pressable (e.g. absolute position). */
  containerStyle?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const springTo = (v: number) =>
    Animated.spring(scale, { toValue: v, useNativeDriver: true, speed: 40, bounciness: 5 }).start();
  return (
    <Pressable
      {...rest}
      style={containerStyle}
      onPressIn={(e) => { springTo(scaleTo); onPressIn?.(e); }}
      onPressOut={(e) => { springTo(1); onPressOut?.(e); }}
      onPress={(e) => { fireHaptic(haptic); onPress?.(e); }}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}

/** Soft pulsing placeholder shown while content loads. */
export function Skeleton({ style }: { style?: StyleProp<ViewStyle> }) {
  const pulse = useRef(new Animated.Value(0.45)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 650, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.45, duration: 650, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <Animated.View
      style={[{ backgroundColor: colors.surfaceGlass, borderRadius: radius.image, opacity: pulse }, style]}
    />
  );
}

/** The small uppercase line above a title. `Screen` wraps a plain string
 *  in one of these; pass the elements yourself when the line needs more
 *  than words — see Explore, which hangs the weather off the date. */
export function EyebrowText({ children }: { children: React.ReactNode }) {
  return <Text style={s.eyebrow}>{children}</Text>;
}

export function Screen({ title, eyebrow, children, right }: {
  title: string;
  /** Small uppercase line above the title — e.g. today's date. */
  eyebrow?: React.ReactNode;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          {eyebrow ? (
            <View style={s.eyebrowRow}>
              {typeof eyebrow === 'string' ? <EyebrowText>{eyebrow}</EyebrowText> : eyebrow}
            </View>
          ) : null}
          <Text style={s.title}>{title}</Text>
        </View>
        {right}
      </View>
      {children}
    </SafeAreaView>
  );
}

export function Chip({ label, active, onPress, icon, iconColor }: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  /** Optional leading glyph. It keeps its own colour in both states — the
   *  hue is what ties a chip to the dot the same concept wears on a card,
   *  so selection must not repaint it. */
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
}) {
  return (
    <PressableScale onPress={onPress} haptic="selection" scaleTo={0.94} style={[s.chip, active && s.chipOn]}>
      {icon ? <Ionicons name={icon} size={15} color={iconColor ?? colors.textSecondary} /> : null}
      <Text style={[s.chipText, active && s.chipTextOn]}>{label}</Text>
    </PressableScale>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[s.card, style]}>{children}</View>;
}

/** Reflected city light: heavily diffused amber, strongest across the
 *  browsing band and falling away to black at both ends. */
export function AmbientWarmth({ style }: { style?: StyleProp<ViewStyle> }) {
  // Paper gets none of it. The glow is city light bouncing off a dark
  // room; laid over a warm white page the same haze reads as a stain, and
  // the light theme's depth comes from the white cards instead.
  if (useScheme().scheme === 'light') return null;
  return (
    <LinearGradient
      colors={['transparent', colors.emberGlow, colors.emberGlowFade, 'transparent']}
      locations={[0, 0.34, 0.72, 1]}
      style={[s.ambient, style]}
      pointerEvents="none"
    />
  );
}

/** 44pt circular glass control — headers and in-page actions share it. */
/**
 * True translucent material: blur with a smoky overlay on top, so content
 * scrolling beneath a floating bar reads through it.
 *
 * `tint` is a named material, not a colour, so it cannot be a dynamic pair
 * — and the overlay deepening it has to match that material rather than
 * merely invert. Which is why this is a component and not two tokens.
 *
 * Shared by the tab bar and the pinned filter row. They are the same
 * material doing the same job at opposite ends of the screen, and a
 * second copy of these numbers would drift from the first.
 */
export function GlassMaterial() {
  const light = useScheme().scheme === 'light';
  return (
    <BlurView intensity={42} tint={light ? 'light' : 'dark'} style={StyleSheet.absoluteFill}>
      <View style={{ flex: 1, backgroundColor: light ? 'rgba(250,248,244,0.68)' : 'rgba(12,13,12,0.62)' }} />
    </BlurView>
  );
}

export function RoundIconButton({ icon, onPress, label, size = 21 }: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  label?: string;
  size?: number;
}) {
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.92}
      style={s.backBtn}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name={icon} size={size} color={colors.text} />
    </PressableScale>
  );
}

/**
 * The lone action in an empty-state card: gradient, glyph, label.
 *
 * There were two of these, written apart and landing 2pt apart —
 * 24/15 under "No collections yet", 22/13 under an empty list. Nobody
 * chose that difference, and it is the kind that compounds: the next one
 * would have been a third figure. One size, and it is the roomier of the
 * two, which also buys a 46pt touch target instead of 42.
 *
 * Distinct from `AddPill` on purpose. That one sits beside a heading or
 * inside a bar and is sized to stay quiet next to them; this one is the
 * only thing on its card and carries a full sentence of a label.
 */
export function GradientCta({ icon, label, onPress, wide }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  /** Full width, for the one action that commits a sheet. Sized to its
   *  label everywhere else: a button as wide as the screen reads as "the
   *  only thing here", which is true at the foot of a sheet and false in
   *  the middle of a card. */
  wide?: boolean;
}) {
  return (
    <PressableScale onPress={onPress} accessibilityRole="button" containerStyle={wide ? { alignSelf: 'stretch' } : undefined}>
      <LinearGradient {...gradAI} style={[s.cta, wide && s.ctaWide]}>
        <Ionicons name={icon} size={20} color={colors.accentInk} />
        <Text style={s.ctaText}>{label}</Text>
      </LinearGradient>
    </PressableScale>
  );
}

/** In-page back control: the round glass button wearing a chevron. */
export function BackButton({ onPress }: { onPress: () => void }) {
  const { t } = useI18n();
  return (
    <RoundIconButton
      icon="chevron-back"
      size={22}
      onPress={onPress}
      label={t('Back', 'Quay lại', '戻る')}
    />
  );
}

export function Empty({ text }: { text: string }) {
  return (
    <View style={s.empty}>
      <Text style={s.emptyText}>{text}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  // Bottom-aligned so a header action sits on the title's optical centre
  // whether or not an eyebrow is stacked above it.
  header: {
    flexDirection: 'row', alignItems: 'flex-end',
    paddingHorizontal: space.page, paddingTop: 8, paddingBottom: 14,
  },
  title: { color: colors.text, ...type.title },
  // The dateline is the one place a screen title gets colour: it says
  // "today", which is the app's whole premise, and it is short enough that
  // the accent stays a mark rather than a block of coloured text.
  // The gap between the line and the title lives on the row, so an
  // eyebrow made of several elements spaces the same as one made of a
  // string.
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  // Grey, not the accent. The line is a date — a fact, not a state — and
  // in the accent it was the loudest thing above a title that should be
  // the loudest thing on the screen.
  eyebrow: {
    color: colors.textSecondary, fontSize: 12, fontFamily: display.semibold,
    letterSpacing: 1.4, textTransform: 'uppercase',
  },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    borderWidth: 1, borderColor: colors.borderGlassSoft, borderRadius: radius.pill,
    paddingHorizontal: 14, paddingVertical: 7, marginRight: 8,
  },
  // Selected control carries the accent — same rule as the language pill.
  chipOn: { backgroundColor: colors.surfaceGlass, borderColor: colors.borderGlass },
  chipText: { color: colors.textSecondary, fontSize: 13.5, fontWeight: font.medium },
  chipTextOn: { color: colors.accent, fontWeight: font.semibold },
  card: {
    backgroundColor: colors.surfaceCard, borderRadius: radius.card,
    borderWidth: 1, borderColor: colors.borderGlassSoft, overflow: 'hidden',
  },
  ambient: { position: 'absolute', left: 0, right: 0, top: -40, height: 760 },
  cta: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 24, paddingVertical: 15, borderRadius: radius.pill,
  },
  ctaWide: { justifyContent: 'center', paddingVertical: 16 },
  ctaText: { color: colors.accentInk, fontSize: 16, fontWeight: font.semibold },
  backBtn: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surfaceGlass, borderWidth: 1, borderColor: colors.borderGlassSoft,
  },
  empty: { padding: 48, alignItems: 'center' },
  emptyText: { color: colors.textTertiary, ...type.meta, textAlign: 'center' },
});
