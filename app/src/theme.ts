// cityCrew iOS design system.
//
// Two grounds, one system. Dark is the cinematic original: near-black
// charcoal, translucent smoky surfaces, thin warm-gray hairlines. Light is
// warm paper with white cards and near-black type. Both carry the same
// coral accent, used sparingly for active state only.
//
// HOW THE SWITCH WORKS. Every colour below is a `DynamicColorIOS` pair, a
// value UIKit resolves against the window's interface style at draw time.
// That matters because `StyleSheet.create` runs once at import: a style
// holding a plain string holds it forever, and no amount of re-rendering
// would repaint it. A dynamic colour repaints itself, so the eighteen
// module-scope stylesheets in this app need no restructuring at all —
// `Appearance.setColorScheme()` flips the window and UIKit does the rest.
//
// WHAT STAYS A PLAIN STRING, and why. Gradient stops: the accent gradient
// is coral in both themes, and the scrims over photography are dark in both
// because they sit on photographs, not on the ground. Keeping them literal
// also keeps dynamic colours out of expo-linear-gradient, which processes
// its stops itself.

import { DynamicColorIOS, Platform, type ColorValue } from 'react-native';

/**
 * A colour that knows both themes.
 *
 * iOS only — it is the platform's own mechanism. Everywhere else (the web
 * build used for quick checks) it settles on the dark value, which is the
 * app's original and only shipping ground.
 */
const dyn = (light: string, dark: string): ColorValue =>
  (Platform.OS === 'ios' ? DynamicColorIOS({ light, dark }) : dark);

export const colors = {
  /** The page. Near-black charcoal, or warm paper — never pure black or
   *  pure white, and never uniform. */
  bg: dyn('#F5F1EA', '#0A0B0A'),
  /** Surfaces that must be opaque: sheets, modals, the cards on paper. */
  bgElevated: dyn('#FFFFFF', '#151614'),
  /** Card fill. Smoky and translucent on charcoal so the ambient light
   *  reads through it; plain white on paper, where translucency would only
   *  muddy the ground it sits on. */
  surfaceCard: dyn('#FFFFFF', 'rgba(38,34,28,0.72)'),

  /** Tinted wells and quiet controls. The dark theme lifts with white at
   *  6%; the light theme cannot — white on paper is invisible — so it
   *  presses down with ink instead. */
  surfaceGlass: dyn('rgba(23,21,15,0.05)', 'rgba(247,247,245,0.06)'),
  surfaceGlassStrong: dyn('rgba(23,21,15,0.09)', 'rgba(247,247,245,0.12)'),
  /** Hairlines: warm gray at low opacity on charcoal, warm ink on paper.
   *  Never bright white, never true black. */
  borderGlass: dyn('rgba(23,21,15,0.14)', 'rgba(214,182,132,0.24)'),
  borderGlassSoft: dyn('rgba(23,21,15,0.08)', 'rgba(214,182,132,0.16)'),

  /** Measured against their own ground: 16:1, 6.4:1 and 4.9:1 on paper,
   *  comfortably past the 4.5:1 small type needs. */
  text: dyn('#17150F', '#F7F7F5'),
  textSecondary: dyn('#5C574E', '#B7B6B1'),
  textTertiary: dyn('#6E695E', '#6E706D'),

  /** The one identity colour. Coral on charcoal; a deeper coral on paper,
   *  because the bright one is 2.4:1 against white — fine as a fill, not
   *  as the label or the glyph it also has to be. */
  accent: dyn('#C4402C', '#FF6F5B'),
  /** The warm end of the accent. Gradients run accent → accentBright and
   *  stay bright in both themes: they are fills, never type. */
  accentBright: '#FF9A5C',
  /** Type and glyphs that sit *on* the accent — near-black, because the
   *  accent is a saturated warm tone in either theme. Measured: near-black
   *  on coral is 6.8:1, white is 2.7:1, and white on the gradient's orange
   *  end falls to about 2.2:1 — under the 3:1 that graphical elements need,
   *  let alone text. */
  accentInk: '#141310',
  /** The accent at fill and hairline strength, for pills and tinted wells.
   *  Coral at low alpha reads on both grounds, so one value serves both. */
  accentSoft: 'rgba(255,111,91,0.10)',
  accentLine: 'rgba(255,111,91,0.28)',
  /** The accent whispered — a mark that should register as warmth, not as
   *  a second thing to read (the rating star). */
  accentFaint: dyn('rgba(196,64,44,0.72)', 'rgba(226,96,80,0.62)'),
  /** Ambient city-light warmth for background glows — the accent diffused,
   *  so the ground and the accent belong to one light. Plain strings: they
   *  feed a gradient, and the light theme does without the glow entirely
   *  (see AmbientWarmth), because a warm haze on paper reads as a stain. */
  emberGlow: 'rgba(226,96,80,0.15)',
  emberGlowFade: 'rgba(226,96,80,0.05)',

  ok: dyn('#3F7A4A', '#8FBF8A'),
  /** Destructive. The dark theme's soft red is far too pale on paper. */
  bad: dyn('#C2564A', '#D98A80'),
};

/** The accent as a gradient, for the rare loud surface. Left to right
 *  rather than corner to corner: on a wide pill a diagonal wash puts the
 *  lightest tone under one end of the label and the darkest under the
 *  other, and the text stops reading as one weight. */
export const gradAI = {
  // The bright coral, literally — not `colors.accent`, which is darker on
  // paper and dynamic besides. A gradient is a fill, and this one is the
  // app's loudest surface in both themes.
  colors: ['#FF6F5B', '#FF9A5C'] as const,
  start: { x: 0, y: 0 },
  end: { x: 1, y: 0 },
};

/** Corner radii, in iOS points. */
export const radius = {
  /** Cards: 20–26. */
  card: 22,
  /** Photography: 16–20. */
  image: 18,
  input: 12,
  pill: 999,
  /** The floating tab container. */
  tabBar: 32,
};

/** Vertical rhythm and page margins, in iOS points. */
export const space = {
  page: 22,
  titleToContent: 24,
  headingToContent: 16,
  cardGap: 14,
  cardPadding: 16,
};

/**
 * Space Grotesk, for display type only — screen titles and the hero.
 *
 * React Native has no synthetic weights for a custom family: `fontWeight`
 * is ignored once `fontFamily` names a specific face, so a weight here is
 * a different family string, and a style that sets one must not set the
 * other. That is the whole reason this stays on display type: the app's
 * ~150 UI text styles keep the system font and keep `fontWeight`.
 */
export const display = {
  medium: 'SpaceGrotesk_500Medium',
  semibold: 'SpaceGrotesk_600SemiBold',
  bold: 'SpaceGrotesk_700Bold',
} as const;

/**
 * System font weights — RN resolves the system family to SF Pro on iOS,
 * so type reads as native rather than as a webfont.
 */
export const font = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
} as const;

/** Type scale. Hierarchy does the organising, so sizes stay few. */
export const type = {
  /** Large screen title — the one place the display face carries a whole line. */
  title: { fontSize: 34, fontFamily: display.bold, letterSpacing: 0.35 },
  /** Title of a screen that opens over another one, where a back control
   *  and the title share the top of the page. Same face as `title`: a
   *  screen's name should not change typeface with how it was reached. */
  titleDetail: { fontSize: 26, fontFamily: display.bold, letterSpacing: 0.25 },
  /** A headline standing in for content — empty states, "coming soon".
   *  Display face, because it is the only title that screen has. */
  headline: { fontSize: 20, fontFamily: display.bold, letterSpacing: 0.2 },
  /** Section heading. */
  section: { fontSize: 22, fontWeight: font.semibold, letterSpacing: 0.2 },
  /** Card title. */
  cardTitle: { fontSize: 18, fontWeight: font.semibold, letterSpacing: 0.1 },
  body: { fontSize: 16, fontWeight: font.regular },
  meta: { fontSize: 15, fontWeight: font.regular },
} as const;
