// Shared UI atoms: screen scaffold with header + language pill, chips,
// translucent charcoal cards — the cityCrew design system in React Native.

import React, { useEffect, useRef } from 'react';
import {
  AccessibilityInfo, Animated, Easing, Pressable, PressableProps, StyleProp, StyleSheet, Text, View, ViewStyle,
} from 'react-native';
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

/**
 * How tall a full-size button is, everywhere.
 *
 * Shared because buttons of this class sit next to each other and the eye
 * reads a few points of difference as a mistake — which it was: the primary
 * CTA came out 50pt inline and 52pt when `wide`, the pill beside it 44pt,
 * and the auth form's button ~52pt, all from paddings tuned separately
 * around glyphs and labels of different sizes. Setting the height directly
 * takes the guesswork out: a button is this tall whatever is inside it.
 *
 * `minHeight` rather than `height`, so a label that wraps — a translation
 * longer than its English — grows the button instead of being clipped by it.
 *
 * This is the size class for buttons that carry an action on their own.
 * Chips, badges, ghost pills and icon wells are deliberately smaller and
 * are not this.
 */
export const CONTROL_H = 52;

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
  /**
   * Styles for the view the children actually live in — **everything about
   * how this element lays its own contents out and what it looks like**:
   * `flexDirection`, `gap`, `padding`, `backgroundColor`, `borderRadius`.
   *
   * This is the half that gets mixed up, and it fails in a way that looks
   * like a styling accident rather than a wiring one. Put `flexDirection:
   * 'row'` in `containerStyle` and it lands on the Pressable, whose only
   * child is the animated view — so the row has one item and lays it out
   * perfectly, while the icon and label inside stack in a column. Four
   * buttons in this app shipped with their glyph sitting on top of their
   * word for exactly this reason.
   */
  style?: StyleProp<ViewStyle>;
  /**
   * Styles that must stay on the outer Pressable rather than the animated
   * view inside it — absolute position, and **anything that positions this
   * element within its parent**: `flex`, `alignSelf`, `width`.
   *
   * `flex` is the one that bites, because it fails quietly. Put `flex: 1`
   * in `style` and it lands on the inner view, whose parent is the
   * Pressable, which has itself shrunk to fit its content — so the flex
   * has nothing to divide and any flexing child collapses to zero. A
   * pressable row in a column parent stretches anyway and looks fine; the
   * same row inside a *row* loses its text and only its icon survives.
   */
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

/**
 * Whether the reader has asked the system to calm things down.
 *
 * The web equivalent is `prefers-reduced-motion`, which is a media query
 * and updates itself. This does not, so it is read once and then watched:
 * the setting can be turned on *while* a screen is animating, which is
 * precisely when somebody reaches for it.
 *
 * Shared rather than read per component, because the first version of the
 * sketching screen had the orb honouring it and the step rows beside it
 * carrying on — half a screen obeying the reader is worse than none of it,
 * since it looks like the setting is broken rather than unsupported.
 */
export function useReducedMotion(): boolean {
  const [on, setOn] = React.useState(false);
  useEffect(() => {
    let live = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => { if (live) setOn(v); });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setOn);
    return () => { live = false; sub.remove(); };
  }, []);
  return on;
}

/**
 * A value looping 0 → 1 forever, or held at rest.
 *
 * The two animations this screen needs — a rotation and a breath — differ
 * only in what they map the number onto, so the loop itself is written
 * once. `useNativeDriver` throughout: every consumer drives `transform` or
 * `opacity`, and the JS thread is about to be busy.
 */
export function useLoop(ms: number, still: boolean, mode: 'linear' | 'inOut' = 'linear') {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (still) { v.setValue(0); return; }
    const step = (toValue: number) => Animated.timing(v, {
      toValue,
      duration: mode === 'linear' ? ms : ms / 2,
      easing: mode === 'linear' ? Easing.linear : Easing.inOut(Easing.quad),
      useNativeDriver: true,
    });
    // Linear runs 0 → 1 and snaps back, which is invisible on a rotation.
    // Eased has to come back down, or the breath would jerk at the top.
    const loop = Animated.loop(mode === 'linear' ? step(1) : Animated.sequence([step(1), step(0)]));
    loop.start();
    return () => { loop.stop(); v.setValue(0); };
  }, [ms, still, mode, v]);
  return v;
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

export function Screen({ title, eyebrow, children, right, onBack }: {
  title: string;
  /** Small uppercase line above the title — e.g. today's date. */
  eyebrow?: React.ReactNode;
  children: React.ReactNode;
  right?: React.ReactNode;
  /**
   * A way back, for a screen that was pushed onto something.
   *
   * On its own line above the title rather than beside it, which is what
   * iOS does with a large title and is the only placement that survives a
   * title wrapping to two lines — the header row aligns to `flex-end`, so
   * a control beside a two-line title ends up level with its last line
   * instead of at the top of the screen where a back control is looked for.
   *
   * The tab roots pass nothing and get no control, because there is
   * nothing behind them. A pushed screen that omits this leaves the reader
   * with the edge-swipe and no sign that it is there, which is how the
   * plan editor shipped: three drafts on the screen before it and no way
   * back to pick a different one.
   */
  onBack?: () => void;
}) {
  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      {onBack ? (
        <View style={s.backRow}>
          <BackButton onPress={onBack} />
        </View>
      ) : null}
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

/**
 * A surface with a hairline. It has **no padding of its own**, on purpose:
 * about half the cards in this app pad their inner rows instead, because a
 * row that has to run to the card's edge — a full-width divider, a pressable
 * that should take the whole width — cannot do that through card padding.
 * So every caller supplies the inset it wants.
 *
 * `StyleProp<ViewStyle>` rather than `ViewStyle`, so a caller can pass an
 * array and compose the padding with a conditional. It was the bare type,
 * which made `[s.card, past && s.cardPast]` a type error and pushed callers
 * towards one merged style per combination.
 */
export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
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
      <LinearGradient {...gradAI} style={s.cta}>
        <Ionicons name={icon} size={20} color={colors.accentInk} />
        <Text style={s.ctaText}>{label}</Text>
      </LinearGradient>
    </PressableScale>
  );
}

/**
 * The tick on a row you have chosen.
 *
 * Filled with `gradAI`, not `colors.accent`, and the distinction is one
 * this codebase has now got wrong twice. `colors.accent` is
 * `dyn('#C4402C', '#FF6F5B')` — on paper a *foreground* colour, dark
 * enough to read as text on a light page. Filling something with it puts
 * the `accentInk` glyph at 3.64:1 in the light theme while measuring 6.79
 * in the dark, so the control is right half the time and muddy the other
 * half. The theme file says it at the gradient itself: a gradient is a
 * fill.
 *
 * Three rows wanted this — Add a place, Search, and the wizard's
 * collections — which is why it stopped being a style object copied
 * between them.
 */
export function SelectTick({ on }: { on: boolean }) {
  if (!on) return <View style={s.tick} />;
  return (
    <LinearGradient {...gradAI} style={[s.tick, s.tickOn]}>
      <Ionicons name="checkmark" size={15} color={colors.accentInk} />
    </LinearGradient>
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
  // Its own line, and `alignItems: flex-start` so the control keeps its
  // 44pt without stretching to whatever else lands on the row later.
  backRow: { alignItems: 'flex-start', paddingHorizontal: space.page, paddingTop: 6 },
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
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    minHeight: CONTROL_H, paddingHorizontal: 24, paddingVertical: 10,
    borderRadius: radius.pill,
  },
  // Nothing left to say about the wide one but that it is wide — the
  // centring and the height it used to carry are now what every button of
  // this class gets. `wide` still stretches it in its parent; see
  // `GradientCta`.
  ctaText: { color: colors.accentInk, fontSize: 16, fontWeight: font.semibold },
  tick: {
    width: 26, height: 26, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: colors.borderGlass,
  },
  tickOn: { borderColor: 'transparent' },
  backBtn: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surfaceGlass, borderWidth: 1, borderColor: colors.borderGlassSoft,
  },
  empty: { padding: 48, alignItems: 'center' },
  emptyText: { color: colors.textTertiary, ...type.meta, textAlign: 'center' },
});
