// The one colour in the system whose value is an argument rather than a
// choice, and the argument is measurable.
//
// Every palette is measured, not only the one the test runner loads: a
// look the runner never wears would otherwise ship unread. The punishing
// case for the veil is a dark ground — a near-black disc thinned over a
// Google tile, which is always pale because `MiniMap` passes no night
// style — but the light looks are held to the same numbers.

import { describe, expect, it } from 'vitest';
import { colors, LOOKS, PALETTES } from './theme';

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

const NAMED = Object.entries(PALETTES);

describe('bgElevatedVeil', () => {
  // One of the palette's own grounds, thinned: the elevated one on paper
  // and on charcoal, the page itself on the coffee brown, whose elevated
  // brown is too light to hold the coral over a white road (see the
  // token's note).
  it.each(NAMED)('is a ground of %s thinned, not a wash of its own', (_, p) => {
    const veil = rgba(p.bgElevatedVeil);
    expect([hex(p.bg), hex(p.bgElevated)]).toContainEqual(veil.rgb);
    expect(veil.alpha).toBeLessThan(1);
  });

  // The whole point of the number. A control that floats over a map has
  // to keep a ground its glyph can stand on; thin it too far and the
  // glyph is reading against the tiles instead, which change at every
  // address. 4.5 rather than the 3:1 a glyph is held to, because these
  // are the one control their cards exist for.
  it.each(NAMED)('keeps the %s accent glyph at 4.5:1 over every tile a map puts under it', (_, p) => {
    const veil = rgba(p.bgElevatedVeil);
    const glyph = hex(p.accent);
    for (const [name, tile] of Object.entries(TILES)) {
      expect(contrast(glyph, over(veil, tile)), `glyph over ${name}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  // It still has to *look* thinned. A veil at 0.99 would pass the test
  // above and be a lie about what the token is for.
  it.each(NAMED)('lets enough of the map through %s to read as translucent', (_, p) => {
    expect(rgba(p.bgElevatedVeil).alpha).toBeLessThanOrEqual(0.9);
  });
});

// The three text steps, on the two grounds they are drawn on — the step
// that went unmeasured until it was found at 3.6:1 was charcoal's third.
describe('text on its grounds', () => {
  it.each(NAMED)('keeps every text step at 4.5:1 or better on %s', (_, p) => {
    for (const g of ['bg', 'bgElevated'] as const) {
      for (const s of ['text', 'textSecondary', 'textTertiary', 'ink', 'accent', 'shutInk'] as const) {
        expect(contrast(hex(p[s]), hex(p[g])), `${s} on ${g}`).toBeGreaterThanOrEqual(4.5);
      }
    }
    // `soon` is drawn on a card's hours line, never on the page, and was
    // measured there (see its note).
    expect(contrast(hex(p.soon), hex(p.bgElevated)), 'soon on bgElevated').toBeGreaterThanOrEqual(4.5);
  });
  // Lifting the third step must not collapse it into the second. Paper is
  // left out, and knowingly: its two steps are 1.31:1 apart and have been
  // since the light theme shipped — they were never lifted, so never at
  // risk of collapsing, and moving them is not this change's to make.
  it.each(NAMED.filter(([n]) => n !== 'paper'))('keeps tertiary visibly quieter than secondary on %s', (_, p) => {
    expect(contrast(hex(p.textSecondary), hex(p.textTertiary))).toBeGreaterThanOrEqual(1.4);
  });
});

// What sits on the accent as a surface. 4.5 because a button's label is
// type: rose is the palette that had to move to white for this, the
// reference's yellow on its rose being 3.9:1.
describe('accentInk', () => {
  it.each(NAMED)('reads at 4.5:1 or better on every %s accent fill', (_, p) => {
    for (const fill of [p.accentFill, ...p.gradAI]) {
      expect(contrast(hex(p.accentInk), hex(fill)), fill).toBeGreaterThanOrEqual(4.5);
    }
  });
});

// The visited pill's pair; and the delete well's, its counterpart.
describe('okInk and bad', () => {
  it.each(NAMED)('read at 4.5:1 or better on their wells in %s', (_, p) => {
    expect(contrast(hex(p.okInk), hex(p.okSoft))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(hex(p.bad), hex(p.badSoft))).toBeGreaterThanOrEqual(3);
  });
});

describe('looks', () => {
  // The standard look is the only one that is two palettes, and so the
  // only one that puts a `dyn` pair anywhere; the borders test reads it.
  it('pairs paper with charcoal, and wears coffee and rose on both sides', () => {
    expect(LOOKS.standard).toEqual({ light: PALETTES.paper, dark: PALETTES.charcoal });
    expect(LOOKS.coffee.light).toBe(LOOKS.coffee.dark);
    expect(LOOKS.rose.light).toBe(LOOKS.rose.dark);
  });

  // The runner has no `Settings`, so it loads the standard look, and `dyn`
  // settles on its dark side: what every UI test reads is charcoal.
  it('loads the standard look where nothing is stored', () => {
    expect(colors.bg).toBe(PALETTES.charcoal.bg);
    expect(colors.accentLine).toBe(PALETTES.paper.accentLine);
  });
});
