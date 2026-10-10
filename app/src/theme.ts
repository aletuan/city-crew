// City Crew iOS design system.
//
// Four palettes, worn as three looks (`lib/look.ts`, 10 Oct 2026). The
// standard look is two grounds, one system: warm paper with white cards and
// near-black type, and the cinematic charcoal #0A0B0A with warm-gray
// hairlines — Light, Dark and Automatic in the Appearance sheet. Coffee is
// the owner's two-tone reference turned into a whole theme: brown #271910
// under cream type, the cream #C7AA9A the secondary type and the hairline.
// It replaced charcoal for a day (#861) and is now a look of its own beside
// it. Rose is the second reference, slate rose #B45865 on transparent
// yellow #F4ECC2, a light look; its note is on `ROSE` below.
//
// Notes on a token below were written for the standard pair and the coffee
// brown; a figure for another palette says which it is, and `theme.test.ts`
// holds every palette to the same contrast floors.
//
// Why the cream is not the page anywhere: it is a mid-tone, and on it the
// category hues fall to 1.0–1.3:1, the coral to 1.26 and the visited green
// to 1.04. The colour code would stop being a code. On the brown they are
// 6.0–8.1, 6.23 and 8.1. Paper, charcoal and coffee carry the same
// coral accent, Rose its rose, used sparingly for active state only — with one standing
// exception, the itinerary rail (`components/rail`): its paw and dots are
// coral on every stop because the rail is the route, drawn once per
// screen, not a state. A coral surface under anything that is not the
// route is still what the rule forbids.
//
// HOW THE SWITCH WORKS. Every colour below that differs between the look's
// two sides is a `DynamicColorIOS` pair, a value UIKit resolves against
// the window's interface style at draw time.
// That matters because `StyleSheet.create` runs once at import: a style
// holding a plain string holds it forever, and no amount of re-rendering
// would repaint it. A dynamic colour repaints itself, so the eighteen
// module-scope stylesheets in this app need no restructuring at all —
// `Appearance.setColorScheme()` flips the window and UIKit does the rest.
// A pair has two sides and no more, so a change of look is a restart
// instead: `loadedLook` below is read once, before any stylesheet is built.
//
// WHAT STAYS A PLAIN STRING, and why. Gradient stops: the accent gradient
// is one per look (coral, or Rose's rose) on both sides, and the scrims over photography are dark in both
// because they sit on photographs, not on the ground. Keeping them literal
// also keeps dynamic colours out of expo-linear-gradient, which processes
// its stops itself.

import { DynamicColorIOS, Platform, Settings, type ColorValue } from 'react-native';
import { readLook, storeOf, type Look } from './lib/look';

/**
 * A colour that knows both themes.
 *
 * iOS only — it is the platform's own mechanism. Everywhere else (the web
 * build used for quick checks) it settles on the dark value, which is the
 * app's original and only shipping ground.
 */
const dyn = (light: string, dark: string): ColorValue =>
  (Platform.OS === 'ios' ? DynamicColorIOS({ light, dark }) : dark);

// ── the four palettes ──
//
// Every colour token's value, per palette. `colors` below is built from
// whichever two the loaded look pairs (`lib/look.ts`), and keeps the notes
// on what each token is for. A value that is the same on both sides of the
// look goes out as a plain string, a value that differs as a `dyn` pair —
// so under Coffee and Rose, which wear one palette on both sides, nothing
// is dynamic at all, and the border bug in the note below cannot happen.

export type Palette = {
  bg: string;
  bgElevated: string;
  bgElevatedVeil: string;
  surfaceCard: string;
  surfaceGlass: string;
  surfaceGlassStrong: string;
  borderGlass: string;
  borderGlassSoft: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  accent: string;
  accentFill: string;
  badge: string;
  badgeSolid: string;
  badgeInk: string;
  accentBright: string;
  accentInk: string;
  accentSoft: string;
  accentLine: string;
  accentFaint: string;
  emberGlow: string;
  emberGlowFade: string;
  sun: string;
  soon: string;
  ok: string;
  open: string;
  shutInk: string;
  ink: string;
  bad: string;
  badSoft: string;
  okSoft: string;
  okInk: string;
  /** The accent as a gradient's two stops — see `gradAI`. */
  gradAI: readonly [string, string];
  /** The engagement ring's track — see `ringTrack`. */
  ringTrack: string;
  /** Glyph and caption on the tab bar's selected pill. */
  pillInk: string;
  /** The welcome art's heart. */
  heartInk: string;
  /** The accent where it rides a photograph — see `onPhoto.accent`. */
  onPhotoAccent: string;
  /** The veil inside the frosted glass (tab bar, Explore's dock). */
  glassVeil: string;
  /** The halo behind type on that glass. */
  glassHalo: string;
  /** The accent all but faded out, the far end of a tinted wash. */
  accentFade: string;
};

/** Light, the standard look: warm paper, white cards, near-black type. */
const PAPER: Palette = {
  bg: '#F5F1EA',
  bgElevated: '#FFFFFF',
  bgElevatedVeil: 'rgba(255,255,255,0.88)',
  surfaceCard: '#FFFFFF',
  surfaceGlass: 'rgba(23,21,15,0.05)',
  surfaceGlassStrong: 'rgba(23,21,15,0.09)',
  borderGlass: 'rgba(23,21,15,0.14)',
  borderGlassSoft: 'rgba(23,21,15,0.08)',
  text: '#17150F',
  textSecondary: '#5C574E',
  textTertiary: '#6E695E',
  accent: '#C4402C',
  accentFill: '#FF6F5B',
  badge: 'rgba(255,111,91,0.16)',
  badgeSolid: '#F7DCD3',
  badgeInk: '#DC4C33',
  accentBright: '#FF9A5C',
  accentInk: '#141310',
  accentSoft: 'rgba(255,111,91,0.10)',
  accentLine: 'rgba(255,111,91,0.28)',
  accentFaint: 'rgba(196,64,44,0.72)',
  emberGlow: 'rgba(226,96,80,0.15)',
  emberGlowFade: 'rgba(226,96,80,0.05)',
  sun: '#B07C10',
  soon: '#94670F',
  ok: '#3F7A4A',
  open: '#3F7D55',
  shutInk: '#972F2B',
  ink: '#211F1C',
  bad: '#C2564A',
  badSoft: '#F8DFD9',
  okSoft: '#D9EBD7',
  okInk: '#2F6B3B',
  gradAI: ['#FF6F5B', '#FF9A5C'],
  ringTrack: '#DDD7CB',
  pillInk: '#A33724',
  heartInk: '#E8542F',
  onPhotoAccent: '#FF6F5B',
  glassVeil: 'rgba(250,248,244,0.48)',
  glassHalo: 'rgba(250,248,244,0.95)',
  accentFade: 'rgba(255,111,91,0.02)',
};

/** Dark, the standard look: near-black charcoal, smoky surfaces, warm-gray
 *  hairlines. The cinematic original, back as the dark half of the standard
 *  look on 10 Oct 2026 after a day as the coffee brown (#861). */
const CHARCOAL: Palette = {
  bg: '#0A0B0A',
  bgElevated: '#151614',
  bgElevatedVeil: 'rgba(21,22,20,0.88)',
  surfaceCard: 'rgba(38,34,28,0.72)',
  surfaceGlass: 'rgba(247,247,245,0.06)',
  surfaceGlassStrong: 'rgba(247,247,245,0.12)',
  borderGlass: 'rgba(214,182,132,0.24)',
  borderGlassSoft: 'rgba(214,182,132,0.16)',
  text: '#F7F7F5',
  textSecondary: '#B7B6B1',
  textTertiary: '#8E908C',
  accent: '#FF6F5B',
  accentFill: '#FF6F5B',
  badge: '#FF6F5B',
  badgeSolid: '#FF6F5B',
  badgeInk: '#141310',
  accentBright: '#FF9A5C',
  accentInk: '#141310',
  accentSoft: 'rgba(255,111,91,0.10)',
  accentLine: 'rgba(255,111,91,0.28)',
  accentFaint: 'rgba(226,96,80,0.62)',
  emberGlow: 'rgba(226,96,80,0.15)',
  emberGlowFade: 'rgba(226,96,80,0.05)',
  sun: '#F2B441',
  soon: '#F2B441',
  ok: '#8FBF8A',
  open: '#8FBF8A',
  shutInk: '#E2857A',
  ink: '#ECEBE7',
  bad: '#D98A80',
  badSoft: '#2A1A18',
  okSoft: '#182A1C',
  okInk: '#8FBF8A',
  gradAI: ['#FF6F5B', '#FF9A5C'],
  ringTrack: '#252320',
  pillInk: '#141310',
  heartInk: '#FF6F5B',
  onPhotoAccent: '#FF6F5B',
  glassVeil: 'rgba(12,13,12,0.48)',
  glassHalo: 'rgba(10,11,10,0.95)',
  accentFade: 'rgba(255,111,91,0.02)',
};

/** "Nâu cafe" (#861): coffee brown #271910 under cream, from the owner's
 *  two-tone reference. The cream #C7AA9A is the secondary type and the
 *  hairline, never the page. Its own look now, pinned dark. */
const COFFEE: Palette = {
  bg: '#271910',
  bgElevated: '#33231A',
  bgElevatedVeil: 'rgba(39,25,16,0.9)',
  surfaceCard: 'rgba(64,45,34,0.72)',
  surfaceGlass: 'rgba(243,233,226,0.06)',
  surfaceGlassStrong: 'rgba(243,233,226,0.12)',
  borderGlass: 'rgba(199,170,154,0.24)',
  borderGlassSoft: 'rgba(199,170,154,0.16)',
  text: '#F3E9E2',
  textSecondary: '#C7AA9A',
  textTertiary: '#A88B7A',
  accent: '#FF6F5B',
  accentFill: '#FF6F5B',
  badge: '#FF6F5B',
  badgeSolid: '#FF6F5B',
  badgeInk: '#141310',
  accentBright: '#FF9A5C',
  accentInk: '#141310',
  accentSoft: 'rgba(255,111,91,0.10)',
  accentLine: 'rgba(255,111,91,0.28)',
  accentFaint: 'rgba(226,96,80,0.62)',
  emberGlow: 'rgba(226,96,80,0.15)',
  emberGlowFade: 'rgba(226,96,80,0.05)',
  sun: '#F2B441',
  soon: '#F2B441',
  ok: '#8FBF8A',
  open: '#8FBF8A',
  shutInk: '#E2857A',
  ink: '#EDE1D8',
  bad: '#D98A80',
  badSoft: '#422520',
  okSoft: '#24361F',
  okInk: '#8FBF8A',
  gradAI: ['#FF6F5B', '#FF9A5C'],
  ringTrack: '#3A2A20',
  pillInk: '#141310',
  heartInk: '#FF6F5B',
  onPhotoAccent: '#FF6F5B',
  glassVeil: 'rgba(39,25,16,0.48)',
  glassHalo: 'rgba(39,25,16,0.95)',
  accentFade: 'rgba(255,111,91,0.02)',
};

/**
 * "Hồng" (10 Oct 2026): the owner's reference, transparent yellow #F4ECC2
 * under slate rose #B45865, as a light look.
 *
 * The yellow is the page. The rose is the accent, but not as type: on the
 * yellow it is 3.9:1, under the 4.5 small type needs, so the readable accent
 * is the rose a step down, #9A4452 (5.3 on the page, 6.1 on a card), and the
 * reference's own #B45865 is the fill — solid buttons, the gradient — with
 * white on it (4.64; the reference's yellow on rose is 3.9). The gradient
 * runs #A04A57 → #B45865 so its lighter end still carries white at 4.6.
 * Type is a plum-black, #2B1A1D (13.9:1), and the secondary steps are
 * rose-tinted greys, #5A4649 and #75605F (6.9 and 4.9, 1.49 apart).
 * Destructive moves to a brick red, #9C3B2F, so it is not the accent.
 */
const ROSE: Palette = {
  bg: '#F4ECC2',
  bgElevated: '#FFFCEB',
  bgElevatedVeil: 'rgba(255,252,235,0.88)',
  surfaceCard: '#FFFCEB',
  surfaceGlass: 'rgba(43,26,29,0.05)',
  surfaceGlassStrong: 'rgba(43,26,29,0.09)',
  borderGlass: 'rgba(43,26,29,0.14)',
  borderGlassSoft: 'rgba(43,26,29,0.08)',
  text: '#2B1A1D',
  textSecondary: '#5A4649',
  textTertiary: '#75605F',
  accent: '#9A4452',
  accentFill: '#B45865',
  badge: 'rgba(180,88,101,0.16)',
  badgeSolid: '#F0D2CA',
  badgeInk: '#9A4452',
  accentBright: '#B45865',
  accentInk: '#FFFFFF',
  accentSoft: 'rgba(180,88,101,0.12)',
  accentLine: 'rgba(180,88,101,0.32)',
  accentFaint: 'rgba(154,68,82,0.72)',
  emberGlow: 'rgba(180,88,101,0.12)',
  emberGlowFade: 'rgba(180,88,101,0.04)',
  sun: '#A0720E',
  soon: '#94670F',
  ok: '#3F7A4A',
  open: '#3F7D55',
  shutInk: '#972F2B',
  ink: '#3A2629',
  bad: '#9C3B2F',
  badSoft: '#F6D6C8',
  okSoft: '#DCE8C4',
  okInk: '#2F6B3B',
  gradAI: ['#A04A57', '#B45865'],
  ringTrack: '#E3D9AE',
  pillInk: '#8E3C4A',
  heartInk: '#B45865',
  onPhotoAccent: '#EC8C98',
  glassVeil: 'rgba(250,246,222,0.48)',
  glassHalo: 'rgba(250,246,222,0.95)',
  accentFade: 'rgba(180,88,101,0.02)',
};

export const PALETTES = { paper: PAPER, charcoal: CHARCOAL, coffee: COFFEE, rose: ROSE } as const;

/** Each look's two sides: the light half and the dark half of every pair. */
export const LOOKS: Record<Look, { light: Palette; dark: Palette }> = {
  standard: { light: PAPER, dark: CHARCOAL },
  coffee: { light: COFFEE, dark: COFFEE },
  rose: { light: ROSE, dark: ROSE },
};

/**
 * The look this run of the app is wearing, read once, before any
 * stylesheet is built. `Settings` is iOS's NSUserDefaults, synchronous;
 * anywhere it is missing (the web build, the test runner) this is the
 * standard look.
 */
export const loadedLook: Look = readLook(storeOf(() => Settings));

const SIDES = LOOKS[loadedLook];
/** One token, as a plain value where the look's two sides agree and as a
 *  `dyn` pair where they do not. */
const pick = (k: Exclude<keyof Palette, 'gradAI'>): ColorValue =>
  (SIDES.light[k] === SIDES.dark[k] ? SIDES.light[k] : dyn(SIDES.light[k], SIDES.dark[k]));

/**
 * The page colour as plain hex, for the rare style that must resolve the
 * scheme in JS. Border colours are the case: a dynamic pair on a border
 * flattens against the PHONE's appearance, not the window the app set —
 * so with a light phone under a dark app, a border painted `colors.bg`
 * comes out cream on charcoal (measured, on TripCrew's face ring). Views
 * and text resolve correctly; only a border needs this escape hatch.
 * One source: `colors.bg` below is built from this same pair.
 *
 * ── why, in React Native's own code ──
 *
 * `RCTViewComponentView` (RN 0.86, Fabric) resolves a view's background
 * against the view — `[_backgroundColor resolvedColorWithTraitCollection:
 * self.traitCollection]` — but takes its border straight off the colour,
 * `layer.borderColor = borderColor.CGColor`, and a dynamic UIColor asked
 * for its CGColor outside a trait-scoped callback resolves against
 * `UITraitCollection.currentTraitCollection`: the phone's, not the
 * window's `overrideUserInterfaceStyle` that `Appearance.setColorScheme()`
 * set. So a reader who picks Light in the app on a phone in Dark gets
 * dark borders on light fills — the visited pill's green on 10 Oct 2026,
 * ringed in `okSoft`'s charcoal-side #182A1C.
 *
 * The rule that follows, until a native patch resolves borders against
 * the view: **never put a `dyn` pair on a border whose two sides differ
 * enough to see.** A border that only holds a fill's size takes
 * `'transparent'`; a border that must show takes a plain pair resolved
 * with `useScheme()`, as `bgHex`, `bgElevatedHex` and `badgeSolidHex` do.
 * The hairlines (`borderGlass`, `borderGlassSoft`) and a few same-hue
 * rings still ride the bug (`borders.test.ts` lists them, and fails on
 * any new one), and are the reason a native patch is worth a binary.
 *
 * That patch is two lines in `RCTViewComponentView.mm` — resolve the
 * border's UIColor against `self.traitCollection` before taking its
 * CGColor, as the background already is — but it is not a node_modules
 * edit alone: Expo builds iOS against the prebuilt `React.xcframework`
 * by default, which a patch to the source does not reach. It needs
 * `ios.buildReactNativeFromSource` in `expo-build-properties` as well,
 * slower builds, and a TestFlight binary; an EAS Update cannot carry it.
 */
export const bgHex = { light: SIDES.light.bg, dark: SIDES.dark.bg } as const;
/** `colors.bgElevated` as plain hex, for a border — see `bgHex`. */
export const bgElevatedHex = { light: SIDES.light.bgElevated, dark: SIDES.dark.bgElevated } as const;
/** `colors.text` as plain hex, for a prop typed `string` (the tab bar's
 *  idle glyphs) — the same escape hatch as `bgHex`, for another reason. */
export const textHex = { light: SIDES.light.text, dark: SIDES.dark.text } as const;
/** `colors.badgeSolid` as plain hex, for a border — see `bgHex`. */
export const badgeSolidHex = { light: SIDES.light.badgeSolid, dark: SIDES.dark.badgeSolid } as const;

export const colors = {
  /** The page. Charcoal or warm paper, the coffee brown, or Rose's
   *  yellow — never pure black or pure white, and never uniform. */
  bg: pick('bg'),
  /** Surfaces that must be opaque: sheets, modals, the cards on paper. */
  bgElevated: pick('bgElevated'),
  /**
   * `bgElevated` with a little of what is behind it showing through — for
   * a control that floats over something this app did not draw.
   *
   * Not `surfaceGlass`, which is a wash with no ground of its own and so
   * takes the colour of whatever it lands on; this keeps its own and only
   * thins it.
   *
   * 0.88, and the number was measured twice because the first measurement
   * asked the wrong question. A map preview is *always* a light Google
   * tile — `MiniMap` passes no night style — so the punishing case is not
   * the light theme at all, it is the dark theme's near-black disc over
   * pale roads and park green. Solved for the light tiles both themes
   * actually land on, 0.88 is where the coral glyph clears 4.5:1 on both:
   * 4.76 by day, 4.71 by night. At 0.78, which was the first answer, the
   * night figure is 3.31 — still legal for a glyph, and visibly thinner
   * than it should be for the one control the card exists for.
   *
   * On the coffee ground (10 Oct 2026) the night side thins the *page*
   * colour, #271910, at 0.90, not `bgElevated`. The elevated brown is
   * lighter than charcoal was, and over a white road it held the coral
   * to 3.80:1 at 0.88 and 4.05 at 0.90; the page brown at 0.90 is 4.65,
   * the only pair under the 0.90 ceiling that clears 4.5.
   */
  bgElevatedVeil: pick('bgElevatedVeil'),
  /** Card fill. Smoky and translucent on charcoal so the ambient light
   *  reads through it; plain white on paper, where translucency would only
   *  muddy the ground it sits on. */
  surfaceCard: pick('surfaceCard'),
  /** Tinted wells and quiet controls. The dark theme lifts with white at
   *  6%; the light theme cannot — white on paper is invisible — so it
   *  presses down with ink instead. */
  surfaceGlass: pick('surfaceGlass'),
  surfaceGlassStrong: pick('surfaceGlassStrong'),
  /** Hairlines: a warm tan, 214/182/132, at low opacity on charcoal, the
   *  reference's cream on the brown, warm ink on paper and plum ink on
   *  Rose's yellow. Never bright white, never true black. */
  borderGlass: pick('borderGlass'),
  borderGlassSoft: pick('borderGlassSoft'),
  /** Measured against their own ground: 16:1, 6.4:1 and 4.9:1 on paper,
   *  comfortably past the 4.5:1 small type needs.
   *
   *  On the brown: #F3E9E2 is 14.3:1 on `bg` and 12.6 on `bgElevated`,
   *  the reference's #C7AA9A 7.8 and 6.9, and #A88B7A 5.4 and 4.8 — a
   *  step down from #A08473, which was 4.9 on the page but 4.33 on a
   *  sheet. 1.45:1 between the second and third keeps the three steps
   *  three. On charcoal they are #F7F7F5, #B7B6B1 and #8E908C, the
   *  third after #6E706D measured 3.9:1 under 12–15pt copy.
   *  `theme.test.ts` holds all three to 4.5:1 on every palette's grounds. */
  text: pick('text'),
  textSecondary: pick('textSecondary'),
  textTertiary: pick('textTertiary'),
  /**
   * The accent **as something to read** — a label, a glyph, a link.
   *
   * Coral on charcoal; a deeper coral on paper, because the bright one is
   * 2.4:1 against white. That split is about legibility, and it must not
   * leak into the accent as a *surface* — see `accentFill`. When it did,
   * the app showed three oranges at once: brick discs, coral gradients,
   * and pink tints, each claiming to be the identity colour.
   */
  accent: pick('accent'),
  /**
   * The accent **as a surface** — a ticked checkbox, anything that must
   * read as switched on. One value for both themes, and the same coral the
   * gradient and the tints are made of, because a fill has no legibility
   * problem to solve: whatever sits on it is `accentInk`, 6.8:1 either way.
   */
  accentFill: pick('accentFill'),
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
  badge: pick('badge'),
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
  badgeSolid: pick('badgeSolid'),
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
  badgeInk: pick('badgeInk'),
  /** The warm end of the accent. Gradients run accent → accentBright and
   *  stay bright in both themes: they are fills, never type. */
  accentBright: pick('accentBright'),
  /** Type and glyphs that sit *on* the accent — near-black, because the
   *  accent is a saturated warm tone in either theme. Measured: near-black
   *  on coral is 6.8:1, white is 2.7:1, and white on the gradient's orange
   *  end falls to about 2.2:1 — under the 3:1 that graphical elements need,
   *  let alone text. */
  accentInk: pick('accentInk'),
  /** The accent at fill and hairline strength, for pills and tinted wells.
   *  Coral at low alpha reads on both grounds, so one value serves both. */
  accentSoft: pick('accentSoft'),
  accentLine: pick('accentLine'),
  /** The accent whispered — a mark that should register as warmth, not as
   *  a second thing to read (the rating star). */
  accentFaint: pick('accentFaint'),
  /** Ambient city-light warmth for background glows — the accent diffused,
   *  so the ground and the accent belong to one light. Plain strings: they
   *  feed a gradient, and the light theme does without the glow entirely
   *  (see AmbientWarmth), because a warm haze on paper reads as a stain. */
  emberGlow: pick('emberGlow'),
  emberGlowFade: pick('emberGlowFade'),
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
  sun: pick('sun'),
  /**
   * The hour on a card, for the ninety minutes before it stops being
   * true — "until 23:00" on a place about to close.
   *
   * Amber rather than `bad`, and that is the whole argument: `bad` is
   * what a flagged place wears, and a shop closing at eleven has done
   * nothing wrong. A wait is not an error. This says "hurry", the dimmed
   * photograph of a shut place says "tomorrow", and the ordinary grey
   * says "go".
   *
   * A pair rather than `sun`'s value, though both are the same amber
   * family: `sun` is a glyph colour, held to the 3:1 a mark needs, and at
   * 3.66:1 on white it cannot carry 15pt type. This is measured for type
   * instead — 4.99:1 on the card's white, 9.2:1 on the dark card's fill.
   */
  soon: pick('soon'),
  ok: pick('ok'),
  /** "Open now" on the place card's hours row: a shade greener and
   *  lighter than `ok`, chosen for that one line against white. */
  open: pick('open'),
  /**
   * And the other half of that line — "closed, opens at eight".
   *
   * It was `textTertiary`, which is the colour of the label above it. So
   * the one fact a reader opens this screen at ten at night to find read
   * as furniture, in the same grey as the word HOURS. Worse than quiet: on
   * the dark card that grey measures **3.41:1**, under the 4.5 small text
   * needs. The state was failing contrast while `open` beside it passed.
   *
   * Not the accent, which is what the reference drew. The accent is this
   * app's voice for *this is the thing* — the Explore button, the selected
   * tab, every link on this very card — and a shut door is the opposite of
   * that. The same argument `shut` makes at greater length, for the same
   * reason, about the same colour.
   *
   * So it takes `shut`'s own brick. The light value IS the sash's ground,
   * to the rounding: a reader meets that red on the diagonal across a
   * closed card and meets it again here, on the line that says why. The
   * dark value is that hue lifted to carry on a dark card, because the
   * brick itself is 2.25:1 there and unreadable.
   *
   *     light  7.57:1 on white       ΔE 19.4 from the accent
   *     dark   6.38:1 on the card    ΔE 25.6 from the accent
   *
   * Both clear of AA, and far enough from the coral to be a different
   * colour rather than a near-miss of one.
   */
  shutInk: pick('shutInk'),
  /** The value on the place card's info rows — address, hours table,
   *  phone, site. Ink: darker than `textSecondary`, a hair warmer and
   *  softer than `text`, so the facts read as content rather than as
   *  captions and the small-caps label above stays the quieter of the
   *  two. */
  ink: pick('ink'),
  /** Destructive. The dark theme's soft red is far too pale on paper. */
  bad: pick('bad'),
  /** The well a delete action sits in, with `bad` itself as the glyph on
   *  top. It takes the ordinary `borderGlassSoft` hairline like any other
   *  control — a red-tinted edge of its own came out near black against
   *  the dark ground, and outlined the one button that should read soft.
   *
   *  Opaque per-theme values rather than one translucent red like
   *  `accentSoft`: a tint has to stay pink to read as a warning, and the
   *  alpha that manages that on paper comes out beige over near-black. */
  //  #422520 on the brown, #2A1A18 on charcoal — charcoal's well on
  //  #271910 would be the page itself: `bad` on it 5.2:1.
  badSoft: pick('badSoft'),
  /** `badSoft`'s counterpart, for the one thing that goes right loudly
   *  enough to need a ground: the banner that says a collection is now
   *  public. Built to the same recipe and the same weight — 1.11:1
   *  against paper where the red is 1.13:1 — so good news and bad news
   *  sit at the same distance from the page instead of one shouting. */
  //  #24361F on the brown, #182A1C on charcoal — charcoal's read as the
  //  page with a green cast on #271910: `okInk` on it 6.2:1.
  okSoft: pick('okSoft'),
  /** Words and glyphs *on* `okSoft`. `ok` itself is 4.1:1 on the paper
   *  side of that ground, under the 4.5:1 a 16pt label needs; a shade
   *  darker is 5.1:1. The dark side keeps `ok`'s own sage, 6.2:1 on its
   *  ground. First worn by the visited pill on a place's screen. */
  okInk: pick('okInk'),
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
  accent: SIDES.light.onPhotoAccent,
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
  /**
   * The ground of the closed-sash, and the app's one red that is not the
   * coral.
   *
   * The accent (#C4402C) and `bad` (#C2564A) were both tried here and both
   * are wrong for the job. The accent is the app's voice — it means *this
   * is the thing*, and a shut door is the opposite of that. `bad` is
   * spoken for: it marks a flagged place at the desk, and a reader who
   * learns that colour on a report queue should not meet it again on a
   * café that simply shuts at ten.
   *
   * So a deeper brick, measured off the reference — and laid on at 82%
   * rather than solid, so the picture keeps showing through the one mark
   * that crosses it.
   *
   * That alpha is the lowest the sentence can afford, and the arithmetic
   * is worth keeping because the temptation is always to go thinner. A
   * translucent ground is only as dark as what it lies on, so the case to
   * solve is the sash falling across a blown-out sky or a white wall.
   * Composited over pure white, white type reads:
   *
   *     1.00  7.62:1      0.85  5.48:1
   *     0.90  6.15:1      0.82  5.13:1
   *     0.88  5.89:1      0.80  4.87:1
   *                       0.75  4.35:1   ← under AA
   *
   * 0.82 keeps a margin over the 4.5:1 small type needs even in that
   * worst case, and over a dark photograph it climbs to about 9.7:1.
   * Below 0.80 the mark stops being safe on the photographs this catalog
   * actually holds.
   *
   * Fixed rather than a `dyn` pair, like every value in this block — it
   * rides a photograph, and a photograph has no theme.
   */
  shut: 'rgba(151,47,43,0.82)',
} as const;

/** The accent as a gradient, for the rare loud surface. Left to right
 *  rather than corner to corner: on a wide pill a diagonal wash puts the
 *  lightest tone under one end of the label and the darkest under the
 *  other, and the text stops reading as one weight. */
export const gradAI = {
  // The bright coral, literally — not `colors.accent`, which is darker on
  // paper and dynamic besides. A gradient is a fill, and this one is the
  // app's loudest surface in both themes.
  colors: SIDES.light.gradAI,
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
export const ringTrack = { light: SIDES.light.ringTrack, dark: SIDES.dark.ringTrack } as const;
/** The tab bar's selected-pill ink, per side — see `FloatingTabBar`. */
export const pillInk = { light: SIDES.light.pillInk, dark: SIDES.dark.pillInk } as const;
/** The welcome art's heart, per side — see `welcomeArt`. */
export const heartInk = { light: SIDES.light.heartInk, dark: SIDES.dark.heartInk } as const;
/** The frosted glass's veil and its type halo, per side — see `GlassMaterial`. */
export const glass = {
  veil: { light: SIDES.light.glassVeil, dark: SIDES.dark.glassVeil },
  halo: { light: SIDES.light.glassHalo, dark: SIDES.dark.glassHalo },
} as const;
/** The accent all but faded out, for the far end of a tinted wash. */
export const accentFade = SIDES.light.accentFade;

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

/**
 * How far Dynamic Type may grow a label whose box cannot grow with it.
 *
 * iOS lets a reader set the text size from xSmall to the five
 * accessibility sizes, and React Native multiplies every `Text` by that
 * setting — 0.82× at the smallest, 3.12× at AX5. Nearly everything in
 * this app is laid out to take that: buttons and fields are `minHeight`,
 * rows are padding around their words, cards wrap. Three places are not,
 * and cannot be: the tab bar is a 64pt island the screens clear a fixed
 * distance for, the shut sash is a 20pt band drawn across a photograph
 * at an angle, and the count badge on a tab is a 21pt disc. Text left to
 * grow inside those does not wrap or push — it is clipped, and a clipped
 * caption is worse than a smaller one.
 *
 * So those three, and only those, cap the multiplier here. 1.3 is where
 * the Large sizes end and the accessibility sizes begin: the biggest
 * setting a reader picks from the ordinary slider still reaches every
 * caption whole, and the AX sizes — where the reader has said legibility
 * beats layout — still get a third more than the design size in the one
 * kind of box that could not give them more. Everything else scales
 * freely; a cap on body copy would be the app deciding how big a reader's
 * own words may be, which is not its call.
 */
export const labelScaleCap = 1.3;

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
