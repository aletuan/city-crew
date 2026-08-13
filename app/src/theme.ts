// cityCrew iOS design system.
//
// Cinematic dark mode: near-black charcoal ground, translucent smoky
// surfaces, thin warm-gray hairlines, and one accent used sparingly for
// active state only. Depth comes from the ground, an almost-invisible
// ambient warmth, surfaces and type — not from heavy shadows.
//
// The accent is coral running to orange. Every accented surface in the app
// derives from the tokens below, so the identity colour is changed here and
// nowhere else.

export const colors = {
  /** Near-black charcoal — never pure black, never uniform. */
  bg: '#0A0B0A',
  /** Solid charcoal for surfaces that must be opaque. */
  bgElevated: '#151614',
  /** Translucent smoky card fill, warm-cast so the ambient light reads
   *  through it rather than sitting behind a neutral panel. */
  surfaceCard: 'rgba(38,34,28,0.72)',

  surfaceGlass: 'rgba(247,247,245,0.06)',
  surfaceGlassStrong: 'rgba(247,247,245,0.12)',
  /** Hairlines are warm gray at low opacity, never bright white. */
  borderGlass: 'rgba(214,182,132,0.24)',
  borderGlassSoft: 'rgba(214,182,132,0.16)',

  text: '#F7F7F5',
  textSecondary: '#B7B6B1',
  textTertiary: '#6E706D',

  /** The one identity colour: coral. Active state only. */
  accent: '#FF6F5B',
  /** The warm end of the accent — gradients run accent → accentBright. */
  accentBright: '#FF9A5C',
  /** Type and glyphs that sit *on* the accent — near-black, because the
   *  accent is a light, saturated warm tone. Measured: near-black on coral
   *  is 6.8:1, white is 2.7:1, and white on the gradient's orange end falls
   *  to about 2.2:1 — under the 3:1 that graphical elements need, let alone
   *  text. White also fringes slightly against a warm ground at glyph size. */
  accentInk: '#141310',
  /** The accent at fill and hairline strength, for pills and tinted wells. */
  accentSoft: 'rgba(255,111,91,0.10)',
  accentLine: 'rgba(255,111,91,0.28)',
  /** The accent whispered — a mark that should register as warmth, not as
   *  a second thing to read (the rating star). */
  accentFaint: 'rgba(255,111,91,0.62)',
  /** Ambient city-light warmth for background glows — the accent diffused,
   *  so the ground and the accent belong to one light. */
  emberGlow: 'rgba(226,96,80,0.15)',
  emberGlowFade: 'rgba(226,96,80,0.05)',

  ok: '#8FBF8A',
  bad: '#D98A80',
};

/** The accent as a gradient, for the rare loud surface. Left to right
 *  rather than corner to corner: on a wide pill a diagonal wash puts the
 *  lightest tone under one end of the label and the darkest under the
 *  other, and the text stops reading as one weight. */
export const gradAI = {
  colors: [colors.accent, colors.accentBright] as const,
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
