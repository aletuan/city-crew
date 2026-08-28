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

/**
 * The page colour as plain hex, for the rare style that must resolve the
 * scheme in JS. Border colours are the case: a dynamic pair on a border
 * flattens against the PHONE's appearance, not the window the app set —
 * so with a light phone under a dark app, a border painted `colors.bg`
 * comes out cream on charcoal (measured, on TripCrew's face ring). Views
 * and text resolve correctly; only a border needs this escape hatch.
 * One source: `colors.bg` below is built from this same pair.
 */
export const bgHex = { light: '#F5F1EA', dark: '#0A0B0A' } as const;

export const colors = {
  /** The page. Near-black charcoal, or warm paper — never pure black or
   *  pure white, and never uniform. */
  bg: dyn(bgHex.light, bgHex.dark),
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
  /**
   * What sits inside `badge`: near-black on the solid, the readable coral
   * on the tint.
   *
   * The light value is warmer than `accent`, and deliberately so. A glyph
   * is a graphical object, which needs 3:1 — this clears it at 3.15 on the
   * composited tint, where the design's own coral would be 2.10 and the
   * accent's 3.92 was darker than the tab bar wanted to look. The tab
   * *label* under it stays on `accent`: 11.5pt type is held to 4.5:1, and
   * this colour reaches 3.64. Same tab, two thresholds, two reds — not an
   * oversight to tidy up.
   */
  badgeInk: dyn('#DC4C33', '#141310'),
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

  /**
   * The sun in the weather mark, and the second non-coral colour in the
   * app after the rating star.
   *
   * A pair rather than the star's single value because this one sits on
   * the page rather than on a photograph. The design's amber is 1.64:1
   * against paper — a mark nobody can see — so light gets a deeper gold
   * and dark keeps the bright one. Both clear 3:1, which a glyph carrying
   * the difference between rain and sun has to.
   */
  sun: dyn('#B07C10', '#F2B441'),

  ok: dyn('#3F7A4A', '#8FBF8A'),
  /** Destructive. The dark theme's soft red is far too pale on paper. */
  bad: dyn('#C2564A', '#D98A80'),
  /** The well a delete action sits in, with `bad` itself as the glyph on
   *  top. It takes the ordinary `borderGlassSoft` hairline like any other
   *  control — a red-tinted edge of its own came out near black against
   *  the dark ground, and outlined the one button that should read soft.
   *
   *  Opaque per-theme values rather than one translucent red like
   *  `accentSoft`: a tint has to stay pink to read as a warning, and the
   *  alpha that manages that on paper comes out beige over near-black. */
  badSoft: dyn('#F8DFD9', '#2A1A18'),
  /** `badSoft`'s counterpart, for the one thing that goes right loudly
   *  enough to need a ground: the banner that says a collection is now
   *  public. Built to the same recipe and the same weight — 1.11:1
   *  against paper where the red is 1.13:1 — so good news and bad news
   *  sit at the same distance from the page instead of one shouting. */
  okSoft: dyn('#D9EBD7', '#182A1C'),
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
  /**
   * The sun in the weather mark where it rides a photograph. `colors.sun`
   * is a pair that follows the page, and its paper-side deep gold is
   * exactly the mid-tone that vanishes into a scrim — over a photo the
   * bright one is right in both themes. The same value as the star, but a
   * different slot on purpose: the star's note above confines *it* to the
   * rating glyph, and this mark is not a rating.
   */
  sun: '#F2B441',
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

/**
 * The engagement ring's track, resolved by hand per scheme.
 *
 * Literal colours rather than dynamic pairs, for `gradAI`'s reason and
 * then one more. An SVG fill resolves into CoreGraphics once and comes
 * back stale after a theme change — the CGColor trap that took the camera
 * badge's border. The component reads `useScheme()` and picks a side, the
 * way `lib/theme.tsx` says the handful of non-colour cases have to.
 *
 * The arc was briefly much darker than it is now, on the grounds that a
 * graphical object owes the page 3:1. That was wrong twice over.
 *
 * WCAG's ratio is a *text* measure. It weighs luminance and is blind to
 * hue and chroma, so it scored a bright amber arc on a light track at
 * 1.36 — while the two measure ΔE2000 25, ten times the difference at
 * which a person notices anything at all. Asking "where does the colour
 * stop against the grey" is a colour-difference question, and that was
 * the wrong instrument for it.
 *
 * And the arc was never what had gone invisible. The track was, at ΔE 4.3
 * from paper. Darkening the arc was collateral: chroma held (66 → 66)
 * while lightness fell 18 to 21 points, and a saturated red-orange with
 * the lightness taken out of it is a brick. It read as old because it
 * was.
 *
 * So the arc goes back to bright and the track carries the separation
 * instead, at ΔE 9.5 from paper — more than twice what it first had, and
 * lighter than the correction that overshot. Luminance still does real
 * work, because chroma is the first thing a red-green deficiency takes
 * away: every stop stays at least 9 L* below the track, so the ring
 * survives without it.
 *
 * The badge follows none of this. It is a filled pill carrying its own
 * ground, so what it owes contrast to is its label rather than the page.
 * It keeps `gradAI`'s bright coral, where `accentInk` sits at 6.79:1.
 *
 * The track is neutral on purpose. Colour on the ring means progress; a
 * tinted track would spend it on the part that has not happened yet.
 */
export const ringTrack = { light: '#DDD7CB', dark: '#252320' } as const;

/**
 * The sweep, warm through to cool, shared by both themes.
 *
 * The offsets are not evenly spaced, and that is the point: they are
 * spaced by ΔE, so the ramp moves at a constant rate to the eye rather
 * than to the arithmetic. Laid out evenly the gold-to-lime leap is ΔE 42
 * against ΔE 14 for coral-to-rose, and the green would arrive all at once
 * while the warm end crawled.
 */
export const ringSweep = [
  { at: 0, hex: '#FF6F5B' },
  { at: 0.14, hex: '#FF8B72' },
  { at: 0.32, hex: '#FF9A5C' },
  { at: 0.58, hex: '#F2B441' },
  { at: 1, hex: '#A9C46A' },
] as const;

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
  /**
   * A stop's name, and the quiet line under it that qualifies it —
   * "Yên Hòa · 60 phút".
   *
   * Named because three screens draw that pair and all three had written
   * `gap: 2` separately, with no reason recorded anywhere. A number
   * copied three times is a number nobody chose, and the three would have
   * drifted apart the first time one of them was tuned.
   *
   * ── why it is 4 and not the 2 it was ──
   *
   * Measured off the device rather than argued from the token, because
   * the declared gap is not what the eye sees: the fonts' own line boxes
   * add slack on both sides, and what is left after the ink is the only
   * figure that matters. Three real stop rows came out at 3.3, 4.3 and
   * 5.7pt of clear space — the same 2, swinging 70% on nothing but which
   * letters landed there. For comparison, `PlaceCard` draws the same kind
   * of pair at 9.7pt, under a comment calling itself deliberately tight.
   *
   * The swing is Vietnamese. The gap is eaten from both sides: `ạ` in
   * "Đạo" hangs a dot below the baseline, and `ế` in "Kiếm" stacks a
   * circumflex under an acute and rides above cap height — in the
   * measurement it separates into an ink band of its own. English never
   * reaches into this gap from either direction, so a layout reviewed in
   * English never sees it.
   *
   * 4 puts the tightest row at about 5.3pt, which is where the loosest
   * one sits today. It leaves these rows still the closest-set pair in
   * the app, which is right: an itinerary is denser than a card by
   * design.
   */
  nameToMeta: 4,
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
 * Lora's italic, for words the app borrows rather than writes — the
 * quotation in the Profile footer. A calligraphic serif set apart from
 * both the grotesk display face and the system UI type, so a quoted
 * sentence reads as a voice from outside the app. One weight, because
 * a quotation has one register. Ships a Vietnamese subset; Japanese
 * falls back to the system face glyph by glyph, which is the deal with
 * any Latin serif. Same fontWeight caveat as `display`.
 */
export const quoteFace = 'Lora_500Medium_Italic';

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
