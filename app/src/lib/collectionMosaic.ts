// A virtualized editorial shelf: one wide card, a tall card beside two
// stacked cards, then a pair. Only complete stacks are emitted, so a
// filtered or short shelf never reserves a hole for a missing collection.
export type MosaicEntry<C> = { c: C; at: number };
export type MosaicRow<C> = {
  kind: 'mosaic';
  layout: 'feature' | 'stack' | 'pair';
  items: MosaicEntry<C>[];
};

export function mosaicRows<C>(collections: readonly C[]): MosaicRow<C>[] {
  const rows: MosaicRow<C>[] = [];
  for (let start = 0; start < collections.length; start += 6) {
    const chunk = collections.slice(start, start + 6).map((c, i) => ({ c, at: start + i }));
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
