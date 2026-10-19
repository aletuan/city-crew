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
// 2026, from four two-tone references: blush, slate, midnight and navy;
// then chocolate and cosmic, the same day.
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
//   chocolate chocolate on both sides        — pinned dark
//   cosmic    cosmic on both sides           — pinned dark
//   … and on 12 Oct 2026 duck (light), honey, royal, plum, violet, wine,
//   maroon, neon, ember (dark) and amber (light), the same way; on 13 Oct
//   sand (light).
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
 * Everything one look is, in one row: the ground it pins the window to,
 * the glyph its card and Profile's row wear, and its name in the app's
 * three languages. The order is the sheet's.
 *
 * ── one row per look (19 Oct 2026) ──
 *
 * A look used to be four entries in three files — the ground here, the
 * glyph in the sheet's option list, the name in a twenty-branch `if` in
 * `schemeLabel`, the palette in `theme.ts` — and the `if` fell through to
 * "Light" for a look it had not been told about. The SOLID review (O)
 * asked that adding a look be one row: this one, and its palette, which
 * `theme.ts` must now give every look here or fail to compile.
 *
 * The ground: the blur's tint, the status bar and every scheme-picked
 * value read it, and they have to agree with the colours — a navy page
 * under a light status bar would lose the clock.
 *
 * The glyphs name what each look is of: a cup for the coffee brown, a
 * flower for the rose, a heart for the blush, a cloud for the slate grey,
 * a star for the midnight sky, a boat for the navy, an ice cream for the
 * chocolate, a planet for the cosmic purple, a leaf for the teal, a bolt
 * for the honey yellow, a diamond for the royal blue, a fruit for the
 * plum, sparkles for the violet, a glass for the wine, a rose for the
 * maroon, a sun behind cloud for the amber, a bulb for the neon, a flame
 * for the ember, footsteps for the sand — not a leaf, which Duck's teal
 * already wears. Ionicons names, kept as text so this file stays pure;
 * a test holds each to a glyph that exists.
 */
export const LOOK_DEFS = {
  coffee: { ground: 'dark', icon: 'cafe-outline', name: { en: 'Coffee', vi: 'Nâu cafe', ja: 'コーヒー' } },
  rose: { ground: 'light', icon: 'flower-outline', name: { en: 'Rose', vi: 'Hồng', ja: 'ローズ' } },
  blush: { ground: 'light', icon: 'heart-outline', name: { en: 'Blush', vi: 'Hồng phấn', ja: 'ブラッシュ' } },
  slate: { ground: 'light', icon: 'cloud-outline', name: { en: 'Slate', vi: 'Xanh xám', ja: 'スレート' } },
  midnight: { ground: 'dark', icon: 'star-outline', name: { en: 'Midnight', vi: 'Xanh than', ja: 'ミッドナイト' } },
  navy: { ground: 'dark', icon: 'boat-outline', name: { en: 'Navy', vi: 'Xanh navy', ja: 'ネイビー' } },
  chocolate: { ground: 'dark', icon: 'ice-cream-outline', name: { en: 'Chocolate', vi: 'Sô-cô-la', ja: 'チョコレート' } },
  cosmic: { ground: 'dark', icon: 'planet-outline', name: { en: 'Cosmic', vi: 'Vũ trụ', ja: 'コズミック' } },
  duck: { ground: 'light', icon: 'leaf-outline', name: { en: 'Teal', vi: 'Xanh cổ vịt', ja: 'ティール' } },
  honey: { ground: 'dark', icon: 'flash-outline', name: { en: 'Honey', vi: 'Mật ong', ja: 'ハニー' } },
  royal: { ground: 'dark', icon: 'diamond-outline', name: { en: 'Royal', vi: 'Hoàng gia', ja: 'ロイヤル' } },
  plum: { ground: 'dark', icon: 'nutrition-outline', name: { en: 'Plum', vi: 'Mận', ja: 'プラム' } },
  violet: { ground: 'dark', icon: 'sparkles-outline', name: { en: 'Violet', vi: 'Tím', ja: 'バイオレット' } },
  wine: { ground: 'dark', icon: 'wine-outline', name: { en: 'Wine', vi: 'Rượu vang', ja: 'ワイン' } },
  maroon: { ground: 'dark', icon: 'rose-outline', name: { en: 'Maroon', vi: 'Đỏ mận', ja: 'マルーン' } },
  amber: { ground: 'light', icon: 'partly-sunny-outline', name: { en: 'Amber', vi: 'Vàng đậm', ja: 'アンバー' } },
  neon: { ground: 'dark', icon: 'bulb-outline', name: { en: 'Neon', vi: 'Hồng neon', ja: 'ネオン' } },
  ember: { ground: 'dark', icon: 'flame-outline', name: { en: 'Ember', vi: 'Cam cháy', ja: 'エンバー' } },
  sand: { ground: 'light', icon: 'footsteps-outline', name: { en: 'Sand', vi: 'Be cát', ja: 'サンド' } },
} as const satisfies Record<string, LookDef>;

/** One look, as `LOOK_DEFS` holds it. */
export type LookDef = {
  ground: Scheme;
  icon: string;
  name: { en: string; vi: string; ja: string };
};

/** Each look and the ground it pins, read off `LOOK_DEFS`. */
export const PINNED = Object.fromEntries(
  Object.entries(LOOK_DEFS).map(([id, def]) => [id, def.ground]),
) as { readonly [K in keyof typeof LOOK_DEFS]: (typeof LOOK_DEFS)[K]['ground'] };

/** A look other than the standard one. */
export type Pinned = keyof typeof LOOK_DEFS;
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
  return isPref(v) ? v : 'system';
}

/** Whether a value is a setting this build knows. `parsePref` folds the
 *  rest into the default; a reader that must tell "unknown" from "Auto"
 *  — the account sync, which must not overwrite a newer build's look with
 *  Auto — asks this instead. */
export function isPref(v: unknown): v is Pref {
  return typeof v === 'string' && (PREFS as readonly string[]).includes(v);
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

// ── coming back after the restart ──
//
// A look is a restart (see above), and a restart used to land the reader
// on the first tab with the sheet gone: the one thing they were doing,
// choosing a colour, was the thing the restart threw away — and so it was
// asked about first, in an alert, which is its own interruption. Now the
// sheet writes down where it was before the restart — the tab, that it was
// open, how far the page was scrolled — and the next launch reads it back
// once and puts the reader there, sheet open, in the new colours. Kept in
// `Settings` beside the look, because the navigator needs it before it
// mounts, and that is before AsyncStorage can answer.
//
// A minute, then it is ignored: a restart takes a second or two, and a
// record older than that is one a crash left behind, which must not make
// the next launch open a sheet nobody asked for.

export type Return = {
  /** The tab the reader was on. */
  tab: string;
  /** The sheet that was open on it, if one was. */
  sheet?: 'theme';
  /** How far down that tab's page was scrolled, in points. */
  y?: number;
  /** When it was written. */
  at: number;
};

/** The NSUserDefaults key the return is kept under. */
export const RETURN_KEY = 'citycrew.look.return';
/** How long a return stays worth taking. */
export const RETURN_TTL_MS = 60 * 1000;

/** Keep where the reader is for the launch after the restart. */
export function writeReturn(store: LookStore, r: Return): boolean {
  if (!canHoldLook(store)) return false;
  try {
    store!.set!({ [RETURN_KEY]: JSON.stringify(r) });
    return true;
  } catch {
    return false;
  }
}

/** A kept return, if it reads as one. */
function parseReturn(raw: unknown): Return | null {
  if (typeof raw !== 'string') return null;
  try {
    const v = JSON.parse(raw) as Partial<Return> | null;
    if (!v || typeof v.tab !== 'string' || typeof v.at !== 'number') return null;
    return {
      tab: v.tab,
      at: v.at,
      ...(v.sheet === 'theme' ? { sheet: 'theme' as const } : {}),
      ...(typeof v.y === 'number' ? { y: v.y } : {}),
    };
  } catch {
    return null;
  }
}

/**
 * The kept return if it is still fresh, and gone either way: a launch reads
 * it once, and a record it could not read is dropped rather than tried
 * again. A stamp from the future is refused, as `takeResume` refuses one.
 */
export function takeReturn(store: LookStore, now: number): Return | null {
  if (!canHoldLook(store)) return null;
  let raw: unknown;
  try {
    raw = store!.get!(RETURN_KEY);
    if (!raw) return null;
    store!.set!({ [RETURN_KEY]: '' });
  } catch {
    return null;
  }
  const r = parseReturn(raw);
  if (!r || r.at > now || now - r.at > RETURN_TTL_MS) return null;
  return r;
}

/**
 * Where the navigator opens: on the tab the reader left, or wherever it
 * would have anyway. A partial state — the tab navigator fills in the
 * other tabs around the one named.
 */
export function landingState(r: Return | null): { index: number; routes: { name: string }[] } | undefined {
  return r ? { index: 0, routes: [{ name: r.tab }] } : undefined;
}
