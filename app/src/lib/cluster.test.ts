import { describe, expect, it } from 'vitest';
import { CATEGORIES, CATEGORY_ORDER } from './categories';
import { clusterPins, clusterSize, clusterSkin, type ClusterPoint } from './cluster';

const p = (slug: string, lat: number, lng: number): ClusterPoint => ({ slug, lat, lng });

// A region a tenth of a degree across cuts cells of 0.1/12 ≈ 0.00833°,
// which is about 900 m of latitude — the scale at which the city fits on
// the screen and the pins pile up.
const CITY = { latitudeDelta: 0.1, longitudeDelta: 0.1 };
const STREET = { latitudeDelta: 0.001, longitudeDelta: 0.001 };

describe('clusterPins', () => {
  it('gathers places that share a cell, and counts them', () => {
    const out = clusterPins([p('a', 21.0001, 105.0001), p('b', 21.0002, 105.0002)], CITY);
    expect(out).toHaveLength(1);
    expect(out[0].slugs).toEqual(['a', 'b']);
  });

  it('leaves places in cells of their own alone', () => {
    const out = clusterPins([p('a', 21, 105), p('b', 21.05, 105.05)], CITY);
    expect(out.map((c) => c.slugs)).toEqual([['a'], ['b']]);
  });

  // The point of cutting the grid from the region: no threshold decides
  // when to stop clustering. The reader zooming in does.
  it('comes apart as the reader zooms in, without being told to', () => {
    const pins = [p('a', 21.0001, 105.0001), p('b', 21.0002, 105.0002)];
    expect(clusterPins(pins, CITY)).toHaveLength(1);
    expect(clusterPins(pins, STREET)).toHaveLength(2);
  });

  it('sits the bubble on the mean of what it holds, not on its first member', () => {
    const out = clusterPins([p('a', 21, 105), p('b', 21.002, 105.004), p('c', 21.004, 105.002)], CITY);
    expect(out).toHaveLength(1);
    expect(out[0].lat).toBeCloseTo(21.002, 6);
    expect(out[0].lng).toBeCloseTo(105.002, 6);
  });

  // The strip along the bottom is already talking about the chosen place;
  // its pin disappearing into a bubble would read as a bug.
  it('keeps the chosen place out of every cluster', () => {
    const out = clusterPins([p('a', 21.0001, 105.0001), p('b', 21.0002, 105.0002)], CITY, 'b');
    expect(out.map((c) => c.slugs)).toEqual([['a'], ['b']]);
  });

  it('clusters normally when the chosen place is not among the pins', () => {
    const out = clusterPins([p('a', 21.0001, 105.0001), p('b', 21.0002, 105.0002)], CITY, 'zzz');
    expect(out.map((c) => c.slugs)).toEqual([['a', 'b']]);
  });

  // A region with no width cannot be divided into cells. One frame of
  // mound beats a division by zero.
  it('gives every place its own pin when the region has no width yet', () => {
    const pins = [p('a', 21.0001, 105.0001), p('b', 21.0002, 105.0002)];
    expect(clusterPins(pins, { latitudeDelta: 0, longitudeDelta: 0.1 })).toHaveLength(2);
    expect(clusterPins(pins, { latitudeDelta: 0.1, longitudeDelta: 0 })).toHaveLength(2);
    expect(clusterPins(pins, { latitudeDelta: NaN, longitudeDelta: NaN })).toHaveLength(2);
  });

  // The one thing a reader can check by eye: the counts on the bubbles,
  // plus the lone pins, must come to the number of places the list says.
  // Every point lands in exactly one cell, once.
  it('is a partition — every place once, none invented, none lost', () => {
    const many = Array.from({ length: 50 }, (_, i) => p(`s${i}`, 21 + (i % 7) * 0.004, 105 + (i % 5) * 0.004));
    const out = clusterPins(many, CITY, 's3');
    const seen = out.flatMap((c) => c.slugs);
    expect(seen).toHaveLength(50);
    expect(new Set(seen)).toEqual(new Set(many.map((m) => m.slug)));
  });

  it('has nothing to say about nothing', () => {
    expect(clusterPins([], CITY)).toEqual([]);
  });

  // Two renders of the same screen must agree, so the order out is the
  // order in — first appearance of each cell.
  it('returns the cells in the order their first member arrived', () => {
    const out = clusterPins([p('far', 21.05, 105.05), p('a', 21, 105), p('b', 21.0001, 105.0001)], CITY);
    expect(out.map((c) => c.slugs)).toEqual([['far'], ['a', 'b']]);
  });
});

describe('clusterSize', () => {
  it('answers in three steps, not on a curve', () => {
    expect(clusterSize(2)).toBe(32);
    expect(clusterSize(9)).toBe(32);
    expect(clusterSize(10)).toBe(40);
    expect(clusterSize(99)).toBe(40);
    expect(clusterSize(100)).toBe(48);
    expect(clusterSize(288)).toBe(48);
  });
});

describe('clusterSkin', () => {
  // Colour and size must not tell two stories, so they step together.
  it('deepens at the same two counts the size steps at', () => {
    expect(clusterSkin(9).fill).toBe(clusterSkin(2).fill);
    expect(clusterSkin(10).fill).not.toBe(clusterSkin(9).fill);
    expect(clusterSkin(99).fill).toBe(clusterSkin(10).fill);
    expect(clusterSkin(100).fill).not.toBe(clusterSkin(99).fill);
  });

  it('turns its figure white only where the ground has gone dark', () => {
    expect(clusterSkin(9).ink).toBe('#17150F');
    expect(clusterSkin(99).ink).toBe('#17150F');
    expect(clusterSkin(100).ink).toBe('#FFFFFF');
  });

  // The one coral thing on the map is the place the reader chose.
  it('never reaches for the accent', () => {
    for (const n of [1, 10, 100, 288]) expect(clusterSkin(n).fill).not.toBe('#FF6F5B');
  });
});

/** Saturation, the channel that says whether a colour is *a colour* or a grey. */
function saturation(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return 0;
  const l = (max + min) / 2;
  return ((max - min) / (l > 0.5 ? 2 - max - min : max + min)) * 100;
}

describe('a bubble is not a kind of place', () => {
  // The bubbles used to be warm earth, which put all three of them inside
  // the hue arc `cafes` and `eats` live in — the hundred-bubble and the
  // Eats pin measured 1.04:1 against each other, which is to say they were
  // one colour. A reader scanning a busy map saw brown discs that were
  // sometimes a restaurant and sometimes forty places.
  //
  // Hue could not fix it: every hue this map can afford is already spoken
  // for, and a bubble in the one remaining gap would just read as a tenth
  // category. So the fix is the other channel. Every category pin carries
  // at least 55% saturation; a bubble carries under 20 and reads as grey,
  // which is what map furniture of ours should look like.
  it('stays too grey to be mistaken for a category', () => {
    for (const n of [1, 9, 10, 99, 100, 288]) {
      expect(saturation(clusterSkin(n).fill)).toBeLessThan(20);
    }
    for (const key of CATEGORY_ORDER) {
      expect(saturation(CATEGORIES[key].pin)).toBeGreaterThan(55);
    }
  });

  // Density still steps, and it steps in the one channel left: darkness.
  it('still deepens with the count', () => {
    const lightness = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
      return (Math.max(r, g, b) + Math.min(r, g, b)) / 2;
    };
    expect(lightness(clusterSkin(9).fill)).toBeGreaterThan(lightness(clusterSkin(10).fill));
    expect(lightness(clusterSkin(10).fill)).toBeGreaterThan(lightness(clusterSkin(100).fill));
  });
});
