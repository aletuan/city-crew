// cityCrew iOS design system.
//
// Cinematic dark mode: near-black charcoal ground, translucent smoky
// surfaces, thin warm-gray hairlines, and champagne used sparingly for
// active state only. Depth comes from the ground, an almost-invisible
// ambient warmth, surfaces and type — not from heavy shadows.

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

  /** The one identity colour: warm champagne. Active state only. */
  champagne: '#E8D49B',
  champagneBright: '#F2DFA3',
  /** Ambient city-light warmth for background glows — muted amber, the
   *  warmest of the sanctioned glow tones, so it carries at low alpha. */
  emberGlow: 'rgba(226,168,96,0.16)',
  emberGlowFade: 'rgba(226,168,96,0.05)',

  ok: '#8FBF8A',
  bad: '#D98A80',

  /** Live "right now" signals — open now, trending, new. Same hue as the
   *  ambient warmth so energy stays inside the palette's temperature. */
  ember: '#E2A860',
};

/** A restrained champagne wash for the rare small gradient surface. */
export const gradAI = {
  colors: [colors.champagneBright, '#D9BE85'] as const,
  start: { x: 0, y: 0 },
  end: { x: 1, y: 1 },
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
  /** Large screen title. */
  title: { fontSize: 34, fontWeight: font.bold, letterSpacing: 0.35 },
  /** Section heading. */
  section: { fontSize: 22, fontWeight: font.semibold, letterSpacing: 0.2 },
  /** Card title. */
  cardTitle: { fontSize: 18, fontWeight: font.semibold, letterSpacing: 0.1 },
  body: { fontSize: 16, fontWeight: font.regular },
  meta: { fontSize: 15, fontWeight: font.regular },
} as const;
