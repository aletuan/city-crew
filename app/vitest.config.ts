import { defineConfig } from 'vitest/config';

// The tests run on Hanoi time, and that is a correctness setting rather
// than a cosmetic one.
//
// Half the date bugs this app can have are invisible at UTC+0. `toISO`
// exists because `toISOString()` converts to UTC first, so east of
// Greenwich the early hours report the day before — and a test for exactly
// that passed under UTC and only failed under Asia/Ho_Chi_Minh. CI runs on
// GitHub's runners, which are UTC, so without this line the test would
// have been decorative: green in CI, green locally, and the bug shipping
// to every reader in Vietnam before 07:00.
//
// It is also simply the truth about who uses this. A test suite that
// asserts Vietnamese behaviour should run on a Vietnamese clock.
// `TEST_TZ` rather than `TZ`, because `env` here *overrides* the shell —
// so a second run started with `TZ=...` would silently get Hanoi anyway.
// That is not hypothetical: it happened while this was being written, and
// a whole second timezone pass appeared to run and did not.
//
// The second pass is `npm run test:tz`. Vietnam has no daylight saving, so
// the Hanoi run structurally cannot catch a DST bug — and the app's
// readers include the person in New York planning a week in Hanoi.
export default defineConfig({
  test: {
    env: { TZ: process.env.TEST_TZ ?? 'Asia/Ho_Chi_Minh' },
  },
});
