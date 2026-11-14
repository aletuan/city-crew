// A virtualized editorial shelf: one wide card, a tall card beside two
// stacked cards, then a pair. Only complete stacks are emitted, so a
// filtered or short shelf never reserves a hole for a missing collection.
export type MosaicEntry<C> = { c: C; at: number };
export type MosaicRow<C> = {
  kind: 'mosaic';
  layout: 'feature' | 'stack' | 'pair';
  items: MosaicEntry<C>[];
};

/** `from`: where this shelf's first card sits in the whole list, so a
 *  shelf cut into city groups still numbers its cards 0, 1, 2… from the
 *  top — the index the cards' test names and the Maestro flows read. */
export function mosaicRows<C>(collections: readonly C[], from = 0): MosaicRow<C>[] {
  const rows: MosaicRow<C>[] = [];
  for (let start = 0; start < collections.length; start += 6) {
    const chunk = collections.slice(start, start + 6).map((c, i) => ({ c, at: from + start + i }));
    rows.push({ kind: 'mosaic', layout: 'feature', items: chunk.slice(0, 1) });
    if (chunk.length >= 4) {
      rows.push({ kind: 'mosaic', layout: 'stack', items: chunk.slice(1, 4) });
      if (chunk.length > 4) rows.push({ kind: 'mosaic', layout: 'pair', items: chunk.slice(4) });
    } else if (chunk.length > 1) {
      rows.push({ kind: 'mosaic', layout: 'pair', items: chunk.slice(1) });
    }
  }
  return rows;
}

export type MosaicCaption = 'bottom' | 'top' | 'below';

/** Slug, never index, language, likes or randomness: searching, ranking,
 *  filtering and refreshing cannot move a collection's caption. */
export function mosaicCaption(slug: string): MosaicCaption {
  let hash = 2166136261;
  for (let i = 0; i < slug.length; i++) hash = Math.imul(hash ^ slug.charCodeAt(i), 16777619) >>> 0;
  const slot = hash % 5;
  return slot === 0 ? 'below' : slot < 3 ? 'top' : 'bottom';
}

// ── one block a city (owner, 5 Nov 2026) ──
//
// The shelf came in the catalog's own order, newest first, and the
// Mosaic cut it six at a time with no regard for what sat where: Ốc Hà
// Nội over Ngọt Sài Gòn beside Hội An Coffee above Đà Lạt — four cities
// in the first screen, side by side for no reason. The owner asked what
// would make neighbours belong together, and chose the city: it is the
// question a reader browsing lists is answering ("where am I going?"),
// and the one the filter's city chip already asks.
//
// Rejected, with what ruled each out:
// - By kind (cafés, nightlife…). Measured on the 48 public lists of 5 Nov
//   2026, nearly every one leads with food or cafés, so the blocks would
//   be one long block and a few crumbs; and a café list from Melbourne
//   beside one from Huế is still four cities in a screen.
// - Keeping one stream and only swapping neighbours. It moves the problem
//   around rather than naming it: nothing on the screen would say why two
//   cards sit together.

/** A city with fewer lists than this joins "elsewhere" rather than
 *  standing as a block of its own. Two would make a block that is one
 *  wide card and one pair — a heading over two cards, at a rhythm that
 *  reads as a gap. Measured on 5 Nov 2026: Hội An 2, Đà Nẵng 1, Vũng Tàu
 *  1 go together; Huế (3) keeps its own block. */
export const MOSAIC_MIN_CITY = 3;

export type MosaicGroup<C> = {
  /** `null`: the "elsewhere" block, always last. */
  city: string | null;
  count: number;
  rows: MosaicRow<C>[];
  /** "Elsewhere" only: the cities it gathers, most lists first — so the
   *  city sheet can say where "Elsewhere" is (owner, 7 Nov 2026: a reader
   *  after Hội An could not know it was in there). Lists in no city add
   *  none. */
  within?: string[];
};

/**
 * Which city a list is in: the one most of its places are in.
 *
 * Not the list's own `city_id`. That is stamped once, at creation, from
 * whatever city the app was set to, and the live rows show it: "[DALAT]
 * [CAFE] BEEN TO" says Saigon and all fifteen of its places are in Đà
 * Lạt; "[BRVT][CAFE]" says Saigon and is in Vũng Tàu (5 Nov 2026). The
 * stamp breaks a tie — "Fine Dining", eight places in each of two cities,
 * stays where its curator made it — and answers for a list with none.
 */
export function leadingCity(places: readonly (string | null | undefined)[], stamped: string | null | undefined): string | null {
  const tally = new Map<string, number>();
  for (const id of places) if (id) tally.set(id, (tally.get(id) ?? 0) + 1);
  let best: string | null = null;
  let most = 0;
  for (const [id, n] of tally) if (n > most) { best = id; most = n; }
  if (stamped && tally.get(stamped) === most) return stamped;
  return best ?? stamped ?? null;
}

/**
 * The Community Mosaic, one block a city.
 *
 * Blocks: the reader's own city first — the lists they can use tonight —
 * then the rest by how many lists they hold, then "elsewhere". Inside a
 * block, the list `rank` puts first takes the wide card, and the rest
 * follow in runs of the same leading kind, so the cafés of a city sit
 * together; a run is placed by its best-ranked list.
 *
 * `rank` is the caller's, and is asked once per block with that block's
 * lists (`useListRank`; it was most liked first until 14 Nov 2026, see
 * `docs/collection-ranking.md`). Per block and not once for the shelf:
 * every signal in it is measured among the lists it is handed, and a
 * city's lists are compared with each other. The runs come after it, so
 * its spreading of one author's lists holds for the wide card and the
 * head of each run and not inside a run: sitting the cafés together was
 * asked for first, and wins.
 *
 * Only for the shelf at rest. A search or a chip asks a question, and its
 * answer keeps the order `siftCollections` gives it.
 */
export function mosaicGroups<C extends { slug: string }>(collections: readonly C[], o: {
  cityOf: (c: C) => string | null;
  kindOf: (c: C) => string | null;
  rank: (lists: readonly C[]) => C[];
  home?: string | null;
  minCity?: number;
}): MosaicGroup<C>[] {
  const min = o.minCity ?? MOSAIC_MIN_CITY;
  const byCity = new Map<string | null, C[]>();
  for (const c of collections) {
    const city = o.cityOf(c);
    byCity.set(city, [...(byCity.get(city) ?? []), c]);
  }
  const blocks: [string | null, C[]][] = [];
  const elsewhere: C[] = [];
  const gathered: [string, number][] = [];
  for (const [city, lists] of byCity) {
    if (city && lists.length >= min) blocks.push([city, lists]);
    else {
      elsewhere.push(...lists);
      if (city) gathered.push([city, lists.length]);
    }
  }
  // Stable: equal counts keep the order their first list arrived in.
  const within = gathered.sort(([, a], [, b]) => b - a).map(([city]) => city);
  // Stable: equal counts keep the order their first list arrived in.
  blocks.sort(([a, x], [b, y]) => Number(b === o.home) - Number(a === o.home) || y.length - x.length);
  // `elsewhere` gathered in city order; put it back in arrival order.
  elsewhere.sort((a, b) => collections.indexOf(a) - collections.indexOf(b));
  if (elsewhere.length) blocks.push([null, elsewhere]);

  const arrange = (lists: C[]): C[] => {
    const [lead, ...rest] = o.rank(lists);
    const runs = new Map<string | null, C[]>();
    for (const c of rest) {
      const kind = o.kindOf(c);
      runs.set(kind, [...(runs.get(kind) ?? []), c]);
    }
    return [lead, ...[...runs.values()].flat()];
  };

  let from = 0;
  return blocks.map(([city, lists]) => {
    const rows = mosaicRows(arrange(lists), from);
    from += lists.length;
    return city ? { city, count: lists.length, rows } : { city, count: lists.length, rows, within };
  });
}
