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

  /**
   * The accent **as something to read** — a label, a glyph, a link.
   *
   * Coral on charcoal; a deeper coral on paper, because the bright one is
   * 2.4:1 against white. That split is about legibility, and it must not
   * leak into the accent as a *surface* — see `accentFill`. When it did,
   * the app showed three oranges at once: brick discs, coral gradients,
   * and pink tints, each claiming to be the identity colour.
   */
  accent: dyn('#C4402C', '#FF6F5B'),
  /**
   * The accent **as a surface** — a ticked checkbox, anything that must
   * read as switched on. One value for both themes, and the same coral the
   * gradient and the tints are made of, because a fill has no legibility
   * problem to solve: whatever sits on it is `accentInk`, 6.8:1 either way.
   */
  accentFill: '#FF6F5B',
  /**
   * A round emphasis badge: the selected tab's disc, the avatar's camera
   * button. The one pattern that changes *treatment* between themes rather
   * than only its value.
   *
   * Charcoal needs the solid — a 16% tint on a near-black ground is barely
   * a shape. Paper needs the tint — a saturated disc there is the heaviest
   * object on a page whose whole character is lightness, and it drags the
   * eye to the tab bar over the content. Same reasoning, opposite answer,
   * which is why this cannot be one value.
   */
  badge: dyn('rgba(255,111,91,0.16)', '#FF6F5B'),
  /**
   * The same badge where it overlaps a photograph rather than a surface —
   * the avatar's camera button.
   *
   * On paper this is `badge` already composited over `bg`, so against the
   * page it is indistinguishable from the tint, and against the photo it
   * covers. A 16% fill there let the picture through and left the glyph
   * sitting on whatever pixels happened to be under it. Dark needs no
   * variant: its badge is opaque already.
   */
  badgeSolid: dyn('#F7DCD3', '#FF6F5B'),
  /** What sits inside `badge`: near-black on the solid, the readable coral
   *  on the tint. */
  badgeInk: dyn('#C4402C', '#141310'),
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
  /** Destructive at fill and hairline strength — the well a delete action
   *  sits in, with `bad` itself as the glyph on top.
   *
   *  Opaque per-theme values rather than one translucent red like
   *  `accentSoft`: a tint has to stay pink to read as a warning, and the
   *  alpha that manages that on paper comes out beige over near-black. */
  badSoft: dyn('#F8DFD9', '#2A1A18'),
  badLine: dyn('#F0C8BF', '#3D2523'),
};

/**
 * Type, hairlines and marks that sit **on a photograph**.
 *
 * These do not belong to either theme, and that is the whole point: their
 * ground is the picture and the dark scrim laid over it, not the page. A
 * dynamic colour here follows the wrong thing — switch to the light theme
 * and the hero's title turns near-black over a dark scrim over a night
 * photo, which is how this got noticed.
 *
 * The rule for a call site: if the thing behind it is `colors.bg` or a
 * card, use `colors`. If the thing behind it is an image, use these.
 */
export const onPhoto = {
  text: '#F7F7F5',
  textSecondary: 'rgba(247,247,245,0.82)',
  /** Hairlines on the scrim pills and badges. */
  line: 'rgba(247,247,245,0.22)',
  /** The accent as it must appear over a photograph: the bright coral,
   *  never the paper theme's darker one, which disappears into a scrim. */
  accent: '#FF6F5B',
  /**
   * The rating star, and the one colour in the app that is not coral.
   *
   * A deliberate exception to the one-accent rule, and a narrow one: a
   * gold star is a convention old enough that a coral one reads as
   * decoration rather than as a score. It is confined to this single 13pt
   * glyph on a photo scrim — it never fills, never underlines, and never
   * appears on the page itself.
   */
  star: '#F2B441',
} as const;

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
