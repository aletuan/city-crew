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
  /** Translucent smoky card fill with a faint warm cast. */
  surfaceCard: 'rgba(32,31,28,0.72)',

  surfaceGlass: 'rgba(247,247,245,0.06)',
  surfaceGlassStrong: 'rgba(247,247,245,0.12)',
  /** Hairlines are warm gray at low opacity, never bright white. */
  borderGlass: 'rgba(190,180,155,0.18)',
  borderGlassSoft: 'rgba(190,180,155,0.11)',

  text: '#F7F7F5',
  textSecondary: '#B7B6B1',
  textTertiary: '#6E706D',

  /** The one identity colour: warm champagne. Active state only. */
  champagne: '#E8D49B',
  champagneBright: '#F2DFA3',
  /** Ambient city-light warmth for background glows. */
  emberGlow: 'rgba(232,196,132,0.055)',

  ok: '#8FBF8A',
  bad: '#D98A80',
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
