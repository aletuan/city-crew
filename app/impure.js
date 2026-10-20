// The `src/lib/**/*.ts` files that are not pure, each with the reason.
//
// Read by two gates that must agree, which is why it is a file of its own:
// `vitest.config.ts` leaves these out of the 100% coverage gate, and
// `eslint.config.js` lets them import what every other `lib/*.ts` may not
// — React, React Native, the Supabase client. Until 20 Oct 2026 the list
// lived in the coverage config alone and lint held no rule over `lib/*.ts`
// at all; a second copy would have been two lists free to drift, and the
// first file to sit on one and not the other would have been held by one
// gate and waved through by the next.
//
// CommonJS, because the ESLint config is and `require`s it without a
// build step; `vitest.config.ts` imports it through `allowJs`.
//
// Paths relative to `app/`, as both configs write them.

const IMPURE = [
  'src/lib/database.types.ts', // generated from the schema; one runtime const, no logic
  'src/lib/channel.ts', // reads expo-updates; two consts, no logic to hold
  'src/lib/reminders.ts', // talks to expo-notifications; the maths it uses is remind.ts, which the gate holds
  'src/lib/askReview.ts', // reads AsyncStorage and the native review sheet; the rules it applies are review.ts, which the gate holds
  'src/lib/photoScoreNative.ts', // looks up the Vision module, absent everywhere a test runs; what it reads is photoScore.ts, which the gate holds
  'src/lib/data/fetch.ts', // the hook every query is driven by; needs a renderer
  'src/lib/data/hooks.ts', // and the wrappers around it, for the same reason
  'src/lib/data/index.ts', // the barrel: re-exports and nothing else
  'src/lib/supabase.ts', // the client itself
  'src/lib/testing.ts', // the stand-in for it — test scaffolding, not shipped
  'src/lib/types.ts', // types only, no statements to cover
];

module.exports = { IMPURE };
