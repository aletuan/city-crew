// The words and the shape of the Collections screen's shelf, as functions
// of what they read.
//
// They were closures inside the screen, over the sift's hits, the chosen
// chips and the view switch. Nothing in them needs a renderer, and each
// is the kind of thing a screen test can only reach by rendering a whole
// shelf to read one line of it — so they sit here, under the gate, and
// the screen passes in what they used to close over.
//
// The sift itself — which lists are listed, and why — is `siftCollections`
// in `search.ts`. This is what the card and the heading then say about it.

import type { CollectionHit } from './search';

type T = (en: string, vi: string, ja?: string) => string;

/** "1 place", "3 places" — the count a card prints when nothing narrower
 *  needs saying. */
export function placesOf(n: number, t: T): string {
  return `${n} ${t(n === 1 ? 'place' : 'places', 'địa điểm', 'スポット')}`;
}

/** "1 collection", "4 collections" — the heading's count. */
export function listsWord(n: number, t: T): string {
  return t(n === 1 ? '1 collection' : `${n} collections`, `${n} bộ sưu tập`, `${n}件のコレクション`);
}

/**
 * Why a card is listed, when the shelf is narrowed — the line under its
 * name. "MONO Coffee Lab" when the words landed on a place rather than
 * on the list: the place's name alone, since 21 Oct 2026 (owner) — the
 * reader just typed it, so "matches" before it said nothing they did not
 * know, and cost a third of a narrow card's line; "3 of 8 places · Cafés" when a chip reached
 * part of it. Null when the ordinary count says it all: nothing asked
 * (every place is a hit then, by construction), or a list found by its
 * own words with every place still counted.
 *
 * `chosen` is the chips' own labels, the kind first and then the city,
 * as the heading prints them: the part-count names what it is a part of.
 */
export function reasonFor(hit: CollectionHit<unknown> | undefined, chosen: readonly string[], t: T): string | null {
  if (!hit) return null;
  const parts: string[] = [];
  if (hit.place) {
    const name = t(hit.place.name_en ?? '', hit.place.name_vi ?? '', hit.place.name_ja ?? undefined);
    parts.push(name);
  }
  if (hit.hits !== hit.total) {
    parts.push(t(
      `${hit.hits} of ${placesOf(hit.total, t)}`,
      `${hit.hits} trong ${placesOf(hit.total, t)}`,
      `${placesOf(hit.total, t)}のうち${hit.hits}`,
    ));
    parts.push(...chosen);
  }
  return parts.length ? parts.join(' · ') : null;
}

/**
 * The line under the title: how many lists, and across how many cities
 * — the same on both shelves now that both show every city. Narrowed,
 * it names the chips instead, as the visits screen does.
 *
 * `cities` is the ids the shelf's lists reach; one is named, more are
 * counted.
 */
export function scopeLine(
  { count, chosen, cities, cityName }: {
    count: number;
    chosen: readonly string[];
    cities: readonly string[];
    cityName: (id: string) => string;
  },
  t: T,
): string {
  if (chosen.length) return [listsWord(count, t), ...chosen].join(' · ');
  const k = cities.length;
  if (k === 0) return listsWord(count, t);
  return `${listsWord(count, t)} · ${k === 1 ? cityName(cities[0]) : t(`${k} cities`, `${k} thành phố`, `${k}都市`)}`;
}

/**
 * One row-item of the shelf.
 *
 * SectionList knows nothing of columns, so the grid packs itself: two
 * cards per row-item, and the odd last card keeps a spacer where its
 * neighbour would be. Every row-item carries whose it is — a tile
 * shows a padlock for your own and a byline for everyone else's, and
 * the two row shapes split the same way: yours swipe, the community's
 * do not.
 *
 * `at` is a card's place in its whole list, not in its row-item: the
 * smoke flows open "the first community collection" as
 * `collection-card-0`, and it has to be the same card whichever shape
 * the reader last picked.
 */
export type ShelfRow<C> =
  | { kind: 'own'; c: C }
  | { kind: 'com'; c: C; at: number }
  | { kind: 'pair'; pair: C[]; own: boolean; at: number };

/** Two to a row-item, the last one alone when the count is odd. */
export function pairUp<C>(list: readonly C[], own: boolean): ShelfRow<C>[] {
  const out: ShelfRow<C>[] = [];
  for (let i = 0; i < list.length; i += 2) out.push({ kind: 'pair', pair: list.slice(i, i + 2), own, at: i });
  return out;
}

/** A shelf's lists as the row-items the chosen view draws. */
export function shape<C>(list: readonly C[], own: boolean, view: 'tile' | 'row'): ShelfRow<C>[] {
  return view === 'tile'
    ? pairUp(list, own)
    : list.map((c, at): ShelfRow<C> => (own ? { kind: 'own', c } : { kind: 'com', c, at }));
}
