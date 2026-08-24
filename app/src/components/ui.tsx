// Shared UI atoms: screen scaffold with header + language pill, chips,
// translucent charcoal cards — the cityCrew design system in React Native.

import React, { useEffect, useRef } from 'react';
import {
  AccessibilityInfo, Animated, ColorValue, Easing, Pressable, PressableProps, StyleProp, StyleSheet, Text, View, ViewStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { setStatusBarStyle, type StatusBarStyle } from 'expo-status-bar';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useI18n } from '../lib/i18n';
import { useScheme } from '../lib/theme';
import { colors, display, font, gradAI, radius, space, type } from '../theme';

// ── tab bar geometry ──
// A floating glass island (see FloatingTabBar), inset from the screen
// edges and sitting above the home indicator; position:absolute so
// content scrolls beneath it, which means screens must clear it
// themselves.
//
// 64, up from the 58 the icon-only island used, and the six points are
// the caption's: a 32pt icon well, 3pt of gap and a 13pt line of type is
// 48, which leaves 8 above and below. The island had the room — what it
// did not have was a reason, until two of the five glyphs turned out to
// be answering the same question. See FloatingTabBar.
export const TAB_BAR_HEIGHT = 64;
/** The air between the island and the safe area's bottom edge. */
export const TAB_BAR_GAP = 10;

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

/**
 * How tall a control in a screen's header is.
 *
 * Smaller than `CONTROL_H` on purpose, and not a drift from it: a header
 * action sits beside a 34pt title in a row that is read as one line, where
 * a full-size button reads as the screen's main action rather than as an
 * accessory to its title. The round buttons the other screens put in that
 * slot have always been this; naming it is what lets a pill join them
 * without inventing a third number.
 */
export const HEADER_CONTROL_H = 44;

/** Bottom padding that clears the floating tab bar plus breathing room. */
export function useTabBarClearance(extra = 18): number {
  return useTabBarLift() + TAB_BAR_HEIGHT + extra;
}

/**
 * How high the island's lower edge rides above the screen edge.
 *
 * Shared because three things need the same number and they used to
 * compute it separately: the bar positions itself by it, the duck
 * animation slides by it plus the bar's height, and every screen pads its
 * list by it. When the bar came down to sit closer to the edge, a
 * clearance still adding the whole safe-area inset left 46pt of dead air
 * under every list — the kind of drift that only shows up as "the spacing
 * looks off" months later.
 *
 * It clears the home indicator (about 13pt) rather than the whole inset,
 * which is generous by design, and floors at `TAB_BAR_GAP` for a device
 * with no inset at all.
 */
export function useTabBarLift(): number {
  const insets = useSafeAreaInsets();
  return Math.max(insets.bottom - 18, TAB_BAR_GAP);
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

/**
 * Own the status bar's ink while this screen is focused, and hand it back
 * on the way out.
 *
 * Two screens now put photography under the clock — Explore's hero and a
 * place's — and both need the same three things: light ink while a photo
 * is up there, the scheme's own ink the moment the screen leaves, and
 * none of it costing a render mid-transition. A mounted `<StatusBar>`
 * fails the third: expo's component applies on mount and on unmount, and
 * the unmount lands in the middle of a push, snapping the ink with no
 * animation. `setStatusBarStyle` fades, and renders nothing.
 *
 * `want` returns the ink this screen needs, or **null for "the scheme's
 * own"** — which is what the app-level `<StatusBar>` asserts everywhere
 * else, and what both callers want the moment their photograph is no
 * longer the thing under the clock.
 *
 * It is called rather than captured: the listeners below are built once,
 * so a screen whose answer changes while it sits there — Explore's, which
 * turns over as the hero scrolls past — keeps that state in a ref and
 * calls the returned `apply`.
 */
export function useOwnedStatusBar(want: () => StatusBarStyle | null): () => void {
  const navigation = useNavigation();
  const wantRef = useRef(want);
  wantRef.current = want;
  const light = useScheme().scheme === 'light';
  const lightRef = useRef(light);
  lightRef.current = light;
  const focusedRef = useRef(false);
  const own = useRef(() => (lightRef.current ? 'dark' : 'light') as StatusBarStyle).current;
  const apply = useRef(() => {
    if (focusedRef.current) setStatusBarStyle(wantRef.current() ?? own(), true);
  }).current;
  useEffect(() => {
    const focus = () => { focusedRef.current = true; apply(); };
    const blur = () => { focusedRef.current = false; setStatusBarStyle(own(), true); };
    // The first focus event can land before these listeners exist.
    if (navigation.isFocused()) focus();
    const a = navigation.addListener('focus', focus);
    const b = navigation.addListener('blur', blur);
    return () => { a(); b(); };
  }, [navigation, apply, own]);
  // The scheme can flip while this screen holds the bar.
  useEffect(apply, [light, apply]);
  return apply;
}

export function Screen({ title, subtitle, eyebrow, children, right, onBack }: {
  title: string;
  /** One quiet line under the title. Only in the pushed-screen header —
   *  a tab root's large title has an eyebrow above it instead, and a
   *  screen with both is a screen with three headings.
   *
   *  A string gets `s.subtitle` and is clipped to one line, which is what
   *  a sentence wants. A node is for a line that carries its own marks
   *  rather than only words — the collection byline's padlock, its
   *  curator's face and its heart — and such a node brings its own type,
   *  because the sizes around a control are tuned to the measure it sits
   *  in. `eyebrow` above takes a node on the same terms. */
  subtitle?: React.ReactNode;
  /** Small uppercase line above the title — e.g. today's date. */
  eyebrow?: React.ReactNode;
  children: React.ReactNode;
  right?: React.ReactNode;
  /**
   * A way back, for a screen that was pushed onto something — **and the
   * switch between this component's two headers.**
   *
   * With it, the header is compact: the control, the title beside it, a
   * subtitle under that, and whatever `right` holds. Without it, the large
   * title a tab root wears. That is not two styles to pick between, it is
   * one rule `authUi` already states — *"these are screens for doing
   * something and leaving, and iOS gives that shape an inline title; the
   * large title is for places you stay in"* — which this component ignored
   * when the control was first added and put on a line of its own above a
   * 34pt title. It cost about 60pt at the top of every pushed screen.
   *
   * `titleDetail` at 26pt, not `title` at 34: beside a 44pt control, the
   * larger one fits "Trips" and does not fit "River first, rooftop last".
   * The row aligns to the top rather than centring, because the title is
   * allowed to wrap and a control centred against two lines sits below
   * where a back control is looked for.
   *
   * Tab roots pass nothing and get no control, because there is nothing
   * behind them. A pushed screen that omits it leaves the reader with the
   * edge-swipe and no sign that it is there.
   */
  onBack?: () => void;
}) {
  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      {onBack ? (
        <View style={s.headerInline}>
          <BackButton onPress={onBack} />
          <View style={s.headerText}>
            <Text style={s.titleInline} numberOfLines={2}>{title}</Text>
            {/* The falsy guard comes first and stays: a caller computing
                its line can hand over an empty string, and `typeof ''` is
                still 'string' — which would draw a blank line the height
                of a subtitle under the title. A node is always truthy, so
                this costs the node path nothing. */}
            {subtitle
              ? (typeof subtitle === 'string'
                ? <Text style={s.subtitle} numberOfLines={1}>{subtitle}</Text>
                : subtitle)
              : null}
          </View>
          {right}
        </View>
      ) : (
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
      )}
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
/**
 * Frosted, not transparent — and the difference was measured.
 *
 * This sheet spent a long time nearly opaque because thinning it appeared
 * to destroy legibility. Composited over the darkest and lightest
 * photographs this catalog holds, against the mid-grey glyph the bar used
 * to draw:
 *
 *                        over a dark photo   over a light photo
 *   light 0.68, #6E695E        2.32                5.25
 *   light 0.45, #6E695E        1.10                5.32
 *   dark  0.62, #6E706D        4.02                1.03
 *
 * Every one of those is a failure or close to it, and thinning made them
 * worse — which is how the scrim got the blame. It was the wrong suspect.
 * A mid-tone scrim over an unknown photograph averages towards mid-grey,
 * and the glyph on it was *also* mid-grey. Two mid-tones cannot contrast
 * whatever the opacity between them.
 *
 * Take the glyph to full strength and the same table inverts:
 *
 *                        over a dark photo   over a light photo
 *   light 0.60, #17150F        6.08               17.62
 *   dark  0.60, #F7F7F5       18.71                4.78
 *
 * That bought the scrim down to 0.60, and it still read as paint. The
 * reason was the other number: a heavy blur is what makes glass look
 * opaque. At intensity 80 whatever is behind arrives as one featureless
 * wash, and a wash gives the eye nothing to recognise as *through* — you
 * cannot see that a pane is transparent unless something identifiable
 * survives it. Reference bars that read as glass use a light blur and let
 * shapes come through.
 *
 * So 38, and the scrim to 0.48:
 *
 *              over a dark photo   over a light photo
 *   light 0.48        4.08               17.75
 *   dark  0.48       18.88                3.19
 *
 * Which is why the glyphs carry a halo of the opposite tone — see
 * `glassHalo`. A halo is not a WCAG ratio and is not offered as one; it
 * is a guaranteed transition right at the stroke, so a glyph stops
 * depending on what the whole panel averages to.
 *
 * These numbers were briefly taken further — 28 and 0.38 — and put back.
 * Below about 0.42 the panel stops contributing to legibility at all and
 * the halo is holding it alone, which is a thinner guarantee than it
 * looks: it works at the stroke and nowhere else, so a glyph reads while
 * the shape it sits in stops being a surface. That is the wrong floor to
 * be resting on, and 0.48 is where the two still share the work.
 *
 * ── refraction, tried and dropped ──
 *
 * What a reference bar does that no blur can is *refract* — bend what is
 * behind it the way water does, rather than only smearing it. That is
 * Apple's Liquid Glass, and it was wired in here behind a guarded require
 * (iOS 26 only, blur everywhere else) and taken back out again.
 *
 * Worth recording, because the reason was not that it failed. It worked,
 * and the bar looked right. What it cost was a second material to reason
 * about: two panels made of it needed different amounts of veil, only one
 * platform ever saw it, and every number tuned for it had to be tuned
 * again for the blur that everyone else gets. One material with one set
 * of measurements behind it is worth more here than a better one on a
 * fraction of devices.
 *
 * If it comes back: the package is `expo-glass-effect`, its GlassView
 * calls `requireNativeViewManager` at module scope — so it must be a
 * require inside a try, never a top-level import, or a device without the
 * native module gets a white screen on launch — and the veil the blur
 * carries here has to be re-expressed as `UIGlassEffect.tintColor`, which
 * composites into the material instead of sitting on it.
 */
export function GlassMaterial() {
  const light = useScheme().scheme === 'light';
  return (
    <BlurView intensity={38} tint={light ? 'light' : 'dark'} style={StyleSheet.absoluteFill}>
      <View style={{ flex: 1, backgroundColor: light ? 'rgba(250,248,244,0.48)' : 'rgba(12,13,12,0.48)' }} />
    </BlurView>
  );
}

/**
 * The halo that lets a glyph sit on genuinely thin glass.
 *
 * Opposite tone to the ink, so it is a light edge under dark type on
 * paper and a dark one under light type on charcoal. Zero offset: this is
 * a bloom hugging the stroke, not a drop shadow — an offset one reads as
 * a mistake at 11pt.
 *
 * Sized against a 0.48 scrim, where the panel still carries half the
 * work. It grew to 4 while the scrim was briefly at 0.38 and came back
 * with it: a halo doing the job alone has to be thick enough to read as
 * a deliberate edge, and at 11pt that is close to the point where it
 * stops being invisible and starts being an outline.
 *
 */
export const glassHalo = (light: boolean) => ({
  textShadowColor: light ? 'rgba(250,248,244,0.95)' : 'rgba(10,11,10,0.95)',
  textShadowOffset: { width: 0, height: 0 },
  textShadowRadius: 3,
});

export function RoundIconButton({ icon, onPress, label, size = 21, color }: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  label?: string;
  size?: number;
  /**
   * Ink, when the glyph carries a state rather than an action.
   *
   * Every button in this shape used to draw in `colors.text`, which is
   * right for back and for an overflow menu — both of them are doors, and
   * a door is not on or off. The heart is: it shipped through here and
   * came out near-black while the identical heart on the shelf was coral,
   * so the same gesture wore two colours on two screens.
   *
   * Optional, and the default is the one to reach for. A coloured round
   * button is for a control whose colour *is* the information.
   *
   * `ColorValue` rather than `string`, because every token in the theme
   * is a `dyn()` — a value that resolves per theme, not a hex.
   */
  color?: ColorValue;
}) {
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.92}
      style={s.backBtn}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name={icon} size={size} color={color ?? colors.text} />
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

/**
 * Somebody's face, or the fact that they have not shown one.
 *
 * Four screens had drawn this circle for themselves — the crew list, the
 * activity rows, the person sheet, and now a collection's byline — with
 * the same `expo-image`, the same `contentFit`, the same 150ms fade and
 * the same person glyph, at five sizes and two glyph scales, because each
 * chose locally. One of them had drifted already: the activity rows drew
 * an 18pt glyph where the others compute `size * 0.4`.
 *
 * `size` has no default, and that is the point. `Face` in the crew list
 * defaulted to 44 — which is exactly `HEADER_CONTROL_H`, and exactly the
 * geometry of `backBtn` below. A caller has to say how big, so nobody
 * arrives at a button's diameter by not deciding.
 *
 * `accessible={false}`: this always sits beside the name or the handle it
 * belongs to, and VoiceOver announcing an image before that line adds a
 * word to every row and information to none of them.
 */
export function Avatar({ url, size }: { url?: string | null; size: number }) {
  const round = { width: size, height: size, borderRadius: size / 2 };
  if (url) {
    return (
      <Image
        source={{ uri: url }}
        style={round}
        contentFit="cover"
        transition={150}
        accessible={false}
      />
    );
  }
  return (
    <View style={[round, s.avatarBlank]} accessible={false}>
      <Ionicons name="person-outline" size={size * 0.4} color={colors.textTertiary} />
    </View>
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
  // `flex-start`, so the control and the `right` slot keep their 44pt and
  // stay level with the title's first line however many lines it takes.
  headerInline: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 14,
    paddingHorizontal: space.page, paddingTop: 6, paddingBottom: 14,
  },
  // `paddingTop` optically centres the title's first line against the 44pt
  // control without pinning either to the other's height — the same trick
  // `authUi`'s header uses, at this type size.
  headerText: { flex: 1, gap: 2, paddingTop: 5 },
  titleInline: { color: colors.text, ...type.titleDetail },
  subtitle: { color: colors.textSecondary, fontSize: 13.5, lineHeight: 18 },
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
  // Every round action in the app wears this: header search, back, share,
  // the overflow menu, the heart, person-add, reorder Done. Glass fill,
  // 44pt target, no hairline — the ring came off in the borderless pass,
  // because a filled circle is already unmistakably a button and the
  // stroke was the app's most-repeated one, on screens carrying four of
  // these at once.
  //
  // Three things this is deliberately *not*. The discs on a photograph
  // keep their dark scrim: that fill is doing contrast work over imagery
  // nobody has seen, not saying "button". Accent-tinted controls keep
  // their coral hairline, which is information rather than chrome.
  //
  // And a circle holding a *photograph of a person* is not a button
  // either — see `Avatar`. Nothing distinguishes the two shapes except
  // scale, so scale is what has to carry it: this size class is a
  // control, and a face belongs at the size of the type it sits beside.
  // A curator's face on a collection is 18pt against a 15pt line, which
  // no thumb has ever tried to press. The rule only fails if a face is
  // ever drawn at 44 next to one of these, which is why `Avatar` refuses
  // to have a default size.
  backBtn: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surfaceGlass,
  },
  // No hairline, matching the three screens this was lifted from: the ring
  // would be a fifth visual difference to argue about on a migration whose
  // whole point is that there is nothing left to argue about.
  avatarBlank: {
    backgroundColor: colors.surfaceGlass,
    alignItems: 'center', justifyContent: 'center',
  },
  empty: { padding: 48, alignItems: 'center' },
  emptyText: { color: colors.textTertiary, ...type.meta, textAlign: 'center' },
});
