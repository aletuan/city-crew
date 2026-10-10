import { bgHex, PALETTES } from '../theme';
import { describe, expect, it } from 'vitest';
import { mapStyle } from './mapStyle';

describe('mapStyle', () => {
  const MAP_STYLE = mapStyle('light');

  // The badge is what duplicates our pin. Its name goes with it, which
  // the SDK gives no way around — see the note in the file.
  it('turns off the badge on a place of interest', () => {
    const icons = MAP_STYLE.filter((r) => r.featureType === 'poi' && r.elementType === 'labels.icon');
    expect(icons).toHaveLength(1);
    expect(icons[0].stylers).toEqual([{ visibility: 'off' }]);
  });

  // A rule that changes nothing on the device is a rule that misleads
  // the next reader: one was tried, proved to be a no-op, and removed.
  it('carries no rule that the SDK ignores', () => {
    expect(MAP_STYLE.some((r) => r.elementType === 'labels.text')).toBe(false);
  });

  // A station is wayfinding and never one of our places, so its icon can
  // never be a duplicate — and it earns its keep.
  it('leaves transit alone', () => {
    expect(MAP_STYLE.some((r) => r.featureType?.startsWith('transit'))).toBe(false);
  });

  // Google has no dark mode to turn on; a night map is a style, and this
  // one is the app's own palette rather than Google's sample.
  it('paints the night reading only when the reader asked for it', () => {
    const night = mapStyle('dark');
    const ground = night.find((r) => !r.featureType && r.elementType === 'geometry');
    expect(ground).toBeTruthy();
    expect(mapStyle('light').some((r) => r.elementType === 'geometry')).toBe(false);
  });

  // Whichever reading, the badge that duplicates our pin stays off.
  it('keeps the badge off in both readings', () => {
    for (const scheme of ['dark', 'light'] as const) {
      expect(mapStyle(scheme).some((r) => r.featureType === 'poi' && r.elementType === 'labels.icon')).toBe(true);
    }
  });

  // The night ground is lifted off the app's own background on purpose:
  // the pins are Google's marker art and come out dark.
  // Lighter, not merely different: a ground a hair darker than the page
  // would pass "not equal" and swallow the pins all the same.
  it('paints the night ground lighter than the app behind it', () => {
    const ground = mapStyle('dark').find((r) => !r.featureType && r.elementType === 'geometry');
    const lum = (h: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
        .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    expect(lum((ground!.stylers[0] as { color: string }).color)).toBeGreaterThan(lum(bgHex.dark));
    // And the Coffee look's own night, over its own brown page.
    const brown = mapStyle('dark', 'coffee').find((r) => !r.featureType && r.elementType === 'geometry');
    expect(lum((brown!.stylers[0] as { color: string }).color)).toBeGreaterThan(lum(PALETTES.coffee.bg));
  });

  // Each dark look draws its night in its own family: charcoal's greys
  // under the standard look, the brown under Coffee. Rose is a day look.
  it('paints each look\u2019s night in its own palette', () => {
    const ground = (look?: 'standard' | 'coffee' | 'rose') =>
      (mapStyle('dark', look).find((r) => !r.featureType && r.elementType === 'geometry')!.stylers[0] as { color: string }).color;
    expect(ground()).toBe('#1C1A15');
    expect(ground('standard')).toBe('#1C1A15');
    expect(ground('coffee')).toBe('#3A2A1F');
    expect(mapStyle('light', 'rose')).toEqual(mapStyle('light'));
  });
});
