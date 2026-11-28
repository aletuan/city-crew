import { describe, expect, it } from 'vitest';
import { PALETTES } from '../palettes';
import { contrastOf, LIKE_ON_DARK, LIKE_ON_LIGHT, likeInk, luminanceOf } from './likeInk';

/** `top` (hex or rgba) laid over `under` (hex), as `#RRGGBB`. */
function over(top: string, under: string): string {
  if (top.startsWith('#')) return top;
  const [r, g, b, a = 1] = top.match(/[\d.]+/g)!.map(Number);
  const u = [1, 3, 5].map((i) => parseInt(under.slice(i, i + 2), 16));
  return `#${[r, g, b].map((v, i) => Math.round(v * a + u[i] * (1 - a)).toString(16).padStart(2, '0')).join('')}`;
}

describe('the liked heart’s red', () => {
  it('reads luminance and contrast as WCAG does', () => {
    expect(luminanceOf('#000000')).toBe(0);
    expect(luminanceOf('#FFFFFF')).toBeCloseTo(1, 5);
    expect(contrastOf('#000000', '#FFFFFF')).toBeCloseTo(21, 3);
    // Whichever is given first.
    expect(contrastOf('#FFFFFF', '#000000')).toBeCloseTo(21, 3);
    // The grey whose contrast with white is the familiar 4.54.
    expect(contrastOf('#767676', '#FFFFFF')).toBeCloseTo(4.54, 2);
  });

  it('is the deeper red on a light page and the lighter on a dark one', () => {
    expect(likeInk(PALETTES.paper.bg)).toBe(LIKE_ON_LIGHT);
    expect(likeInk(PALETTES.charcoal.bg)).toBe(LIKE_ON_DARK);
    // The two nearest the line: Amber's yellow is light, Plum's is dark.
    expect(likeInk(PALETTES.amber.bg)).toBe(LIKE_ON_LIGHT);
    expect(likeInk(PALETTES.plum.bg)).toBe(LIKE_ON_DARK);
  });

  // The reason there are two, and the guard on a palette added later: a
  // heart is a graphic mark, owed 3:1 on whatever it stands on — the
  // page (a list's own page) or a card, which draws `surfaceCard` laid
  // over the page.
  it.each(Object.entries(PALETTES))('clears 3:1 on %s’s page and on its card', (_name, p) => {
    const red = likeInk(p.bg);
    expect(contrastOf(red, p.bg)).toBeGreaterThanOrEqual(3);
    expect(contrastOf(red, over(p.surfaceCard, p.bg))).toBeGreaterThanOrEqual(3);
  });

  it('is a red, and not any look’s accent wearing its name', () => {
    for (const red of [LIKE_ON_LIGHT, LIKE_ON_DARK]) {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(red.slice(i, i + 2), 16));
      expect(r).toBeGreaterThan(g * 1.8);
      expect(r).toBeGreaterThan(b * 1.5);
    }
  });
});
