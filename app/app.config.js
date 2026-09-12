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
// ── how the keys reach the binary ──
//
// Through react-native-maps' own config plugin, listed below with the two
// keys as its props. That plugin writes `pod 'react-native-maps/Google'`
// into the Podfile, `GMSServices.provideAPIKey` into the AppDelegate and
// the `geo.API_KEY` meta-data into the Android manifest. Setting the keys
// only in `ios.config.googleMapsApiKey` / `android.config.googleMaps`
// looks equivalent and is not: with nothing in `plugins`, Expo falls back
// to its own legacy maps plugin, which still writes
// `pod 'react-native-google-maps'` — a podspec react-native-maps dropped
// in favour of the `Google` subspec — and `pod install` fails on EAS.
// Listing the package plugin is what makes Expo skip that fallback.
//
// `ios.config.googleMapsApiKey` is still set here too, but only because
// some other Expo/native tooling expects it next to `ios.config` — it is
// NOT how the running app learns whether a key was baked in. Expo's own
// `getConfig` unconditionally deletes `ios.config` and `android.config`
// when producing the *public* manifest — the one `expo-constants` embeds
// in the binary and hands back at runtime as `Constants.expoConfig`. So
// `Constants.expoConfig?.ios?.config?.googleMapsApiKey` is `undefined` in
// every build, keyed or not; a runtime check must not use it (see the
// `extra.hasGoogleMapsIosKey` flag below, and MiniMap.tsx, which learned
// this the hard way — TestFlight builds since #525 silently drew no map
// because of exactly this).
//
// ── when a key is missing ──
//
// Nothing fails here. `expo start` for Expo Go, `npm test`, and the EAS
// Update publish all evaluate this file without the keys and must keep
// working: the plugin gets undefined props and configures Apple maps only.
// An iOS build without its key renders no map in the start sheet —
// `MiniMap` explains why — and the rest of the app is unaffected.

module.exports = ({ config }) => {
  const ios = process.env.GOOGLE_MAPS_IOS_KEY;
  const android = process.env.GOOGLE_MAPS_ANDROID_KEY;
  return {
    ...config,
    ios: {
      ...config.ios,
      ...(ios ? { config: { ...config.ios?.config, googleMapsApiKey: ios } } : {}),
    },
    extra: {
      ...config.extra,
      // The one reader that matters at runtime: MiniMap checks this to
      // decide whether it can ask for the Google map provider on iOS.
      // Unlike `ios.config`, `extra` survives into the public manifest.
      hasGoogleMapsIosKey: !!ios,
    },
    plugins: [
      ...(config.plugins ?? []),
      ['react-native-maps', { iosGoogleMapsApiKey: ios, androidGoogleMapsApiKey: android }],
    ],
  };
};
