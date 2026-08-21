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
// exactly that, so `suggest.ts` and `findplace.ts` are now held to the
// same 100% as the pure half. `data.ts` is tested the same way — see
// `data.test.ts` — but stays excluded, because half of it is the fetch
// hooks and the file cannot reach 100% until those can be rendered.
//
// Which leaves the honest limit: the gate governs about 12% of the app's
// statements. The rest — components and screens — has no test of any kind,
// and every UI fault found in this repository so far was found by eye.
// Coverage says a line ran, not that a test would notice it breaking; that
// is what the mutation passes in the commit log are for. A green gate here
// means the arithmetic and the queries are held, and means nothing at all
// about how any of it looks.
const IMPURE = [
  'src/lib/candidates.ts', // a React hook; imports Alert and Keyboard
  'src/lib/data.ts', // the writes are tested; the fetch hooks need a renderer
  'src/lib/supabase.ts', // the client itself
  'src/lib/testing.ts', // the stand-in for it — test scaffolding, not shipped
  'src/lib/types.ts', // types only, no statements to cover
];

export default defineConfig({
  test: {
    env: { TZ: process.env.TEST_TZ ?? 'Asia/Ho_Chi_Minh' },
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
      include: ['src/lib/*.ts'],
      exclude: ['src/lib/*.test.ts', ...IMPURE],
      // All four at 100, because a threshold at 97 is a number nobody can
      // argue with or about. Either the pure half is covered or it is not.
      thresholds: { statements: 100, branches: 100, functions: 100, lines: 100 },
    },
  },
});
