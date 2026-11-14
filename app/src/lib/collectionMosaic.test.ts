import { describe, expect, it } from 'vitest';
import { leadingCity, MOSAIC_MIN_CITY, mosaicCaption, mosaicGroups, mosaicRows } from './collectionMosaic';

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

describe('mosaicRows from', () => {
  it('numbers the cards from where the shelf starts in the whole list', () => {
    expect(mosaicRows(['a', 'b'], 7).flatMap(r => r.items.map(e => e.at))).toEqual([7, 8]);
  });
});

describe('leadingCity', () => {
  it('is where most of the places are, not where the list was stamped', () => {
    // "[DALAT][CAFE] BEEN TO": stamped Saigon, every place in Đà Lạt.
    expect(leadingCity(['dalat', 'dalat', 'hcmc'], 'hcmc')).toBe('dalat');
  });
  it('keeps the stamp on a tie it is part of, and the first city to lead otherwise', () => {
    expect(leadingCity(['hanoi', 'hcmc'], 'hcmc')).toBe('hcmc');
    expect(leadingCity(['hanoi', 'hcmc'], 'hue')).toBe('hanoi');
    expect(leadingCity(['hanoi', 'hcmc', 'hcmc', 'hanoi'], null)).toBe('hanoi');
  });
  it('falls back to the stamp, then to nothing, when no place says', () => {
    expect(leadingCity([null, undefined], 'hue')).toBe('hue');
    expect(leadingCity([], null)).toBeNull();
    expect(leadingCity([], undefined)).toBeNull();
  });
});

describe('mosaicGroups', () => {
  type L = { slug: string; city: string | null; kind: string | null };
  const l = (slug: string, city: string | null, kind: string | null = 'cafes'): L => ({ slug, city, kind });
  // The caller's ranking, stood in for by the simplest one: most liked
  // first, arrival order on a tie. What `rank` really is, is
  // `lib/listRank`'s to test.
  const asked: string[][] = [];
  const group = (lists: L[], likes: Record<string, number> = {}, home?: string | null) =>
    mosaicGroups(lists, {
      cityOf: c => c.city,
      kindOf: c => c.kind,
      rank: (block) => {
        asked.push(block.map(c => c.slug));
        return [...block].sort((a, b) => (likes[b.slug] ?? 0) - (likes[a.slug] ?? 0));
      },
      home,
    });
  const slugs = (g: ReturnType<typeof group>[number]) => g.rows.flatMap(r => r.items.map(e => e.c.slug));

  it('is one block a city, the reader’s own first, then the biggest, then everything small last', () => {
    const lists = [
      l('h1', 'hue'), l('s1', 'hcmc'), l('a1', 'hoian'), l('n1', 'hanoi'), l('s2', 'hcmc'), l('h2', 'hue'),
      l('n2', 'hanoi'), l('s3', 'hcmc'), l('n3', 'hanoi'), l('s4', 'hcmc'), l('h3', 'hue'), l('d1', 'danang'), l('x', null), l('a2', 'hoian'),
    ];
    const groups = group(lists, {}, 'hue');
    expect(groups.map(g => [g.city, g.count])).toEqual([['hue', 3], ['hcmc', 4], ['hanoi', 3], [null, 4]]);
    // Elsewhere keeps the order the lists arrived in, across its cities —
    // not Hội An's two together because Hội An was met first.
    expect(slugs(groups[3])).toEqual(['a1', 'd1', 'x', 'a2']);
    // No home, or a home with too few lists: sized order alone.
    expect(group(lists).map(g => g.city)).toEqual(['hcmc', 'hue', 'hanoi', null]);
    expect(group(lists, {}, 'danang').map(g => g.city)).toEqual(['hcmc', 'hue', 'hanoi', null]);
  });

  // So the city sheet can say where "Elsewhere" is (owner, 7 Nov 2026).
  it('names the cities "elsewhere" gathers, most lists first, and only there', () => {
    const lists = [
      l('d1', 'danang'), l('h1', 'hue'), l('h2', 'hue'), l('h3', 'hue'), l('a1', 'hoian'),
      l('x', null), l('a2', 'hoian'), l('v1', 'vungtau'),
    ];
    const groups = group(lists);
    expect(groups.map(g => g.within)).toEqual([undefined, ['hoian', 'danang', 'vungtau']]);
    expect('within' in groups[0]).toBe(false);
    // A list in no city gathers none; with nothing else, the list is empty.
    expect(group([l('x', null)])[0].within).toEqual([]);
  });

  it('keeps a city of exactly the minimum as its own block', () => {
    expect(MOSAIC_MIN_CITY).toBe(3);
    const three = [l('a', 'hue'), l('b', 'hue'), l('c', 'hue')];
    expect(group(three).map(g => g.city)).toEqual(['hue']);
    expect(group(three.slice(0, 2)).map(g => g.city)).toEqual([null]);
  });

  it('asks for a ranking once a block, with that block’s lists and no others', () => {
    asked.length = 0;
    group([l('h1', 'hue'), l('n1', 'hanoi'), l('h2', 'hue'), l('n2', 'hanoi'), l('h3', 'hue'), l('n3', 'hanoi'), l('x', null)]);
    expect(asked).toEqual([['h1', 'h2', 'h3'], ['n1', 'n2', 'n3'], ['x']]);
  });

  it('gives the wide card to the list ranked first, and keeps the ranking’s order after it', () => {
    const lists = [l('a', 'hue'), l('b', 'hue'), l('c', 'hue'), l('d', 'hue')];
    expect(slugs(group(lists, { c: 2, d: 1 })[0])).toEqual(['c', 'd', 'a', 'b']);
    expect(slugs(group(lists)[0])).toEqual(['a', 'b', 'c', 'd']);
  });

  it('puts lists of the same leading kind side by side, each run where its best list stands', () => {
    const lists = [
      l('lead', 'hue', 'food'), l('bar1', 'hue', 'nightlife'), l('cafe1', 'hue', 'cafes'),
      l('bar2', 'hue', 'nightlife'), l('cafe2', 'hue', 'cafes'), l('odd', 'hue', null),
    ];
    // The cafés' best list outranks the bars', so the café run comes first.
    expect(slugs(group(lists, { lead: 9, cafe2: 3, bar1: 1 })[0]))
      .toEqual(['lead', 'cafe2', 'cafe1', 'bar1', 'bar2', 'odd']);
  });

  it('numbers every card once, from the top of the whole shelf, across blocks', () => {
    const lists = Array.from({ length: 11 }, (_, i) => l(`c${i}`, i % 2 ? 'hue' : 'hanoi'));
    const groups = group(lists);
    expect(groups.flatMap(g => g.rows.flatMap(r => r.items.map(e => e.at)))).toEqual(Array.from({ length: 11 }, (_, i) => i));
    expect(groups.flatMap(slugs).sort()).toEqual(lists.map(x => x.slug).sort());
    expect(group([])).toEqual([]);
  });
});
