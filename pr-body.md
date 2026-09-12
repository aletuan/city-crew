## Summary

The start sheet ("Where should it start?") searched OpenStreetMap because the map under it was Apple's, and the Google Places terms (§5.3) keep Places content off a non-Google map. The app now ships as its own binary (EAS Build → TestFlight), which can bundle the Google Maps SDK. So the map becomes Google's, and the search and the caption under the map come from Google too.

## Changes

- **`app/app.config.js`** (new): reads `app.json` and injects `ios.config.googleMapsApiKey` / `android.config.googleMaps.apiKey` from `GOOGLE_MAPS_IOS_KEY` / `GOOGLE_MAPS_ANDROID_KEY` at build time. Without the variables the config is unchanged, so Expo Go, tests and EAS Update keep working.
- **`MiniMap`**: `provider` is Google on both platforms. `canDrawMap` refuses to render in Expo Go on iOS and in a build made without the key, instead of crashing.
- **`fetch-place`**: `search` takes an optional `at` point to bias towards (20 km circle) and a `lang`; new `reverse` action names a point via the Geocoding API. The parser lives in `geocode.ts` (pure) and is tested from Node.
- **`findplace` / `spots`**: shape Google candidates instead of OSM rows; `nameOf` replaces the platform reverse geocoder.
- **`StartSheet`**: searches Google, captions from Google, OSM credit line removed.
- **Removed**: `supabase/functions/find-address` (Photon + Nominatim) and its parser tests.
- **Docs**: README (EAS build, key setup, Expo Go caveat), tech-eval C2/C3, store privacy-label and review notes flag the old "No Google Maps SDK is bundled" statement as out of date.
- `expo-constants` added as a direct dependency (SDK 57 version).

## Checks

- `npm run typecheck` ✅
- `npm run lint` ✅ (max-warnings 0)
- `npm test` ✅ 1826 tests
- `npm run coverage` ✅ 100 % gate

## Follow-ups outside this PR

1. Create two Google Cloud keys (Maps SDK for iOS / Android), restricted to `com.aletuan.citycrew`, and store them as EAS env `GOOGLE_MAPS_IOS_KEY` / `GOOGLE_MAPS_ANDROID_KEY`.
2. Enable **Geocoding API** on the server key `GOOGLE_MAPS_API_KEY`, then `supabase functions deploy fetch-place`.
3. `supabase functions delete find-address` — removing it from the repo does not undeploy it.
4. Build a development client and verify the map on a real iPhone; native rendering could not be exercised in this session.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_0173RhrvC7XRbsWK1BenkCKq
