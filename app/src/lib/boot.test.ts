// The one line in the app whose failure mode is a screen that never
// changes. Every branch of it, because the expensive one is the branch that
// keeps waiting.

import { describe, expect, it } from 'vitest';
import { holdingFirstFrame } from './boot';

const state = (over: Partial<Parameters<typeof holdingFirstFrame>[0]> = {}) => ({
  fontsLoaded: false, fontsFailed: false, themeReady: false, ...over,
});

describe('holdingFirstFrame', () => {
  it('holds at launch, before anything has answered', () => {
    expect(holdingFirstFrame(state())).toBe(true);
  });

  it('lifts once both the theme and the faces are in', () => {
    expect(holdingFirstFrame(state({ themeReady: true, fontsLoaded: true }))).toBe(false);
  });

  it('keeps holding while the faces are still coming', () => {
    expect(holdingFirstFrame(state({ themeReady: true }))).toBe(true);
  });

  // The bug this function was extracted for: the app read only `loaded` and
  // waited forever on a font that was never going to arrive.
  it('goes on without the faces when they have failed', () => {
    expect(holdingFirstFrame(state({ themeReady: true, fontsFailed: true }))).toBe(false);
  });

  // The theme is not optional in the same way: it is a local read that
  // always settles, and the wrong ground on the first frame is the whole
  // thing the hold is for. A font failure does not license showing it.
  it('still waits for the theme even when the faces have failed', () => {
    expect(holdingFirstFrame(state({ fontsFailed: true }))).toBe(true);
  });

  it('still waits for the theme even when the faces are in', () => {
    expect(holdingFirstFrame(state({ fontsLoaded: true }))).toBe(true);
  });

  // Both answers at once should not be possible, and if it happens the
  // loaded one is the one that matters — the faces are usable.
  it('lifts when the faces both loaded and reported a fault', () => {
    expect(holdingFirstFrame(state({
      themeReady: true, fontsLoaded: true, fontsFailed: true,
    }))).toBe(false);
  });
});
