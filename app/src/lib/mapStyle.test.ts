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
  it('does not paint the night ground as dark as the app behind it', () => {
    const ground = mapStyle('dark').find((r) => !r.featureType && r.elementType === 'geometry');
    expect((ground!.stylers[0] as { color: string }).color).not.toBe('#0A0B0A');
  });
});
