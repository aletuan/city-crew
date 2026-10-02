// @vitest-environment jsdom
//
// The pin-on-a-map glyph on the Places tab. `react-native-svg` is stubbed
// (see `uitest/setup`), so what is pinned is the drawing's structure: two
// shapes, the map behind a knock-out mask and the pin in front of it, the
// solid and outline variants telling apart, the size and colour it was
// given, and a mask id that two glyphs on one screen do not share.

import React from 'react';
import { describe, expect, it } from 'vitest';
import { render } from '../uitest/render';

import PlacesGlyph from './PlacesGlyph';

const draw = (solid: boolean, size = 22) => render(<PlacesGlyph size={size} color="#17150F" solid={solid} testID="g" />).container;
const pin = (c: HTMLElement) => c.querySelector('[data-testid="places-pin"]')!;
const map = (c: HTMLElement) => c.querySelector('[data-testid="places-map"]')!;

describe('PlacesGlyph', () => {
  it('is a pin in front of a map, the map knocked out around the pin head', () => {
    const c = draw(true);
    const svg = c.querySelector('[data-stub="Svg"]')!;
    expect(svg.getAttribute('width')).toBe('22');
    expect(svg.getAttribute('height')).toBe('22');
    expect(svg.getAttribute('fill')).toBe('#17150F');
    expect(svg.getAttribute('viewBox')).toBe('0 0 512 512');
    // The map sits inside the masked group; the pin does not.
    const mask = c.querySelector('[data-stub="Mask"]')!;
    const maskId = mask.getAttribute('id')!;
    const masked = c.querySelector(`[mask="url(#${maskId})"]`)!;
    expect(masked.contains(map(c))).toBe(true);
    expect(masked.contains(pin(c))).toBe(false);
    // The knock-out is a disc on a white field.
    expect(mask.querySelector('[data-stub="Rect"]')?.getAttribute('fill')).toBe('white');
    expect(mask.querySelector('[data-stub="Circle"]')?.getAttribute('fill')).toBe('black');
    // The pin is drawn after the map, so it is on top.
    const order = [...c.querySelectorAll('[data-stub="Path"]')].map((p) => p.getAttribute('data-testid'));
    expect(order).toEqual(['places-map', 'places-pin']);
  });

  it('switches both shapes between outline and solid', () => {
    const a = draw(false); const b = draw(true);
    expect(pin(a).getAttribute('d')).not.toBe(pin(b).getAttribute('d'));
    expect(map(a).getAttribute('d')).not.toBe(map(b).getAttribute('d'));
    // Each is one of Ionicons' outlines: a solid is shorter than its outline.
    expect(pin(b).getAttribute('d')!.length).toBeLessThan(pin(a).getAttribute('d')!.length);
    expect(map(b).getAttribute('d')!.length).toBeLessThan(map(a).getAttribute('d')!.length);
  });

  it('scales with the size it is given', () => {
    const svg = draw(false, 44).querySelector('[data-stub="Svg"]')!;
    expect(svg.getAttribute('width')).toBe('44');
    expect(svg.getAttribute('height')).toBe('44');
  });

  it('gives two glyphs on one screen two mask ids', () => {
    const c = render(<><PlacesGlyph size={22} color="#000" solid /><PlacesGlyph size={22} color="#000" solid={false} /></>).container;
    const ids = [...c.querySelectorAll('[data-stub="Mask"]')].map((m) => m.getAttribute('id'));
    expect(ids).toHaveLength(2);
    expect(ids[0]).not.toBe(ids[1]);
  });
});
