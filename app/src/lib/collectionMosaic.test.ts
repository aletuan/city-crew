import { describe, expect, it } from 'vitest';
import { mosaicCaption, mosaicRows } from './collectionMosaic';

describe('mosaicRows', () => {
  it('packs six collections in editorial order without reordering them', () => {
    const rows = mosaicRows(['a', 'b', 'c', 'd', 'e', 'f', 'g']);
    expect(rows.map(r => [r.layout, r.items.map(e => e.c)])).toEqual([
      ['feature', ['a']], ['stack', ['b', 'c', 'd']], ['pair', ['e', 'f']], ['feature', ['g']],
    ]);
  });

  it('keeps every collection and original index exactly once, including every partial tail', () => {
    for (let length = 0; length <= 18; length++) {
      const input = Array.from({ length }, (_, i) => ({ slug: String(i) }));
      const rows = mosaicRows(input);
      expect(rows.flatMap(r => r.items)).toEqual(input.map((c, at) => ({ c, at })));
      for (const row of rows) {
        expect(row.items.length).toBeGreaterThan(0);
        if (row.layout === 'stack') expect(row.items).toHaveLength(3);
        if (row.layout === 'pair') expect(row.items.length).toBeLessThanOrEqual(2);
      }
    }
  });
});

describe('mosaicCaption', () => {
  it('offers all three treatments, with one stable choice per slug regardless of shelf order', () => {
    const slugs = Array.from({ length: 40 }, (_, i) => `collection-${i}`);
    const bySlug = new Map(slugs.map(slug => [slug, mosaicCaption(slug)]));
    expect(new Set(bySlug.values())).toEqual(new Set(['bottom', 'top', 'below']));
    expect(slugs.reverse().map(slug => mosaicCaption(slug))).toEqual(slugs.map(slug => bySlug.get(slug)));
    expect(mosaicCaption('')).toBe(mosaicCaption(''));
  });
});
