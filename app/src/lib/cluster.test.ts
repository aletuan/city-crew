import { describe, expect, it } from 'vitest';
import { clusterPins, clusterSize, type ClusterPoint } from './cluster';

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
    expect(clusterSize(2)).toBe(36);
    expect(clusterSize(9)).toBe(36);
    expect(clusterSize(10)).toBe(44);
    expect(clusterSize(99)).toBe(44);
    expect(clusterSize(100)).toBe(52);
    expect(clusterSize(288)).toBe(52);
  });
});
