// The part of the Expo config that cannot live in app.json: two secrets.
//
// Expo reads app.json first and hands the result here, so everything
// static stays over there and this file adds only what has to come from
// the environment at build time — the Google Maps SDK keys for iOS and
// Android. They are baked into the native binary, which is why they are
// build-time inputs rather than `EXPO_PUBLIC_*` runtime ones, and why they
// must never be committed: a key in app.json is a key in the repository.
//
// ── where the values come from ──
//
//   eas env:create --scope project --name GOOGLE_MAPS_IOS_KEY     --value … --environment production
//   eas env:create --scope project --name GOOGLE_MAPS_ANDROID_KEY --value … --environment production
//
// (and again for `development` / `preview`, or once with all three.) For a
// local `expo run:ios`, export them in the shell or put them in `app/.env`,
// which is git-ignored.
//
// Each key should be restricted on Google Cloud to this app's bundle id /
// package name and to the Maps SDK for its platform, and nothing else.
// These are a different pair from `GOOGLE_MAPS_API_KEY`, the server key the
// Edge Functions hold: that one calls Places and Geocoding and never ships;
// these two only draw the map and ship with every install.
//
// ── when a key is missing ──
//
// Nothing fails here. `expo start` for Expo Go, `npm test`, and the EAS
// Update publish all evaluate this file without the keys and must keep
// working. An iOS build without its key renders no map in the start sheet
// — `MiniMap` explains why — and the rest of the app is unaffected.

module.exports = ({ config }) => {
  const ios = process.env.GOOGLE_MAPS_IOS_KEY;
  const android = process.env.GOOGLE_MAPS_ANDROID_KEY;
  return {
    ...config,
    ios: {
      ...config.ios,
      ...(ios ? { config: { ...config.ios?.config, googleMapsApiKey: ios } } : {}),
    },
    android: {
      ...config.android,
      ...(android
        ? { config: { ...config.android?.config, googleMaps: { apiKey: android } } }
        : {}),
    },
  };
};
