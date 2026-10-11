// Which set of colours the app is wearing — the part of the appearance
// setting that iOS cannot switch on its own.
//
// ── why this exists ──
//
// The colours in `src/theme.ts` are `DynamicColorIOS` pairs: UIKit holds a
// light and a dark value for each and repaints between them at draw time,
// which is why Light and Dark switch instantly with no React involved. A
// pair has exactly two sides. The owner asked for four looks — paper,
// charcoal, the coffee brown (#861) and the rose-on-yellow reference — and
// a third value has nowhere to go in a pair. Four more followed on 11 Oct
// 2026, from four two-tone references: blush, slate, midnight and navy.
//
// So a look is chosen once, when `theme.ts` is first imported, and it
// decides what the two sides of every pair are:
//
//   standard  light paper,   dark charcoal   — Automatic / Light / Dark
//   coffee    coffee on both sides           — pinned dark
//   rose      rose on both sides             — pinned light
//   blush     blush on both sides            — pinned light
//   slate     slate on both sides            — pinned light
//   midnight  midnight on both sides         — pinned dark
//   navy      navy on both sides             — pinned dark
//
// Moving between Light, Dark and Automatic stays instant, as before: the
// look does not change. Moving to or from any other look changes the look,
// which means re-evaluating every module-scope stylesheet in the app, which
// means restarting the JavaScript. The alternative — turning eighteen
// module-scope stylesheets into hooks — was weighed and is the larger,
// riskier change for a setting people touch once.
//
// The look is read synchronously at import, so it is stored where a
// synchronous read exists: iOS's `Settings` (NSUserDefaults), not
// AsyncStorage, whose answer arrives after every stylesheet has been built.
// This module is the pure half — the names, the mapping, and the reading
// and writing against a store handed in; `theme.ts` and `lib/theme.tsx`
// hand it React Native's `Settings`.

/** The ground: one of the two halves of every colour pair. */
export type Scheme = 'dark' | 'light';
/**
 * The looks that are one palette worn on both sides, and the ground each
 * pins the window to. The blur's tint, the status bar and every
 * scheme-picked value read the ground, and they have to agree with the
 * colours: a navy page under a light status bar would lose the clock.
 * The order is the sheet's.
 */
export const PINNED = {
  coffee: 'dark',
  rose: 'light',
  blush: 'light',
  slate: 'light',
  midnight: 'dark',
  navy: 'dark',
} as const satisfies Record<string, Scheme>;

/** A look other than the standard one. */
export type Pinned = keyof typeof PINNED;
/** What the person chose in the Theme sheet, and what is stored. */
export type Pref = Scheme | 'system' | Pinned;
/** The set of colours the pairs are built from. */
export type Look = 'standard' | Pinned;

const isPinned = (v: unknown): v is Pinned =>
  typeof v === 'string' && Object.prototype.hasOwnProperty.call(PINNED, v);

/** The NSUserDefaults key the look is kept under. */
export const LOOK_KEY = 'citycrew.look';

/** Every setting the sheet offers, in its order. */
export const PREFS: readonly Pref[] = ['system', 'light', 'dark', ...(Object.keys(PINNED) as Pinned[])];

/** A stored value, narrowed: anything unrecognised is the standard look,
 *  which is what every install had before there was a choice. */
export function parseLook(v: unknown): Look {
  return isPinned(v) ? v : 'standard';
}

/** A stored setting, narrowed; anything unrecognised is Automatic. */
export function parsePref(v: unknown): Pref {
  return typeof v === 'string' && (PREFS as readonly string[]).includes(v) ? (v as Pref) : 'system';
}

/** The look a setting wears. */
export function lookOf(pref: Pref): Look {
  return isPinned(pref) ? pref : 'standard';
}

/** The ground a setting pins the window to, or null to follow the phone.
 *  Light and Dark pin their own; every other look pins its own (`PINNED`). */
export function pinnedScheme(pref: Pref): Scheme | null {
  if (pref === 'system') return null;
  return isPinned(pref) ? PINNED[pref] : pref;
}

/** Whether moving from the loaded look to this setting needs a restart. */
export function needsRestart(loaded: Look, next: Pref): boolean {
  return lookOf(next) !== loaded;
}

/**
 * The part of React Native's `Settings` this needs. Undefined off iOS:
 * `react-native-web` has no `Settings`, so the web build and the test
 * runner hand in nothing, and every reading there is the standard look.
 */
export type LookStore = {
  get?: (key: string) => unknown;
  set?: (values: Record<string, unknown>) => void;
} | undefined;

/**
 * The store, fetched where fetching it can throw. A test that mocks
 * `react-native` without a `Settings` makes merely reading the name an
 * error — and `theme.ts` reads it at import, under every screen's tests.
 */
export function storeOf(get: () => unknown): LookStore {
  try {
    return get() as LookStore;
  } catch {
    return undefined;
  }
}

/** Whether a look can be kept at all. Where it cannot, the pinned looks
 *  are not offered: choosing one would restart into the standard look. */
export function canHoldLook(store: LookStore): boolean {
  return typeof store?.get === 'function' && typeof store.set === 'function';
}

/** The stored look; a store that throws is read as holding nothing. */
export function readLook(store: LookStore): Look {
  try {
    return parseLook(store?.get?.(LOOK_KEY));
  } catch {
    return 'standard';
  }
}

/** Keep a look for the next launch. False when it could not be kept — and
 *  a restart then would only come back in the look it left. */
export function writeLook(store: LookStore, look: Look): boolean {
  if (!canHoldLook(store)) return false;
  try {
    store!.set!({ [LOOK_KEY]: look });
    return true;
  } catch {
    return false;
  }
}
