// The city sheet's two lists: the few the reader actually moves between,
// and the whole book, in the order a long list is read.
//
// ── why (21 Oct 2026) ──
//
// The sheet drew every city in the desk's `sort_order`, one list. That was
// fine at five and is already a scroll at ten, and nobody uses ten cities:
// a reader lives in one and visits two or three. The owner asked for the
// cities they go back to on top, and the rest findable — browsed A to Z,
// or searched.
//
// ── recent ──
//
// The last cities the app showed, newest first, whoever chose them: a tap
// on a row, the location button, the bootstrap following the phone. Kept
// on the device (`CityProvider`), so it works signed out and offline, and
// costs nothing to read when the sheet opens. Three: a fourth row and the
// section is a second list to scan, which is what it exists to spare.
//
// The section is drawn only when it holds somewhere *else*. On a first
// launch it would hold the city on screen and nothing more, and a heading
// over one row that is already ticked below says nothing.
//
// ── the book ──
//
// A to Z by the name on screen, folded the way search folds it, so Đà Lạt
// sits beside Đà Nẵng with the Ds, and Hà Nội before Hải Phòng (the space
// in "ha noi" sorts before the "i" in "hai"). Compared by code point
// rather than `localeCompare`: Hermes and Node disagree about locales, and
// the order must be the same on the phone as in the test that pins it.
//
// Japanese names are katakana, and sort unfolded: NFKD splits a voiced
// kana into its base and a combining mark, which then sorts against the
// next kana — ブンタウ ahead of フエ. Left whole, a voiced kana sits just
// after its base, close to how a Japanese list is read.
//
// No letter headings. They shipped in #1100 and the owner took them out
// the same morning: with ten cities a D over two rows and an M over one
// is more heading than list. They come back with the A–Z rail (#1099),
// when the list is long enough to need finding in.
//
// A search is the same flat list, filtered, without the recent section:
// the reader asked a question, and the answer is the rows that match.
//
// Rejected for now, and filed as the second step (#1099): a thumbnail per
// city, a country line, and the rail. Six of ten cities had no photograph
// of their own that day.

import { fold } from './search';

/** How many cities the recent section holds. */
export const MAX_RECENT_CITIES = 3;

/** What `CityProvider` stores, read back. Anything not a list of ids is
 *  nothing, and the section simply starts again. */
export function parseCityRecents(raw: string | null): string[] {
  if (!raw) return [];
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return []; }
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string' && v.length > 0).slice(0, MAX_RECENT_CITIES);
}

/** The list with `id` at the front, once, cut to the cap. The same array
 *  back when `id` already leads, so a caller can tell nothing changed. */
export function rememberCity(list: readonly string[], id: string): string[] {
  if (list[0] === id) return list as string[];
  return [id, ...list.filter((x) => x !== id)].slice(0, MAX_RECENT_CITIES);
}

export type CityBook<C> = {
  /** The recent section; empty when it would say nothing. */
  recent: C[];
  /** Every city, A to Z — or, under a search, the ones that match. */
  all: C[];
};

type Options<C> = {
  recent: readonly string[];
  query: string;
  /** The name the row shows. */
  label: (c: C) => string;
  /** Every name the city answers to, for the search. */
  names: (c: C) => (string | null | undefined)[];
  /** Sort on the folded name (Latin scripts); false keeps it whole (kana). */
  folded: boolean;
};

/** The sheet's lists, from the cities, what the reader typed, and where
 *  they have been. */
export function cityBook<C extends { id: string }>(cities: readonly C[], o: Options<C>): CityBook<C> {
  const key = (c: C) => (o.folded ? fold(o.label(c)) : o.label(c));
  const sorted = [...cities].sort((a, b) => {
    const x = key(a);
    const y = key(b);
    return x < y ? -1 : x > y ? 1 : 0;
  });

  const q = fold(o.query.trim());
  if (q) return { recent: [], all: sorted.filter((c) => o.names(c).some((n) => fold(n).includes(q))) };

  // A retired city drops out rather than drawing a row that goes nowhere.
  const byId = new Map(cities.map((c) => [c.id, c]));
  const known = o.recent.map((id) => byId.get(id)).filter((c): c is C => !!c);
  return { recent: known.length > 1 ? known : [], all: sorted };
}
