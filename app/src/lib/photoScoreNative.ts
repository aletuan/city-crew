// The one file that reaches the photo-scoring module (`modules/photo-score`).
//
// Absent more often than present, and every absence is ordinary:
//
// - Expo Go and the web, which carry no module of ours;
// - every binary built before the module existed. `runtimeVersion` is
//   `sdkVersion`, so an EAS Update reaches those binaries too, and this
//   code runs on phones whose native side has never heard of it;
// - Android, where the module has no implementation;
// - iOS 16.4 to 17, where the module is there and Vision's aesthetics
//   request is not (`isAvailable()` answers that one).
//
// So it is looked up optionally and every one of those reads as `null`,
// which the gallery takes to mean "no button". A `require` in a
// try/catch, as `components/mapsModule.ts` does for the map, for the
// same second reason: under vite-node a `require` never sees `vi.mock`,
// so a test stands in for this file by its path rather than for `expo`,
// whose modules core will not even import under jsdom.

import type { PhotoScorer, Reading } from './photoScore';
import { appleVision } from './photoScoreVision';

/** The native module's own shape — Expo's names, not the app's. */
type VisionModule = {
  isAvailable(): boolean;
  scoreAsync(uri: string): Promise<Reading>;
};

/**
 * Apple Vision as a `PhotoScorer`: the module's reading, under the name
 * and version the registry gives it, so the row it leaves says who read
 * it. The module's own name (`PhotoScore`) stays as the binary has it;
 * renaming it would orphan every build already on a phone.
 */
/* eslint-disable @typescript-eslint/no-require-imports */
export const photoScorer: PhotoScorer | null = (() => {
  try {
    const mod = require('expo').requireOptionalNativeModule('PhotoScore') as VisionModule | null;
    if (!mod?.isAvailable()) return null;
    return { id: appleVision.id, version: appleVision.version, read: (uri) => mod.scoreAsync(uri) };
  } catch {
    return null;
  }
})();
