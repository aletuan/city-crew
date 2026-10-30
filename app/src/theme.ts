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
// yellow #F4ECC2, a light look; its note is on `ROSE` (`palettes.ts`). Four more
// came from four two-tone references on 11 Oct 2026 — blush and slate,
// light; midnight and navy, dark — and two more that day, chocolate and
// cosmic, both dark; then three more, duck (light), honey and royal
// (dark); on 12 Oct plum, violet and wine, all dark; and that evening
// four more from four two-tone references — maroon, neon and ember,
// dark, and amber, the one light look among them; on 13 Oct sand, light,
// the one half of a forest-and-sand reference that could be read. Each
// has its note on its palette.
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

import { DynamicColorIOS, Platform, Settings, type OpaqueColorValue } from 'react-native';
import { LOOK_DEFS, readLook, storeOf, type Look, type Pinned } from './lib/look';
import { PALETTES, type Palette } from './palettes';

// The values, one constant per palette, are `palettes.ts`'s; re-exported
// because a test or a swatch that wants one palette asks the theme.
export { PALETTES, type Palette };

/**
 * A colour that knows both themes.
 *
 * iOS only — it is the platform's own mechanism. Everywhere else (the web
 * build used for quick checks) it settles on the dark value, which is the
 * app's original and only shipping ground.
 */
const dyn = (light: string, dark: string): Color =>
  (Platform.OS === 'ios' ? DynamicColorIOS({ light, dark }) as OpaqueColorValue : dark);

/**
 * What a token is: a hex string, or the platform's own dynamic colour.
 *
 * Not React Native's `ColorValue`, which since 0.88 (SDK 58) is typed to
 * take `null` and a number as well — true of what a style accepts, and
 * not of what this theme hands out. Icons take only a string or a
 * native colour, so tokens typed as the wider `ColorValue` were refused
 * at every icon in the app (198 places, 24 Oct 2026). `DynamicColorIOS`
 * is typed as returning that wider type too, and returns the native
 * colour object; the cast above says so once, here.
 */
export type Color = string | OpaqueColorValue;

type Sides = { light: Palette; dark: Palette };

/**
 * Each look's two sides: the light half and the dark half of every pair.
 *
 * Standard is the one look with two palettes, paper and charcoal, and is
 * written out. Every other look is one palette worn on both sides — the
 * same object twice, so `pick` finds nothing that differs and no colour
 * goes out dynamic — and is read off `LOOK_DEFS`, which is why a new look
 * is a row there and its palette in `PALETTES`, and no line here.
 */
export const LOOKS: Record<Look, Sides> = {
  standard: { light: PALETTES.paper, dark: PALETTES.charcoal },
  ...(Object.fromEntries(
    (Object.keys(LOOK_DEFS) as Pinned[]).map((l) => [l, { light: PALETTES[l], dark: PALETTES[l] }]),
  ) as Record<Pinned, Sides>),
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
const pick = (k: Exclude<keyof Palette, 'gradAI'>): Color =>
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
  /** The warning well and its ink — see the palette note. First used by
   *  the start sheet (14 Oct 2026) for a pin that fell in no catalog
   *  city, which a grey line under the field had let readers walk past. */
  warnSoft: pick('warnSoft'),
  warnInk: pick('warnInk'),
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

/**
 * The dark a collection's cover card wears under its words: the Explore
 * shelf and the Collections grid, one card language, one ramp.
 *
 * Measured, not chosen (owner, 30 Oct 2026). The words are white on
 * whatever the photograph is, so the case that matters is a white one
 * behind the title. The title's line box sits from 66% of the card's
 * height on a 320pt phone to 76% on a 430pt one, both cards alike. The
 * three-stop ramp it replaced was still only 0.56 dark there on the
 * shelf (4.2:1 on a 393pt phone, 3.9 on 375) and 0.38 on the grid,
 * whose ramp began later (2.5–3.3:1), against the 4.5 a 16pt title
 * needs. A stop of 0.66 at 66% holds the title at 5.5:1 or more on every
 * phone down to 320, and the line under it, in the 82% secondary ink,
 * above 7. The ramp starts at half the card's height, later than the
 * shelf's 42% and earlier than the grid's 55%: the top half of the
 * picture stays the picture.
 */
export const coverScrim = {
  colors: ['rgba(10,11,10,0.22)', 'rgba(10,11,10,0.10)', 'rgba(10,11,10,0.66)', 'rgba(10,11,10,0.94)'] as const,
  locations: [0, 0.5, 0.66, 1] as const,
};

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
  /** Large screen title — the one place the display face carries a whole line.
   *  30, from 34 (owner, 25 Oct 2026): beside the 22pt section headings it
   *  stood a size too loud, and on the tabs whose title stays put it kept
   *  height from the list. Still two clear steps above `section`. */
  title: { fontSize: 30, fontFamily: display.bold, letterSpacing: 0.3 },
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
