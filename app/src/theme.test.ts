// The one colour in the system whose value is an argument rather than a
// choice, and the argument is measurable.
//
// Under the test runner `dyn` settles on the dark value (see its note), so
// what these read is the dark theme's — which is also the punishing case:
// a near-black disc thinned over a Google tile, which is always pale
// because `MiniMap` passes no night style.

import { describe, expect, it } from 'vitest';
import { colors } from './theme';

/** `rgba(r,g,b,a)` → the three channels and the alpha. */
function rgba(value: unknown): { rgb: [number, number, number]; alpha: number } {
  const m = /^rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)$/.exec(String(value));
  if (!m) throw new Error(`not an rgba string: ${String(value)}`);
  return { rgb: [Number(m[1]), Number(m[2]), Number(m[3])], alpha: Number(m[4]) };
}

function hex(value: unknown): [number, number, number] {
  const s = String(value);
  return [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16)) as [number, number, number];
}

function luminance([r, g, b]: [number, number, number]): number {
  const lin = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

function contrast(a: [number, number, number], b: [number, number, number]): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** The veil composited over what is behind it. */
function over(veil: ReturnType<typeof rgba>, tile: [number, number, number]): [number, number, number] {
  return veil.rgb.map((c, i) => Math.round(veil.alpha * c + (1 - veil.alpha) * tile[i])) as [number, number, number];
}

/**
 * What a Google tile is, at the five colours it spends most of its area
 * on. Sampled off the map previews this app actually draws, and light in
 * every case: no map in this app asks for the night style except
 * `PlacesMap`, and no floating control sits on that one.
 */
const TILES: Record<string, [number, number, number]> = {
  'white road': [0xFF, 0xFF, 0xFF],
  'pale land': [0xF2, 0xEF, 0xE9],
  'park green': [0xC8, 0xE6, 0xC9],
  water: [0xAA, 0xDA, 0xFF],
  'road casing': [0xBF, 0xBF, 0xBF],
};

describe('bgElevatedVeil', () => {
  it('is the elevated ground thinned, not a wash of its own', () => {
    const veil = rgba(colors.bgElevatedVeil);
    expect(veil.rgb).toEqual(hex(colors.bgElevated));
    expect(veil.alpha).toBeLessThan(1);
  });

  // The whole point of the number. A control that floats over a map has
  // to keep a ground its glyph can stand on; thin it too far and the
  // glyph is reading against the tiles instead, which change at every
  // address. 4.5 rather than the 3:1 a glyph is held to, because these
  // are the one control their cards exist for.
  it('keeps the accent glyph at 4.5:1 over every tile a map puts under it', () => {
    const veil = rgba(colors.bgElevatedVeil);
    const glyph = hex(colors.accent);
    for (const [name, tile] of Object.entries(TILES)) {
      expect(contrast(glyph, over(veil, tile)), `glyph over ${name}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  // It still has to *look* thinned. A veil at 0.99 would pass the test
  // above and be a lie about what the token is for.
  it('lets enough of the map through to read as translucent', () => {
    expect(rgba(colors.bgElevatedVeil).alpha).toBeLessThanOrEqual(0.9);
  });
});
