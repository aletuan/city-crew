// The one file that touches `react-native-maps`.
//
// Native code that may be absent from the binary, so each export is a
// `require` in a try/catch — the pattern MiniMap keeps for itself. Gathered
// here for a second reason: under vite-node a `require` goes through Node's
// own loader and never sees `vi.mock`, so a test cannot stand in for
// `react-native-maps` — but it can stand in for this module, by its path.
// `no-explicit-any` is not enabled in this repo's eslint config, and an
// unused disable directive is itself an error here — so only the one rule
// these lines actually trip is switched off.
/* eslint-disable @typescript-eslint/no-require-imports */
export const MapView: any = (() => {
  try { return require('react-native-maps').default ?? null; } catch { return null; }
})();
export const Marker: any = (() => {
  try { return require('react-native-maps').Marker ?? null; } catch { return null; }
})();
export const PROVIDER_GOOGLE: string | null = (() => {
  try { return require('react-native-maps').PROVIDER_GOOGLE ?? null; } catch { return null; }
})();
