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

// ── what the coverage gate is for ──
//
// Not for measuring what exists. Every pure module is already at 100%, and
// knowing that changes nothing. It is there to stop that eroding: add a
// function to `src/lib` without a test and the next run goes red, which is
// the only mechanism in this repository that does not rely on whoever is
// writing remembering to.
//
// The gate covers `src/lib/*.ts` and nothing else, and the exclusions
// below are not a convenience — each of those files needs React at import
// time or at call time, and a Node process has no renderer. That boundary
// is the reason `place.ts` exists as a separate file; see the note at the
// top of it.
//
// It used to include everything that touched Supabase, which was one step
// too far. Reaching for the network is not the same problem as reaching
// for a renderer: a client can be stood in for, and `lib/testing.ts` does
// exactly that, so `suggest.ts` and `findplace.ts` are held to the same
// 100% as the pure half.
//
// `data.ts` was the one file that stayed out on a technicality — it was
// tested the same way, but half of it was fetch hooks and no whole-file
// threshold could be met while that was true. It is a directory now, split
// along exactly that seam: `data/fetch.ts` and `data/hooks.ts` are the
// React half and are excluded below; the five modules holding the queries
// and the writes are in, at 100%. That took the read side from 14 of its
// 59 functions tested to all of them — the friendships, blocks, reports and
// catalog reads had no test of any kind before.
//
// Which leaves the honest limit: the gate governs about a fifth of the
// app's statements, and it is deliberately not extended over the rest.
//
// Components and screens are no longer untested — `*.ui.test.tsx` renders
// them through `react-native-web` into jsdom; see `src/uitest/setup.tsx`
// for what that substitution is worth. They are kept off the threshold on
// purpose. A number over a screen would have to be met, and the cheapest
// way to meet it is to render the thing and assert nothing, which is worse
// than no number because it reads like one. The four files that exist were
// written to pin behaviour somebody could otherwise break silently, and
// the next one should be written for the same reason rather than to move a
// percentage.
//
// So: coverage says a line ran, not that a test would notice it breaking —
// that is what the mutation passes in the commit log are for. A green gate
// here means the arithmetic and the queries are held. It still says nothing
// about how any of it looks, and neither do the UI tests: layout is not
// simulated and no assertion in this repository has ever seen a pixel.
const IMPURE = [
  'src/lib/candidates.ts', // a React hook; imports Alert and Keyboard
  'src/lib/channel.ts', // reads expo-updates; two consts, no logic to hold
  'src/lib/reminders.ts', // talks to expo-notifications; the maths it uses is remind.ts, which the gate holds
  'src/lib/data/fetch.ts', // the hook every query is driven by; needs a renderer
  'src/lib/data/hooks.ts', // and the wrappers around it, for the same reason
  'src/lib/data/index.ts', // the barrel: re-exports and nothing else
  'src/lib/supabase.ts', // the client itself
  'src/lib/testing.ts', // the stand-in for it — test scaffolding, not shipped
  'src/lib/types.ts', // types only, no statements to cover
];

export default defineConfig({
  // React Native's own source is Flow, which nothing in this toolchain can
  // parse. `react-native-web` is the same translation Expo's web target
  // uses, and it is what lets a screen render into jsdom — see
  // `src/uitest/setup.tsx` for what that substitution is and is not worth.
  //
  // Aliased for every test rather than only the UI ones, because a pure
  // module has no `react-native` import to redirect: the alias is a no-op
  // where it does not apply.
  resolve: { alias: { 'react-native': 'react-native-web' } },
  test: {
    env: { TZ: process.env.TEST_TZ ?? 'Asia/Ho_Chi_Minh' },
    // The native modules a tree needs stubbed before it can mount. Loaded
    // for every file: it registers lazy `vi.mock` factories and nothing
    // else, so a test that imports none of them pays nothing.
    setupFiles: ['src/uitest/setup.tsx'],
    coverage: {
      provider: 'v8',
      // `*.ts` only: every `.tsx` in `src/lib` is a React context.
      //
      // One pure module is knowingly outside this gate:
      // `supabase/functions/_shared/classify.ts`. It runs inside an Edge
      // Function so it lives with the function, and `classify.test.ts`
      // exercises it here — 18 cases, including loops over every row of its
      // lookup table. Two ways of pulling it under the threshold were tried
      // and both were worse: `include: ['../supabase/…']` matches nothing
      // and reports a confident 100% of the files it did find, and
      // re-rooting the whole gate at the repository took every other file
      // to zero. Naming the exception is better than contorting the gate
      // for one file, or than a silent hole that reads as coverage.
      include: ['src/lib/*.ts', 'src/lib/data/*.ts'],
      exclude: ['src/lib/*.test.ts', 'src/lib/data/*.test.ts', ...IMPURE],
      // All four at 100, because a threshold at 97 is a number nobody can
      // argue with or about. Either the pure half is covered or it is not.
      thresholds: { statements: 100, branches: 100, functions: 100, lines: 100 },
    },
  },
});
