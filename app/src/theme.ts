// cityCrew design tokens — ported from the mockup's design system
// (AI Travel Planner: dark glass surfaces, violet→pink→amber gradient).

export const colors = {
  bg: '#0B0910',
  bgElevated: '#16131B',
  surfaceGlass: 'rgba(255,255,255,0.10)',
  surfaceGlassStrong: 'rgba(255,255,255,0.16)',
  borderGlass: 'rgba(255,255,255,0.16)',
  borderGlassSoft: 'rgba(255,255,255,0.09)',

  text: '#FFFFFF',
  textSecondary: 'rgba(255,255,255,0.72)',
  textTertiary: 'rgba(255,255,255,0.45)',

  aiViolet: '#8B5CF6',
  aiPink: '#EC6CC9',
  aiAmber: '#F6A45C',

  ok: '#4ADE80',
  bad: '#F87171',
};

/** The brand gradient, ready for expo-linear-gradient. */
export const gradAI = {
  colors: [colors.aiViolet, colors.aiPink, colors.aiAmber] as const,
  start: { x: 0, y: 0 },
  end: { x: 1, y: 0.15 },
};

export const radius = {
  card: 22,
  input: 12,
  pill: 999,
};

export const font = {
  regular: 'Figtree_400Regular',
  medium: 'Figtree_500Medium',
  semibold: 'Figtree_600SemiBold',
  bold: 'Figtree_700Bold',
  extrabold: 'Figtree_800ExtraBold',
};
