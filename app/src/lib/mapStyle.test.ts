import { describe, expect, it } from 'vitest';
import { MAP_STYLE } from './mapStyle';

describe('MAP_STYLE', () => {
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
});
