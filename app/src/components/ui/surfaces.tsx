// The surfaces: the screen scaffold, cards, skeletons, glass, avatars and
// the empty line.

import React, { useEffect, useRef } from 'react';
import { Animated, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { setStatusBarStyle, type StatusBarStyle } from 'expo-status-bar';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useScheme } from '../../lib/theme';
import { colors, display, font, glass, radius, space, type } from '../../theme';
import { BackButton } from './controls';

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

// One imperative owner avoids mixing a mounted native StatusBar's deferred
// update with screen effects: on reload that deferred default overwrote
// Explore's white ink. The default must also respect a screen that focused
// before it mounted, and a late blur must not erase the next screen's ink.
let statusBarOwner: (() => StatusBarStyle) | null = null;

export function AppStatusBar() {
  const { scheme } = useScheme();
  useEffect(() => {
    setStatusBarStyle(statusBarOwner?.() ?? (scheme === 'light' ? 'dark' : 'light'), true);
  }, [scheme]);
  return null;
}

/** Focused photo screens supply light ink; null uses the current theme.
 * Call the returned function when scrolling changes what is under the clock. */
export function useOwnedStatusBar(want: () => StatusBarStyle | null): () => void {
  const navigation = useNavigation();
  const wantRef = useRef(want);
  wantRef.current = want;
  const light = useScheme().scheme === 'light';
  const lightRef = useRef(light);
  lightRef.current = light;
  const focusedRef = useRef(false);
  const own = useRef(() => (lightRef.current ? 'dark' : 'light') as StatusBarStyle).current;
  const resolve = useRef(() => wantRef.current() ?? own()).current;
  const apply = useRef(() => {
    if (focusedRef.current && statusBarOwner === resolve) setStatusBarStyle(resolve(), true);
  }).current;
  useEffect(() => {
    const focus = () => { focusedRef.current = true; statusBarOwner = resolve; apply(); };
    const blur = () => {
      focusedRef.current = false;
      if (statusBarOwner === resolve) {
        statusBarOwner = null;
        setStatusBarStyle(own(), true);
      }
    };
    // The first focus event can land before these listeners exist.
    if (navigation.isFocused()) focus();
    const a = navigation.addListener('focus', focus);
    const b = navigation.addListener('blur', blur);
    return () => { a(); b(); blur(); };
  }, [navigation, apply, own, resolve]);
  // The scheme can flip while this screen holds the bar.
  useEffect(apply, [light, apply]);
  return apply;
}

/**
 * A subtitle that leads with a small glyph — the calendar before a date,
 * matching the metaRow every trip card already draws. Passed as Screen's
 * subtitle node; the text wears the same one-line style a plain string
 * subtitle gets, so the only difference is the mark.
 *
 * ── the mark is accent, and that sentence above is why ──
 *
 * It said it matched the trip card's metaRow while drawing in
 * `textSecondary`, which is the one colour that metaRow does not use. So
 * the same calendar was grey in a trip's header and coral on the card
 * that opened it — one screen apart, one tap apart, and nothing chose
 * that difference.
 *
 * The mark, not the text: the line stays `s.subtitle` so the header keeps
 * its quiet, and only the glyph carries the accent. That is the same
 * division `RoundIconButton`'s `color` note draws — a glyph is allowed
 * its own ink, and the failure to guard for is one gesture wearing two
 * colours on two screens.
 */
export function IconSubtitle({ icon, text }: {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
}) {
  return (
    <View style={s.iconSubtitle}>
      <Ionicons name={icon} size={13} color={colors.accent} />
      <Text style={[s.subtitle, { flexShrink: 1 }]} numberOfLines={1}>{text}</Text>
    </View>
  );
}

export function Screen({ title, subtitle, eyebrow, lede, children, right, onBack, backTestID }: {
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
  /**
   * A line or three under the large title, inside the title's own column
   * — so a `right` node that reserves width narrows this too, and the
   * two never meet. Large-title screens only; the inline header has
   * `subtitle`. Brings its own type, the way `eyebrow` does.
   *
   * Exists for the Ideas screen, whose lede used to open the scrolling
   * content and now shares the fixed band with the title and the
   * illustration beside both (see `IdeasHeaderArt`).
   */
  lede?: React.ReactNode;
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
  /** For the smoke flows, which select by id: a pushed screen's way back. */
  backTestID?: string;
}) {
  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      {onBack ? (
        <View style={s.headerInline}>
          <BackButton onPress={onBack} testID={backTestID} />
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
            {lede ?? null}
          </View>
          {right}
        </View>
      )}
      {children}
    </SafeAreaView>
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
/**
 * A number at a row's end, in a pill.
 *
 * A pill, not a bare figure: on the Profile "30" and "6" floated between
 * the text and the chevron with nothing to say they were counts rather
 * than values, and the settings rows two cards down print their value
 * in that very spot. One tone and one shape for every count, because the
 * number means one thing wherever it stands — the size of what is behind
 * the row, or above the list — which is why it lives here and not on
 * the Profile alone: the check-in sheet on a place's screen says how
 * many visits with the same pill. Zero draws nothing: a count with
 * nothing behind it is not a fact.
 */
export function CountBadge({ n, style }: { n: number; style?: StyleProp<ViewStyle> }) {
  if (!n) return null;
  return (
    <View style={[s.badge, style]} testID="count-badge">
      <Text style={s.badgeText}>{n}</Text>
    </View>
  );
}

export function Card({ children, style, testID }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; testID?: string }) {
  return <View style={[s.card, style]} testID={testID}>{children}</View>;
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
      <View style={{ flex: 1, backgroundColor: glass.veil[light ? 'light' : 'dark'] }} />
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
  // The look's own ground, per side (`glass` in theme.ts): the halo
  // stands in for the ground the glass has thinned.
  textShadowColor: glass.halo[light ? 'light' : 'dark'],
  textShadowOffset: { width: 0, height: 0 },
  textShadowRadius: 3,
});

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
 *
 * `memory-disk`, because `expo-image` defaults to `disk` alone: every
 * mount read the file back and decoded it again, so the eight faces of
 * the crew list arrived after the names on every visit, not only the
 * first. The owner saw it on 19 Oct 2026. `CrewProvider` prefetches into
 * the same memory cache, which is why the two policies have to match.
 *
 * The blank disc sits behind the picture, too. A face still on its way
 * used to be a hole the colour of the card; now it is the same circle a
 * person with no photo has, and the picture fades in over it.
 */
export function Avatar({ url, size }: { url?: string | null; size: number }) {
  const round = { width: size, height: size, borderRadius: size / 2 };
  if (url) {
    return (
      <Image
        source={{ uri: url }}
        style={[round, s.avatarBlank]}
        cachePolicy="memory-disk"
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
  subtitle: { color: colors.textSecondary, fontSize: 14, lineHeight: 18 },
  iconSubtitle: { flexDirection: 'row', alignItems: 'center', gap: 6 },
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
  badge: {
    minWidth: 32, height: 22, paddingHorizontal: 8, borderRadius: 11,
    backgroundColor: colors.surfaceGlassStrong, alignItems: 'center', justifyContent: 'center',
  },
  badgeText: { color: colors.textSecondary, fontSize: 13, fontWeight: font.semibold },
  card: {
    backgroundColor: colors.surfaceCard, borderRadius: radius.card,
    borderWidth: 1, borderColor: colors.borderGlassSoft, overflow: 'hidden',
  },
  ambient: { position: 'absolute', left: 0, right: 0, top: -40, height: 760 },
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
