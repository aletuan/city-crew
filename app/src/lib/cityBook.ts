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
// files under D beside Đà Nẵng, and Hà Nội before Hải Phòng (the space in
// "ha noi" sorts before the "i" in "hai"). Compared by code point rather
// than `localeCompare`: Hermes and Node disagree about locales, and the
// order must be the same on the phone as in the test that pins it.
//
// Lettered in the Latin languages only. Japanese names are katakana, and a
// row of A–Z headers over them would be a heading in a script the row is
// not written in; the kana sort by code point, unfolded, which keeps the
// list in near reading order, just not sectioned.
//
// A search is one flat list, the book's order, no recent and no letters:
// the reader asked a question, and the answer is the rows that match.
//
// Rejected for now, and filed as the second step (owner, 21 Oct 2026): a
// thumbnail per city, a country line, and an A–Z rail down the edge. Six
// of ten cities had no photograph of their own that day, and a rail earns
// its width at thirty cities, not ten.

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

export type CityGroup<C> = {
  /** The heading over the group, or null for a list with no headings. */
  letter: string | null;
  cities: C[];
};

export type CityBook<C> = {
  /** The recent section; empty when it would say nothing. */
  recent: C[];
  groups: CityGroup<C>[];
};

type Options<C> = {
  recent: readonly string[];
  query: string;
  /** The name the row shows. */
  label: (c: C) => string;
  /** Every name the city answers to, for the search. */
  names: (c: C) => (string | null | undefined)[];
  /** Headings by first letter; false for a script without them. */
  lettered: boolean;
};

/** The sheet's lists, from the cities, what the reader typed, and where
 *  they have been. */
export function cityBook<C extends { id: string }>(cities: readonly C[], o: Options<C>): CityBook<C> {
  // Kana unfolded: NFKD splits a voiced kana into its base and a combining
  // mark, which then sorts the mark against the next kana — ブンタウ ahead
  // of フエ. Left whole, a voiced kana sits just after its base, which is
  // close to how a Japanese list is read.
  const key = (c: C) => (o.lettered ? fold(o.label(c)) : o.label(c));
  const sorted = [...cities].sort((a, b) => {
    const x = key(a);
    const y = key(b);
    return x < y ? -1 : x > y ? 1 : 0;
  });

  const q = fold(o.query.trim());
  if (q) {
    const found = sorted.filter((c) => o.names(c).some((n) => fold(n).includes(q)));
    return { recent: [], groups: found.length ? [{ letter: null, cities: found }] : [] };
  }

  // A retired city drops out rather than drawing a row that goes nowhere.
  const byId = new Map(cities.map((c) => [c.id, c]));
  const known = o.recent.map((id) => byId.get(id)).filter((c): c is C => !!c);
  const recent = known.length > 1 ? known : [];

  if (!o.lettered) {
    return { recent, groups: sorted.length ? [{ letter: null, cities: sorted }] : [] };
  }
  const groups: CityGroup<C>[] = [];
  for (const c of sorted) {
    const first = key(c).charAt(0).toUpperCase();
    const letter = /[A-Z]/.test(first) ? first : '#';
    const last = groups[groups.length - 1];
    if (last && last.letter === letter) last.cities.push(c);
    else groups.push({ letter, cities: [c] });
  }
  return { recent, groups };
}
