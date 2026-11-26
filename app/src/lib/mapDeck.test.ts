import { describe, expect, it } from 'vitest';
import { buildDeck, DECK_MAX, DECK_RADIUS_KM } from './mapDeck';

// ~0.009° of latitude is 1 km.
const at = (slug: string, km: number) => ({ slug, lat: 10 + km * 0.009, lng: 106 });

describe('buildDeck', () => {
  it('puts the tapped place first and the rest nearest first', () => {
    const shown = [at('far', 2), at('a', 0), at('near', 0.5), at('mid', 1)];
    expect(buildDeck(shown, 'a')).toEqual(['a', 'near', 'mid', 'far']);
  });

  it('keeps nothing beyond the radius, and keeps what is on it', () => {
    const shown = [at('a', 0), at('in', DECK_RADIUS_KM - 0.05), at('out', DECK_RADIUS_KM + 0.1)];
    expect(buildDeck(shown, 'a')).toEqual(['a', 'in']);
  });

  it('stops at the cap, anchor included', () => {
    const shown = [at('a', 0), ...Array.from({ length: 40 }, (_, i) => at(`p${i}`, 0.01 * (i + 1)))];
    const deck = buildDeck(shown, 'a');
    expect(deck).toHaveLength(DECK_MAX);
    expect(deck[DECK_MAX - 1]).toBe(`p${DECK_MAX - 2}`);
  });

  it('skips places with no coordinates', () => {
    const shown = [at('a', 0), { slug: 'x', lat: null, lng: 106 }, { slug: 'y', lat: 10, lng: null }, at('b', 1)];
    expect(buildDeck(shown, 'a')).toEqual(['a', 'b']);
  });

  it('is empty when the anchor is not shown or has no coordinates', () => {
    expect(buildDeck([at('b', 1)], 'a')).toEqual([]);
    expect(buildDeck([{ slug: 'a', lat: null, lng: 106 }], 'a')).toEqual([]);
    expect(buildDeck([{ slug: 'a', lat: 10, lng: null }], 'a')).toEqual([]);
  });

  it('is the anchor alone when nothing is near', () => {
    expect(buildDeck([at('a', 0), at('far', 50)], 'a')).toEqual(['a']);
  });
});
