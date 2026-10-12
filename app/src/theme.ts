// City Crew iOS design system.
//
// Sixteen palettes, worn as fifteen looks (`lib/look.ts`, 10–12 Oct 2026). The
// standard look is two grounds, one system: warm paper with white cards and
// near-black type, and the cinematic charcoal #0A0B0A with warm-gray
// hairlines — Light, Dark and Automatic in the Appearance sheet. Coffee is
// the owner's two-tone reference turned into a whole theme: brown #271910
// under cream type, the cream #C7AA9A the secondary type and the hairline.
// It replaced charcoal for a day (#861) and is now a look of its own beside
// it. Rose is the second reference, slate rose #B45865 on transparent
// yellow #F4ECC2, a light look; its note is on `ROSE` below. Four more
// came from four two-tone references on 11 Oct 2026 — blush and slate,
// light; midnight and navy, dark — and two more that day, chocolate and
// cosmic, both dark; then three more, duck (light), honey and royal
// (dark); on 12 Oct plum, violet and wine, all dark; and that evening
// four more from four two-tone references — maroon, neon and ember,
// dark, and amber, the one light look among them. Each has its note on
// its palette.
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

// ── the palettes ──
//
// Every colour token's value, per palette. `colors` below is built from
// whichever two the loaded look pairs (`lib/look.ts`), and keeps the notes
// on what each token is for. A value that is the same on both sides of the
// look goes out as a plain string, a value that differs as a `dyn` pair —
// so under every look but the standard one, each one palette on both sides, nothing
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

/**
 * "Hồng phấn" (11 Oct 2026): the owner's blush reference, pale pink
 * #FEE5EB under plum-pink #CF7486, with #EABDDE and #463543 beside them.
 * A light look.
 *
 * The pale pink is the page and the reference's #463543 is the type
 * (9.52:1). #CF7486 is the colour the eye takes from the reference, and it
 * is too light to be read or to carry a word: 2.71 as type on the page,
 * 3.23 under white. So it is the bright end and the heart, and the
 * readable accent is the same hue carried down to #A8475C (4.74 on the
 * page, 5.35 on a card), the fill #B5566B under white (4.66). The
 * reference's own pale-pink-on-#CF7486 is 2.71, which is why no word sits
 * on it. The tab pill is the reference's #EABDDE under #463543, 6.93.
 * The steps between are plum greys, #5A4453 and #76606F (7.38 and 4.80,
 * 1.54 apart).
 */
const BLUSH: Palette = {
  bg: '#FEE5EB',
  bgElevated: '#FFF7F9',
  bgElevatedVeil: 'rgba(255,247,249,0.88)',
  surfaceCard: '#FFF7F9',
  surfaceGlass: 'rgba(70,53,67,0.05)',
  surfaceGlassStrong: 'rgba(70,53,67,0.09)',
  borderGlass: 'rgba(70,53,67,0.14)',
  borderGlassSoft: 'rgba(70,53,67,0.08)',
  text: '#463543',
  textSecondary: '#5A4453',
  textTertiary: '#76606F',
  accent: '#A8475C',
  accentFill: '#B5566B',
  badge: 'rgba(207,116,134,0.16)',
  badgeSolid: '#EABDDE',
  badgeInk: '#A8475C',
  accentBright: '#CF7486',
  accentInk: '#FFFFFF',
  accentSoft: 'rgba(207,116,134,0.12)',
  accentLine: 'rgba(207,116,134,0.32)',
  accentFaint: 'rgba(168,71,92,0.72)',
  emberGlow: 'rgba(207,116,134,0.12)',
  emberGlowFade: 'rgba(207,116,134,0.04)',
  sun: '#A0720E',
  soon: '#94670F',
  ok: '#3F7A4A',
  open: '#3F7D55',
  shutInk: '#972F2B',
  ink: '#3A2A37',
  bad: '#9C3B2F',
  badSoft: '#F9D4CF',
  okSoft: '#DCEBD3',
  okInk: '#2F6B3B',
  gradAI: ['#AD4E63', '#B5566B'],
  ringTrack: '#F0CBD5',
  pillInk: '#463543',
  heartInk: '#CF7486',
  onPhotoAccent: '#F4A6B6',
  glassVeil: 'rgba(255,240,244,0.48)',
  glassHalo: 'rgba(255,240,244,0.95)',
  accentFade: 'rgba(207,116,134,0.02)',
};

/**
 * "Xanh xám" (11 Oct 2026): the owner's slate reference, slate #424A58
 * and light cream #F7F6F4, as a light look.
 *
 * The cream is the page. The slate is the accent, and the accent is what
 * the reference is: two colours and nothing warm, so active state is the
 * slate itself (8.27 on the page) rather than a coral the reference never
 * had, and a button is slate under the cream (8.27). Type goes a step
 * deeper, #232831 (13.70), so that a link in slate still reads apart from
 * the text around it. The steps between are #4D5462 and #656C79 (7.04 and
 * 4.89, 1.44 apart). The tab pill is a pale slate, #DFE2E8, under #2E3440
 * (9.62) — Threads' grammar, a quiet pill under a dark mark.
 */
const SLATE: Palette = {
  bg: '#F7F6F4',
  bgElevated: '#FFFFFF',
  bgElevatedVeil: 'rgba(255,255,255,0.88)',
  surfaceCard: '#FFFFFF',
  surfaceGlass: 'rgba(35,40,49,0.05)',
  surfaceGlassStrong: 'rgba(35,40,49,0.09)',
  borderGlass: 'rgba(35,40,49,0.14)',
  borderGlassSoft: 'rgba(35,40,49,0.08)',
  text: '#232831',
  textSecondary: '#4D5462',
  textTertiary: '#656C79',
  accent: '#424A58',
  accentFill: '#424A58',
  badge: 'rgba(66,74,88,0.12)',
  badgeSolid: '#DFE2E8',
  badgeInk: '#424A58',
  accentBright: '#5A6476',
  accentInk: '#F7F6F4',
  accentSoft: 'rgba(66,74,88,0.08)',
  accentLine: 'rgba(66,74,88,0.26)',
  accentFaint: 'rgba(66,74,88,0.72)',
  emberGlow: 'rgba(66,74,88,0.10)',
  emberGlowFade: 'rgba(66,74,88,0.04)',
  sun: '#B07C10',
  soon: '#94670F',
  ok: '#3F7A4A',
  open: '#3F7D55',
  shutInk: '#972F2B',
  ink: '#2A2F38',
  bad: '#C2564A',
  badSoft: '#F8DFD9',
  okSoft: '#D9EBD7',
  okInk: '#2F6B3B',
  gradAI: ['#424A58', '#525C6E'],
  ringTrack: '#E2E1DC',
  pillInk: '#2E3440',
  heartInk: '#5A6476',
  onPhotoAccent: '#E4E7EC',
  glassVeil: 'rgba(250,249,247,0.48)',
  glassHalo: 'rgba(250,249,247,0.95)',
  accentFade: 'rgba(66,74,88,0.02)',
};

/**
 * "Xanh than" (11 Oct 2026): the owner's midnight reference, ink navy
 * #252F52 under yellow cream #F9F8E2, as a dark look.
 *
 * The navy is the page and the cream the type (12.17). The accent is the
 * cream carried to a gold, #F2D27A (8.88 on the page, 7.62 on a card),
 * because the coral the other dark looks keep falls to 4.10 on this
 * card: the navy is lighter than the brown or the charcoal. A button is
 * gold under the navy (8.88), the tab pill the same gold under #1B2340
 * (10.49). The steps are #D2D0B8 and #ABAA96 (8.37 and 5.55 on the page,
 * 4.76 for the third on a card, 1.51 apart).
 */
const MIDNIGHT: Palette = {
  bg: '#252F52',
  bgElevated: '#2E3961',
  bgElevatedVeil: 'rgba(37,47,82,0.9)',
  surfaceCard: 'rgba(55,66,106,0.72)',
  surfaceGlass: 'rgba(249,248,226,0.06)',
  surfaceGlassStrong: 'rgba(249,248,226,0.12)',
  borderGlass: 'rgba(249,248,226,0.22)',
  borderGlassSoft: 'rgba(249,248,226,0.14)',
  text: '#F9F8E2',
  textSecondary: '#D2D0B8',
  textTertiary: '#ABAA96',
  accent: '#F2D27A',
  accentFill: '#F2D27A',
  badge: '#F2D27A',
  badgeSolid: '#F2D27A',
  badgeInk: '#252F52',
  accentBright: '#F7E3A3',
  accentInk: '#252F52',
  accentSoft: 'rgba(242,210,122,0.10)',
  accentLine: 'rgba(242,210,122,0.30)',
  accentFaint: 'rgba(242,210,122,0.62)',
  emberGlow: 'rgba(242,210,122,0.12)',
  emberGlowFade: 'rgba(242,210,122,0.04)',
  sun: '#F2B441',
  soon: '#F2B441',
  ok: '#9FCB9A',
  open: '#9FCB9A',
  shutInk: '#F0A096',
  ink: '#EFEED6',
  bad: '#EBA197',
  badSoft: '#43303F',
  okSoft: '#22392F',
  okInk: '#9FCB9A',
  gradAI: ['#F2D27A', '#F7E3A3'],
  ringTrack: '#36426B',
  pillInk: '#1B2340',
  heartInk: '#F2D27A',
  onPhotoAccent: '#F2D27A',
  glassVeil: 'rgba(37,47,82,0.48)',
  glassHalo: 'rgba(37,47,82,0.95)',
  accentFade: 'rgba(242,210,122,0.02)',
};

/**
 * "Xanh navy" (11 Oct 2026): the owner's navy reference, deep navy
 * #162C39 under beige #C2B2A3, as a dark look.
 *
 * The beige is a mid-tone, so it is not the page (see the cream's note at
 * the top of this file); it is the secondary type and the hairline, as the
 * coffee brown's cream is (7.01 on the page). Type is the beige lifted to
 * #F2ECE6 (12.33), the third step #A39486 (4.91, 4.53 on a card, 1.43
 * under the beige) — the card is held to #1B3240, a lift the third step
 * can still read on. The accent is the beige's own warm side, caramel
 * #E6A979 (7.10, 6.54 on a card), so it reads apart from the beige type
 * beside it; a button is caramel under the navy, the pill caramel under
 * #10222D (8.00).
 */
const NAVY: Palette = {
  bg: '#162C39',
  bgElevated: '#1B3240',
  bgElevatedVeil: 'rgba(22,44,57,0.9)',
  surfaceCard: 'rgba(38,62,77,0.72)',
  surfaceGlass: 'rgba(242,236,230,0.06)',
  surfaceGlassStrong: 'rgba(242,236,230,0.12)',
  borderGlass: 'rgba(194,178,163,0.24)',
  borderGlassSoft: 'rgba(194,178,163,0.16)',
  text: '#F2ECE6',
  textSecondary: '#C2B2A3',
  textTertiary: '#A39486',
  accent: '#E6A979',
  accentFill: '#E6A979',
  badge: '#E6A979',
  badgeSolid: '#E6A979',
  badgeInk: '#162C39',
  accentBright: '#EDBE96',
  accentInk: '#162C39',
  accentSoft: 'rgba(230,169,121,0.10)',
  accentLine: 'rgba(230,169,121,0.30)',
  accentFaint: 'rgba(230,169,121,0.62)',
  emberGlow: 'rgba(230,169,121,0.14)',
  emberGlowFade: 'rgba(230,169,121,0.05)',
  sun: '#F2B441',
  soon: '#F2B441',
  ok: '#8FBF8A',
  open: '#8FBF8A',
  shutInk: '#EC958A',
  ink: '#E9E1D9',
  bad: '#E39A90',
  badSoft: '#3A2A2E',
  okSoft: '#1C3A30',
  okInk: '#8FBF8A',
  gradAI: ['#E6A979', '#EDBE96'],
  ringTrack: '#22394A',
  pillInk: '#10222D',
  heartInk: '#E6A979',
  onPhotoAccent: '#E6A979',
  glassVeil: 'rgba(22,44,57,0.48)',
  glassHalo: 'rgba(22,44,57,0.95)',
  accentFade: 'rgba(230,169,121,0.02)',
};

/**
 * "Sô-cô-la" (11 Oct 2026): the owner's dusty-pink-on-chocolate reference,
 * #DEAA9B on #4E403B, as a dark look.
 *
 * The chocolate is the page, and it is a light dark — 0.054 in luminance
 * where the coffee brown is 0.012 — so everything on it has to be pale:
 * a text step needs 0.42 or more to clear 4.5:1, which is why the three
 * steps are a pink-white, a pale pink and the dusty pink's own weight
 * (8.84, 6.57 and 4.57, 1.44 apart), and why the cards go a step *down*
 * from the page (#443733) rather than up: a lift would leave the third
 * step nothing to stand on. The dusty pink itself is 4.87 as type, which
 * is why it is the fill and the pill (under #2B2220, 7.64) rather than the
 * accent; the accent as type is the same pink lifted to #F0C8BB (6.45,
 * and 4.5 over a map tile through the veil, where the reference pink is
 * 3.6). The notes about the cream above apply here too: a mid-tone like
 * the pink is never the page.
 */
const CHOCOLATE: Palette = {
  bg: '#4E403B',
  bgElevated: '#443733',
  bgElevatedVeil: 'rgba(78,64,59,0.9)',
  surfaceCard: 'rgba(60,48,44,0.72)',
  surfaceGlass: 'rgba(250,240,236,0.06)',
  surfaceGlassStrong: 'rgba(250,240,236,0.12)',
  borderGlass: 'rgba(222,170,155,0.26)',
  borderGlassSoft: 'rgba(222,170,155,0.16)',
  text: '#FAF0EC',
  textSecondary: '#EECBC0',
  textTertiary: '#D0A79B',
  accent: '#F0C8BB',
  accentFill: '#DEAA9B',
  badge: '#DEAA9B',
  badgeSolid: '#DEAA9B',
  badgeInk: '#2B2220',
  accentBright: '#E9BCAE',
  accentInk: '#2B2220',
  accentSoft: 'rgba(222,170,155,0.12)',
  accentLine: 'rgba(222,170,155,0.32)',
  accentFaint: 'rgba(222,170,155,0.62)',
  emberGlow: 'rgba(222,170,155,0.14)',
  emberGlowFade: 'rgba(222,170,155,0.05)',
  sun: '#F2B441',
  soon: '#F2B441',
  ok: '#BFDDB8',
  open: '#BFDDB8',
  shutInk: '#F3B5AA',
  ink: '#F3E4DE',
  bad: '#F2A99D',
  badSoft: '#5A3A36',
  okSoft: '#3A4738',
  okInk: '#BFDDB8',
  gradAI: ['#DEAA9B', '#E9BCAE'],
  ringTrack: '#5F4F49',
  pillInk: '#2B2220',
  heartInk: '#DEAA9B',
  onPhotoAccent: '#DEAA9B',
  glassVeil: 'rgba(78,64,59,0.48)',
  glassHalo: 'rgba(78,64,59,0.95)',
  accentFade: 'rgba(222,170,155,0.02)',
};

/**
 * "Vũ trụ" (11 Oct 2026): the owner's "Orange 04 / Cosmic Quiet"
 * reference, #E76629 on #211832, as a dark look.
 *
 * The purple-black is the page (0.012, the coffee brown's weight), the
 * type a lilac-white and two lilac greys (14.8, 9.6 and 5.8, 1.64 apart).
 * The orange is the fill, the gradient's start and the pill, under the
 * page itself (5.1), as Midnight's gold is. As type the orange is 5.1
 * on the page but 3.8 over a map tile through the veil, so the accent is
 * the same orange a step up, #F0803F (6.34 on the page, 4.5 over the
 * tile), and the gradient runs from the reference to it.
 */
const COSMIC: Palette = {
  bg: '#211832',
  bgElevated: '#2B2140',
  bgElevatedVeil: 'rgba(33,24,50,0.9)',
  surfaceCard: 'rgba(52,41,74,0.72)',
  surfaceGlass: 'rgba(243,238,248,0.06)',
  surfaceGlassStrong: 'rgba(243,238,248,0.12)',
  borderGlass: 'rgba(201,191,214,0.22)',
  borderGlassSoft: 'rgba(201,191,214,0.14)',
  text: '#F3EEF8',
  textSecondary: '#C9BFD6',
  textTertiary: '#9E93AE',
  accent: '#F0803F',
  accentFill: '#E76629',
  badge: '#E76629',
  badgeSolid: '#E76629',
  badgeInk: '#211832',
  accentBright: '#F0803F',
  accentInk: '#211832',
  accentSoft: 'rgba(231,102,41,0.12)',
  accentLine: 'rgba(231,102,41,0.32)',
  accentFaint: 'rgba(231,102,41,0.62)',
  emberGlow: 'rgba(231,102,41,0.14)',
  emberGlowFade: 'rgba(231,102,41,0.05)',
  sun: '#F2B441',
  soon: '#F2B441',
  ok: '#9FCB9A',
  open: '#9FCB9A',
  shutInk: '#F0A096',
  ink: '#EAE3F0',
  bad: '#EBA197',
  badSoft: '#43303F',
  okSoft: '#22392F',
  okInk: '#9FCB9A',
  gradAI: ['#E76629', '#F0803F'],
  ringTrack: '#342A4C',
  pillInk: '#211832',
  heartInk: '#E76629',
  onPhotoAccent: '#F0803F',
  glassVeil: 'rgba(33,24,50,0.48)',
  glassHalo: 'rgba(33,24,50,0.95)',
  accentFade: 'rgba(231,102,41,0.02)',
};

/**
 * "Xanh cổ vịt" (11 Oct 2026): the owner's teal-and-cream reference,
 * #2A9D8F on #FAF3E0, as a light look.
 *
 * The cream is the page and the teal is never the page: it is a mid-tone
 * (3.0 under white type), the reason the header gives for never putting
 * the standard cream under anything. So the teal is the fill, the pill's
 * pale cousin and the gradient's start, under a near-black teal #0F2724
 * (4.73 on the fill, 5.45 on the gradient's lighter end). As type the
 * teal is 3.0 on the cream, so the accent is the same teal two steps
 * down, #1E766B (4.91 on the page, 5.30 on a card, 4.5 over a map tile).
 * The type is a teal-black and two teal greys (12.6, 8.7 and 5.2, 1.65
 * apart). The pill is a pale teal #BFE5DE under a deep one (6.63).
 */
const DUCK: Palette = {
  bg: '#FAF3E0',
  bgElevated: '#FFFCF2',
  bgElevatedVeil: 'rgba(255,252,242,0.88)',
  surfaceCard: '#FFFCF2',
  surfaceGlass: 'rgba(25,48,45,0.05)',
  surfaceGlassStrong: 'rgba(25,48,45,0.09)',
  borderGlass: 'rgba(25,48,45,0.14)',
  borderGlassSoft: 'rgba(25,48,45,0.08)',
  text: '#19302D',
  textSecondary: '#2F4A46',
  textTertiary: '#4E6B66',
  accent: '#1E766B',
  accentFill: '#2A9D8F',
  badge: 'rgba(42,157,143,0.16)',
  badgeSolid: '#BFE5DE',
  badgeInk: '#1E766B',
  accentBright: '#35A999',
  accentInk: '#0F2724',
  accentSoft: 'rgba(42,157,143,0.12)',
  accentLine: 'rgba(42,157,143,0.32)',
  accentFaint: 'rgba(30,118,107,0.72)',
  emberGlow: 'rgba(42,157,143,0.12)',
  emberGlowFade: 'rgba(42,157,143,0.04)',
  sun: '#8F6A0C',
  soon: '#8F6A0C',
  ok: '#3F7A4A',
  open: '#3F7D55',
  shutInk: '#9A3A2E',
  ink: '#20403B',
  bad: '#9C3B2F',
  badSoft: '#F7D6CF',
  okSoft: '#D9EBD2',
  okInk: '#2F6B3B',
  gradAI: ['#2A9D8F', '#35A999'],
  ringTrack: '#D9E8E0',
  pillInk: '#14524A',
  heartInk: '#2A9D8F',
  onPhotoAccent: '#7FD4C7',
  glassVeil: 'rgba(250,243,224,0.48)',
  glassHalo: 'rgba(250,243,224,0.95)',
  accentFade: 'rgba(42,157,143,0.02)',
};

/**
 * "Mật ong" (11 Oct 2026): the owner's "chữ vàng tươi / chữ nâu đen"
 * reference, #EDCA3B on #1E1608, as a dark look.
 *
 * The brown-black is the page (0.009, under the coffee brown's weight),
 * the cards a step up in the same brown, #2A2010. The yellow is the
 * accent, the fill and the pill, under the page itself (11.2) — the
 * reference's own pairing, which needed no help: it is 11.2 on the page
 * as type and 10.0 on a card. The type is a warm cream and two sand
 * greys (16.2, 11.0 and 6.8, 1.61 apart). Midnight has gold on blue;
 * this is the same gold on near-black, and the two sit apart on the
 * sheet by their page.
 */
const HONEY: Palette = {
  bg: '#1E1608',
  bgElevated: '#2A2010',
  bgElevatedVeil: 'rgba(30,22,8,0.9)',
  surfaceCard: 'rgba(48,38,20,0.72)',
  surfaceGlass: 'rgba(251,243,224,0.06)',
  surfaceGlassStrong: 'rgba(251,243,224,0.12)',
  borderGlass: 'rgba(217,201,166,0.22)',
  borderGlassSoft: 'rgba(217,201,166,0.14)',
  text: '#FBF3E0',
  textSecondary: '#D9C9A6',
  textTertiary: '#B09E78',
  accent: '#EDCA3B',
  accentFill: '#EDCA3B',
  badge: '#EDCA3B',
  badgeSolid: '#EDCA3B',
  badgeInk: '#1E1608',
  accentBright: '#F5D85A',
  accentInk: '#1E1608',
  accentSoft: 'rgba(237,202,59,0.12)',
  accentLine: 'rgba(237,202,59,0.32)',
  accentFaint: 'rgba(237,202,59,0.62)',
  emberGlow: 'rgba(237,202,59,0.14)',
  emberGlowFade: 'rgba(237,202,59,0.05)',
  sun: '#EDCA3B',
  soon: '#EDCA3B',
  ok: '#B9D89A',
  open: '#B9D89A',
  shutInk: '#F2A99D',
  ink: '#EFE4C9',
  bad: '#F2A99D',
  badSoft: '#4A2A22',
  okSoft: '#34402A',
  okInk: '#B9D89A',
  gradAI: ['#EDCA3B', '#F5D85A'],
  ringTrack: '#3A2E16',
  pillInk: '#1E1608',
  heartInk: '#EDCA3B',
  onPhotoAccent: '#F5D85A',
  glassVeil: 'rgba(30,22,8,0.48)',
  glassHalo: 'rgba(30,22,8,0.95)',
  accentFade: 'rgba(237,202,59,0.02)',
};

/**
 * "Hoàng gia" (11 Oct 2026): the owner's "Royal Majolica / Marigold"
 * reference, #F9BF02 on #04408B, as a dark look.
 *
 * The royal blue is the page (0.05 — the lightest dark page here, and
 * still 9.2 under white type), the cards a step up, #0A4894. The
 * marigold is never the page: it is a mid-tone, and white on it is 1.9.
 * It is the accent, the fill and the pill, under the page itself (5.91
 * as type on the page, 5.09 on a card, 5.91 as ink on the fill). The
 * type is an off-white and two blue-greys (9.2, 8.1 and 5.3 on the
 * page; 4.76 for the faintest on a card, 1.51 apart) — the tertiary was
 * a step darker and sat at 4.16 on the card, so it came up and the
 * secondary with it to keep the step. Midnight is the muted cousin;
 * this is the flag's own blue and yellow, and the sheet shows both.
 */
const ROYAL: Palette = {
  bg: '#04408B',
  bgElevated: '#0A4894',
  bgElevatedVeil: 'rgba(4,64,139,0.9)',
  surfaceCard: 'rgba(16,80,160,0.72)',
  surfaceGlass: 'rgba(247,246,238,0.06)',
  surfaceGlassStrong: 'rgba(247,246,238,0.12)',
  borderGlass: 'rgba(226,232,243,0.22)',
  borderGlassSoft: 'rgba(226,232,243,0.14)',
  text: '#F7F6EE',
  textSecondary: '#E2E8F3',
  textTertiary: '#AEBFDB',
  accent: '#F9BF02',
  accentFill: '#F9BF02',
  badge: '#F9BF02',
  badgeSolid: '#F9BF02',
  badgeInk: '#04408B',
  accentBright: '#FFD23F',
  accentInk: '#04408B',
  accentSoft: 'rgba(249,191,2,0.12)',
  accentLine: 'rgba(249,191,2,0.32)',
  accentFaint: 'rgba(249,191,2,0.62)',
  emberGlow: 'rgba(249,191,2,0.14)',
  emberGlowFade: 'rgba(249,191,2,0.05)',
  sun: '#F9BF02',
  soon: '#F9BF02',
  ok: '#A9D9A0',
  open: '#A9D9A0',
  shutInk: '#F7B3AA',
  ink: '#E8EDF7',
  bad: '#F6A8A0',
  badSoft: '#4C3862',
  okSoft: '#1F4F62',
  okInk: '#A9D9A0',
  gradAI: ['#F9BF02', '#FFD23F'],
  ringTrack: '#1C56A4',
  pillInk: '#04408B',
  heartInk: '#F9BF02',
  onPhotoAccent: '#FFD23F',
  glassVeil: 'rgba(4,64,139,0.48)',
  glassHalo: 'rgba(4,64,139,0.95)',
  accentFade: 'rgba(249,191,2,0.02)',
};

/**
 * "Mận" (12 Oct 2026): the owner's plum-and-raspberry reference —
 * #432E54, #4B4376, #AE445A, #E8BCB9, #B27292 — as a dark look.
 *
 * The indigo #4B4376 is the page rather than the plum #432E54, on
 * purpose: the wine look below is the plum's own family (1.18 apart as
 * pages, 1.25 as accents), and two cards on the Theme sheet that read as
 * one are one card too many. The indigo is a light dark (0.068, the
 * lightest page here), so the cards go a step *down* in the same indigo
 * as Chocolate's do, and the type has to climb: a lilac-white and two
 * lilac steps (7.9, 6.6 and 4.67, 1.41 apart — the faintest sat at 3.9
 * on the reference's mauve). The raspberry is the fill and the pill
 * under an off-white (5.2); as type it is 2.15 on the page, so the
 * accent is the reference's pale pink a step up, #F4D4D0 (6.4 on the
 * page, 4.5 over a map tile — #E8BCB9 itself was 4.2). The gradient
 * runs down from the raspberry rather than up, because the ink on its
 * far end has to hold 4.5 too.
 */
const PLUM: Palette = {
  bg: '#4B4376',
  bgElevated: '#423A6A',
  bgElevatedVeil: 'rgba(75,67,118,0.9)',
  surfaceCard: 'rgba(58,51,95,0.72)',
  surfaceGlass: 'rgba(245,240,246,0.06)',
  surfaceGlassStrong: 'rgba(245,240,246,0.12)',
  borderGlass: 'rgba(230,218,235,0.24)',
  borderGlassSoft: 'rgba(230,218,235,0.14)',
  text: '#F5F0F6',
  textSecondary: '#E6DAEB',
  textTertiary: '#C8B6CF',
  accent: '#F4D4D0',
  accentFill: '#AE445A',
  badge: '#AE445A',
  badgeSolid: '#AE445A',
  badgeInk: '#FFF5F3',
  accentBright: '#E8BCB9',
  accentInk: '#FFF5F3',
  accentSoft: 'rgba(174,68,90,0.16)',
  accentLine: 'rgba(232,188,185,0.32)',
  accentFaint: 'rgba(232,188,185,0.62)',
  emberGlow: 'rgba(174,68,90,0.16)',
  emberGlowFade: 'rgba(174,68,90,0.05)',
  sun: '#F2B441',
  soon: '#F2B441',
  ok: '#BFDDB8',
  open: '#BFDDB8',
  shutInk: '#F3B5AA',
  ink: '#EFE4EE',
  bad: '#F2A99D',
  badSoft: '#5E3B52',
  okSoft: '#3B4A4F',
  okInk: '#BFDDB8',
  gradAI: ['#AE445A', '#9C3A4F'],
  ringTrack: '#5C5489',
  pillInk: '#FFF5F3',
  heartInk: '#E8BCB9',
  onPhotoAccent: '#F4D4D0',
  glassVeil: 'rgba(75,67,118,0.48)',
  glassHalo: 'rgba(75,67,118,0.95)',
  accentFade: 'rgba(232,188,185,0.02)',
};

/**
 * "Tím" (12 Oct 2026): the owner's "Dark Prom Queen / Sapphire Siren /
 * Lilac Ash" reference, #31082C, #752E8D and #D7CDCD, as a dark look.
 *
 * Purple on purple, which is what keeps it apart from Cosmic's orange
 * on purple-black. The plum-black is the page (0.010, Cosmic's weight),
 * the lilac ash the secondary type (11.2) with an off-white above it and
 * an ash grey below (15.4 and 6.7, 1.68 apart). The violet is the fill
 * and the pill under white (8.3); as type it is 2.1 on the page, so the
 * accent is the violet lifted to a lilac, #C79BDC (7.6 on the page,
 * 4.5 over a map tile).
 */
const VIOLET: Palette = {
  bg: '#31082C',
  bgElevated: '#3E1539',
  bgElevatedVeil: 'rgba(49,8,44,0.9)',
  surfaceCard: 'rgba(72,28,66,0.72)',
  surfaceGlass: 'rgba(246,238,244,0.06)',
  surfaceGlassStrong: 'rgba(246,238,244,0.12)',
  borderGlass: 'rgba(215,205,205,0.22)',
  borderGlassSoft: 'rgba(215,205,205,0.14)',
  text: '#F6EEF4',
  textSecondary: '#D7CDCD',
  textTertiary: '#AC9BAA',
  accent: '#C79BDC',
  accentFill: '#752E8D',
  badge: '#752E8D',
  badgeSolid: '#752E8D',
  badgeInk: '#FFFFFF',
  accentBright: '#C79BDC',
  accentInk: '#FFFFFF',
  accentSoft: 'rgba(117,46,141,0.18)',
  accentLine: 'rgba(199,155,220,0.32)',
  accentFaint: 'rgba(199,155,220,0.62)',
  emberGlow: 'rgba(117,46,141,0.18)',
  emberGlowFade: 'rgba(117,46,141,0.06)',
  sun: '#F2B441',
  soon: '#F2B441',
  ok: '#B9D89A',
  open: '#B9D89A',
  shutInk: '#F0A096',
  ink: '#EDE2EA',
  bad: '#EBA197',
  badSoft: '#4F2340',
  okSoft: '#2E3A2A',
  okInk: '#B9D89A',
  gradAI: ['#752E8D', '#8A3FA3'],
  ringTrack: '#4A1F45',
  pillInk: '#FFFFFF',
  heartInk: '#C79BDC',
  onPhotoAccent: '#C79BDC',
  glassVeil: 'rgba(49,8,44,0.48)',
  glassHalo: 'rgba(49,8,44,0.95)',
  accentFade: 'rgba(199,155,220,0.02)',
};

/**
 * "Rượu vang" (12 Oct 2026): the owner's "Drops of God / Jazzy / Light
 * Pink" reference, #501627, #AF144B and #FACCD7, as a dark look.
 *
 * The burgundy is the page (0.024, the coffee brown's weight), the light
 * pink the secondary type (9.9) between an off-white and a dusty rose
 * (12.6 and 6.6, 1.51 apart). The jazzy red is the fill and the pill
 * under white (6.9); as type it is 2.0 on the page, so the accent is
 * the red lifted to a pink, #F58FB0 (6.4 on the page, 4.5 over a map
 * tile — the first lift, #F27DA3, was 4.2).
 */
const WINE: Palette = {
  bg: '#501627',
  bgElevated: '#5E2033',
  bgElevatedVeil: 'rgba(80,22,39,0.9)',
  surfaceCard: 'rgba(104,40,60,0.72)',
  surfaceGlass: 'rgba(251,239,242,0.06)',
  surfaceGlassStrong: 'rgba(251,239,242,0.12)',
  borderGlass: 'rgba(250,204,215,0.22)',
  borderGlassSoft: 'rgba(250,204,215,0.14)',
  text: '#FBEFF2',
  textSecondary: '#FACCD7',
  textTertiary: '#D9A2B1',
  accent: '#F58FB0',
  accentFill: '#AF144B',
  badge: '#AF144B',
  badgeSolid: '#AF144B',
  badgeInk: '#FFFFFF',
  accentBright: '#F58FB0',
  accentInk: '#FFFFFF',
  accentSoft: 'rgba(175,20,75,0.18)',
  accentLine: 'rgba(245,143,176,0.32)',
  accentFaint: 'rgba(245,143,176,0.62)',
  emberGlow: 'rgba(175,20,75,0.18)',
  emberGlowFade: 'rgba(175,20,75,0.06)',
  sun: '#F2B441',
  soon: '#F2B441',
  ok: '#B9D89A',
  open: '#B9D89A',
  shutInk: '#F6B0A8',
  ink: '#F5E1E7',
  bad: '#F2A99D',
  badSoft: '#6A2A3C',
  okSoft: '#3C3A2A',
  okInk: '#B9D89A',
  gradAI: ['#AF144B', '#C42A60'],
  ringTrack: '#6B2A3F',
  pillInk: '#FFFFFF',
  heartInk: '#F58FB0',
  onPhotoAccent: '#F58FB0',
  glassVeil: 'rgba(80,22,39,0.48)',
  glassHalo: 'rgba(80,22,39,0.95)',
  accentFade: 'rgba(245,143,176,0.02)',
};

/**
 * "Đỏ mận" (12 Oct 2026): the owner's "Chữ đỏ mận / Chữ be kem"
 * reference, #3D1223 and #E5D0B6, as a dark look.
 *
 * The maroon is the page (0.015, between the violet's and the coffee
 * brown's weight) and the cream is everything that sits on it: the
 * secondary type (10.0), the accent (10.7) and the fill, under maroon
 * ink (10.7) — the reference has two colours and this look keeps to
 * them, which is what tells it from Wine, whose page is a step redder
 * and whose accent is a pink. The primary type is the cream warmed
 * toward white (13.7), the tertiary a dusty tan (6.1, 1.64 under the
 * secondary). Elevated surfaces lift the page by a tenth of its own red,
 * as every dark look's do.
 */
const MAROON: Palette = {
  bg: '#3D1223',
  bgElevated: '#4B1A2C',
  bgElevatedVeil: 'rgba(61,18,35,0.9)',
  surfaceCard: 'rgba(85,34,53,0.72)',
  surfaceGlass: 'rgba(247,235,221,0.06)',
  surfaceGlassStrong: 'rgba(247,235,221,0.12)',
  borderGlass: 'rgba(222,201,176,0.22)',
  borderGlassSoft: 'rgba(222,201,176,0.14)',
  text: '#F7EBDD',
  textSecondary: '#DEC9B0',
  textTertiary: '#B89A86',
  accent: '#E5D0B6',
  accentFill: '#E5D0B6',
  badge: '#E5D0B6',
  badgeSolid: '#E5D0B6',
  badgeInk: '#3D1223',
  accentBright: '#E5D0B6',
  accentInk: '#3D1223',
  accentSoft: 'rgba(229,208,182,0.14)',
  accentLine: 'rgba(229,208,182,0.32)',
  accentFaint: 'rgba(229,208,182,0.62)',
  emberGlow: 'rgba(229,208,182,0.14)',
  emberGlowFade: 'rgba(229,208,182,0.05)',
  sun: '#F2B441',
  soon: '#F2B441',
  ok: '#BFD9A0',
  open: '#BFD9A0',
  shutInk: '#F3B5AA',
  ink: '#F0DFCB',
  bad: '#F2A99D',
  badSoft: '#5E2A36',
  okSoft: '#3F3B2A',
  okInk: '#BFD9A0',
  gradAI: ['#E5D0B6', '#D8BE9F'],
  ringTrack: '#5E2A3B',
  pillInk: '#3D1223',
  heartInk: '#E5D0B6',
  onPhotoAccent: '#E5D0B6',
  glassVeil: 'rgba(61,18,35,0.48)',
  glassHalo: 'rgba(61,18,35,0.95)',
  accentFade: 'rgba(229,208,182,0.02)',
};

/**
 * "Vàng đậm" (12 Oct 2026): the owner's "Chữ vàng đậm / Chữ đen than"
 * reference, #FEB431 and #191820 — taken as the *light* half, amber page
 * under charcoal type, because the dark half is Honey: #EDCA3B on
 * #1E1608 is the same reading a shade browner, and a second of it would
 * be a card the reader could not tell from the first.
 *
 * An amber page is the loudest ground in the set (0.54 — Rose's yellow
 * is 0.84), and the charcoal is both the type and the accent: links,
 * ticks and the pick mark are charcoal on amber (9.9), the fill is
 * charcoal under amber ink (9.9), and the tab bar's pill is the
 * secondary's near-black under a pale amber (8.8). Secondary and
 * tertiary type are the charcoal let up through brown (7.0 and 4.9, 1.43
 * apart — the floor, held by the tertiary at #574930: one step lighter
 * reads 4.4 on the page). Elevated surfaces are the page let up to a
 * straw (0.65), the one direction a saturated page can go. The warnings
 * are dark on it where every other look's are light: the amber `soon`
 * of the dark looks would vanish into this page, so it is a brown
 * (4.9 on the straw).
 */
const AMBER: Palette = {
  bg: '#FEB431',
  bgElevated: '#FFCB66',
  bgElevatedVeil: 'rgba(254,180,49,0.88)',
  surfaceCard: '#FFCB66',
  surfaceGlass: 'rgba(25,24,32,0.06)',
  surfaceGlassStrong: 'rgba(25,24,32,0.10)',
  borderGlass: 'rgba(25,24,32,0.16)',
  borderGlassSoft: 'rgba(25,24,32,0.09)',
  text: '#191820',
  textSecondary: '#3A3326',
  textTertiary: '#574930',
  accent: '#191820',
  accentFill: '#191820',
  badge: 'rgba(25,24,32,0.16)',
  badgeSolid: '#3A3326',
  badgeInk: '#FFD27A',
  accentBright: '#2A2430',
  accentInk: '#FEB431',
  accentSoft: 'rgba(25,24,32,0.10)',
  accentLine: 'rgba(25,24,32,0.32)',
  accentFaint: 'rgba(25,24,32,0.72)',
  emberGlow: 'rgba(25,24,32,0.10)',
  emberGlowFade: 'rgba(25,24,32,0.03)',
  sun: '#7A4E00',
  soon: '#7A4E00',
  ok: '#1F5A2E',
  open: '#1F5A2E',
  shutInk: '#8C2B1F',
  ink: '#221E1A',
  bad: '#8C2B1F',
  badSoft: '#FFD7C2',
  okSoft: '#F6E2A8',
  okInk: '#1F5A2E',
  gradAI: ['#191820', '#2A2430'],
  ringTrack: '#E9A52A',
  pillInk: '#FFD27A',
  heartInk: '#191820',
  onPhotoAccent: '#FEB431',
  glassVeil: 'rgba(255,203,102,0.48)',
  glassHalo: 'rgba(255,203,102,0.95)',
  accentFade: 'rgba(25,24,32,0.02)',
};

/**
 * "Hồng neon" (12 Oct 2026): the owner's "Tím hồng neon / Tím mận tối"
 * reference, #E670E5 and #271627, as a dark look.
 *
 * The dark plum is the page (0.012, Violet's neighbour) and the neon is
 * the accent at full strength (6.4 on the page, 4.9 over a white map
 * tile through the veil) — not lifted, as Wine's red had to be, because
 * a neon is already light enough to be read and lifting it would be
 * dimming it. The fill is the neon under plum ink (6.4), and so is the
 * pill. What tells it from Violet is exactly that: Violet's accent is a
 * lavender a reader rests on, this one is a sign in a window. Type is a
 * pale rose-white, its secondary a greyed mauve and its tertiary a
 * dusty one (15.1, 10.8 and 6.4; 1.70 apart).
 */
const NEON: Palette = {
  bg: '#271627',
  bgElevated: '#341E34',
  bgElevatedVeil: 'rgba(39,22,39,0.9)',
  surfaceCard: 'rgba(62,36,62,0.72)',
  surfaceGlass: 'rgba(247,238,246,0.06)',
  surfaceGlassStrong: 'rgba(247,238,246,0.12)',
  borderGlass: 'rgba(220,200,218,0.22)',
  borderGlassSoft: 'rgba(220,200,218,0.14)',
  text: '#F7EEF6',
  textSecondary: '#DCC8DA',
  textTertiary: '#B096AE',
  accent: '#E670E5',
  accentFill: '#E670E5',
  badge: '#E670E5',
  badgeSolid: '#E670E5',
  badgeInk: '#271627',
  accentBright: '#E670E5',
  accentInk: '#271627',
  accentSoft: 'rgba(230,112,229,0.16)',
  accentLine: 'rgba(230,112,229,0.32)',
  accentFaint: 'rgba(230,112,229,0.62)',
  emberGlow: 'rgba(230,112,229,0.16)',
  emberGlowFade: 'rgba(230,112,229,0.05)',
  sun: '#F2B441',
  soon: '#F2B441',
  ok: '#B9D89A',
  open: '#B9D89A',
  shutInk: '#F3B5AA',
  ink: '#EFE2ED',
  bad: '#F2A99D',
  badSoft: '#4F2340',
  okSoft: '#2E3A2A',
  okInk: '#B9D89A',
  gradAI: ['#E670E5', '#D45AD3'],
  ringTrack: '#4A2A4A',
  pillInk: '#271627',
  heartInk: '#E670E5',
  onPhotoAccent: '#E670E5',
  glassVeil: 'rgba(39,22,39,0.48)',
  glassHalo: 'rgba(39,22,39,0.95)',
  accentFade: 'rgba(230,112,229,0.02)',
};

/**
 * "Cam cháy" (12 Oct 2026): the owner's "Chữ đen cafe / Chữ cam cháy"
 * reference, #0C0903 and #F46809, as a dark look.
 *
 * The page is a black with coffee in it (0.003 — the charcoal's weight,
 * and the warmth is the whole of the difference between the two pages)
 * and the burnt orange is the accent at full strength (6.5 on the page,
 * 5.1 over a white tile through the veil), the fill and the pill under
 * black ink (6.5). It is the standard dark look's own shape — one hot
 * colour on near-black — and the reason it is a look of its own is the
 * hue: the coral #FF6F5B has pink in it, this has none, and the two
 * read as different rooms. Type is a warm off-white, its secondary a
 * parchment and its tertiary a taupe (17.5, 12.8 and 7.0; 1.82 apart).
 */
const EMBER: Palette = {
  bg: '#0C0903',
  bgElevated: '#1A1510',
  bgElevatedVeil: 'rgba(12,9,3,0.9)',
  surfaceCard: 'rgba(36,29,22,0.72)',
  surfaceGlass: 'rgba(246,239,232,0.06)',
  surfaceGlassStrong: 'rgba(246,239,232,0.12)',
  borderGlass: 'rgba(217,205,194,0.22)',
  borderGlassSoft: 'rgba(217,205,194,0.14)',
  text: '#F6EFE8',
  textSecondary: '#D9CDC2',
  textTertiary: '#A69787',
  accent: '#F46809',
  accentFill: '#F46809',
  badge: '#F46809',
  badgeSolid: '#F46809',
  badgeInk: '#0C0903',
  accentBright: '#F46809',
  accentInk: '#0C0903',
  accentSoft: 'rgba(244,104,9,0.14)',
  accentLine: 'rgba(244,104,9,0.32)',
  accentFaint: 'rgba(244,104,9,0.62)',
  emberGlow: 'rgba(244,104,9,0.16)',
  emberGlowFade: 'rgba(244,104,9,0.05)',
  sun: '#F2B441',
  soon: '#F2B441',
  ok: '#B9D89A',
  open: '#B9D89A',
  shutInk: '#F3B5AA',
  ink: '#EDE3D9',
  bad: '#F2A99D',
  badSoft: '#4A2418',
  okSoft: '#2A3324',
  okInk: '#B9D89A',
  gradAI: ['#F46809', '#E05A05'],
  ringTrack: '#2E2419',
  pillInk: '#0C0903',
  heartInk: '#F46809',
  onPhotoAccent: '#F46809',
  glassVeil: 'rgba(12,9,3,0.48)',
  glassHalo: 'rgba(12,9,3,0.95)',
  accentFade: 'rgba(244,104,9,0.02)',
};

export const PALETTES = {
  paper: PAPER, charcoal: CHARCOAL, coffee: COFFEE, rose: ROSE,
  blush: BLUSH, slate: SLATE, midnight: MIDNIGHT, navy: NAVY,
  chocolate: CHOCOLATE, cosmic: COSMIC, duck: DUCK, honey: HONEY, royal: ROYAL,
  plum: PLUM, violet: VIOLET, wine: WINE,
  maroon: MAROON, amber: AMBER, neon: NEON, ember: EMBER,
} as const;

/** Each look's two sides: the light half and the dark half of every pair. */
export const LOOKS: Record<Look, { light: Palette; dark: Palette }> = {
  standard: { light: PAPER, dark: CHARCOAL },
  coffee: { light: COFFEE, dark: COFFEE },
  rose: { light: ROSE, dark: ROSE },
  blush: { light: BLUSH, dark: BLUSH },
  slate: { light: SLATE, dark: SLATE },
  midnight: { light: MIDNIGHT, dark: MIDNIGHT },
  navy: { light: NAVY, dark: NAVY },
  chocolate: { light: CHOCOLATE, dark: CHOCOLATE },
  cosmic: { light: COSMIC, dark: COSMIC },
  duck: { light: DUCK, dark: DUCK },
  honey: { light: HONEY, dark: HONEY },
  royal: { light: ROYAL, dark: ROYAL },
  plum: { light: PLUM, dark: PLUM },
  violet: { light: VIOLET, dark: VIOLET },
  wine: { light: WINE, dark: WINE },
  maroon: { light: MAROON, dark: MAROON },
  amber: { light: AMBER, dark: AMBER },
  neon: { light: NEON, dark: NEON },
  ember: { light: EMBER, dark: EMBER },
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
