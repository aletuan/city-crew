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
// The 100% gate covers `src/lib/*.ts` and nothing else (the screens have
// a floor of their own, below), and the exclusions
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
// for what that substitution is worth. They are kept off the 100% threshold
// on purpose. A number over a screen would have to be met, and the cheapest
// way to meet it is to render the thing and assert nothing, which is worse
// than no number because it reads like one. The files that exist were
// written to pin behaviour somebody could otherwise break silently, and
// the next one should be written for the same reason rather than to move a
// percentage.
//
// So: coverage says a line ran, not that a test would notice it breaking —
// that is what the mutation passes in the commit log are for. A green gate
// here means the arithmetic and the queries are held. It still says nothing
// about how any of it looks, and neither do the UI tests: layout is not
// simulated and no assertion in this repository has ever seen a pixel.
// ── the screens floor ──
//
// The argument above against a number over the screens still holds for a
// *target*: a percentage somebody must reach gets reached by rendering and
// asserting nothing. This is the other kind — a ratchet. It only says the
// screens may not lose the tests they have: delete a `*.ui.test.tsx`, or
// grow a screen by a few hundred untested lines, and the gate goes red.
// Nothing here asks for more.
//
// Raise it by hand, in the same change, whenever screen tests are added —
// run `npm run coverage`, take the lowest screen's figures, round down to
// the whole number. Never lower it to make a change pass; a screen that
// got bigger gets a test instead. It was 13% of lines before the five
// main screens (Explore, Search, TripDetail, PlanEdit, Crew) were tested,
// 44% after, 75% once Collections, CollectionDetail, Profile, PlaceDetail
// and PlanOptions joined them, and 95% when the last six at zero —
// Activity, AddPlace, EditProfile, Ideas, Sketching, TripInvitation — did.
//
// ── per file, not on average ──
//
// The floor held over the *aggregate* of `src/screens` for its first
// months, and an average is a floor with a hole in it. Twenty-two screens
// at 96–100% carried `TripsScreen.tsx` at 41.75% lines and one test for
// half a year without the gate noticing, and a new screen with no test at
// all would pass the same way as long as it was small next to the rest.
// `perFile` closes that: every screen has to clear the number on its own.
//
// The numbers are the lowest screen's, not the average's, and switching
// the floor to per-file is what showed which screen that was. Three sat
// well under the old aggregate and had been hiding there: at the switch,
// `CollectionFormScreen` stood at 82.69% lines / 70.96% branches / 60%
// functions, `ForgotPasswordScreen` at 85.8 / 81.81 / 44.44, and
// `DeleteAccountScreen` at 88.23% branches, and the floor was theirs —
// 82 / 82 / 70 / 44. All three stand at 100 in every column now (the
// rename, the copy and the daily cap; the recovery code, the countdown
// and the resend; the account with no handle and the stack with nothing
// under it), which moved the floor up to the next-lowest screen.
//
// That was `SignUpScreen`, alone at the bottom of all four columns at
// 95.49 / 89.06 / 61.9 — the form's six checks in field order, the code
// step and whose account the taste is written to had no test. It stands
// at 100 in every column now, and the floor's numbers come from the
// screens each lowest in their own column: `ExploreScreen` at 96.96%
// lines and statements and 81.25% functions, `IdeasScreen` at 90.41%
// branches. Rounded down, as ever.
//
// `TripDetailScreen` held the functions column at exactly 80 for a
// while — three handlers no test could reach in jsdom (the gallery's
// layout and its swipe, the header's back) — until its test stood the
// pager in and gave react-native-web a ResizeObserver to measure with.
// It stands at 100 now.
//
// `ExploreScreen` rose after that — 99.89% lines, 92.85% functions — and
// the floor did not rise with it, which left three points of room for a
// screen to lose tests in with CI still green. Caught on 28 September and
// raised to the truth: every column was `IdeasScreen`'s, at 98.24% lines
// and statements, 90.41% branches and 84.21% functions — its date
// picker's ways out (the scrim, Done, Android's back) had no test. They
// do now, and it stands at 100 in three columns and 93.58 in branches.
//
// Which hands each column to a different screen: `SearchScreen` at
// 99.29% lines and statements, `CrewScreen` at 91.89% branches,
// `GalleryScreen` at 91.3% functions.
const SCREENS_FLOOR = { lines: 99, statements: 99, branches: 91, functions: 91 };

// ── the components' floor ──
//
// Forty-seven files under `src/components`, and until #623 no number
// over any of them: the gate's `include` did not name the directory, so
// the report never printed a row, and a sheet with no test of its own
// could be covered end to end by the screen tests that open it — or not
// at all — and the two looked identical from outside.
//
// The first reading (#623) said which: 75.31% of lines across the
// directory, twenty-one files at or near 100, and seven at zero that no
// test had ever rendered, because every screen that mounts them stands
// them in with a stub: `AvatarPicker`, `EngagementRing`, `FloatingTabBar`,
// `MiniMap`, `StartSheet`, `TripCrew`, `reportFlow`, with `tabBarDuck` at
// 24 and `TastePicker` at 72. Eight of the nine have their own tests now
// and stand at or near 100 in every column. The ninth is excluded below,
// by name and for a reason that is not "it has no test".
//
// So the directory carries the same per-file floor the screens do, at
// today's truth rounded down, and each number is one file's. It was
// `AddBatchBar` at 94.39% lines and statements and 92.59% branches; that
// file rose to 98.87 / 96.15 and the floor stayed, until 28 September.
// Now: `WelcomeSheet` at 95.76% lines and statements, `SaveSheet` and
// `SketchDeck` at 93.75% branches, `ExploreFilterSheet` at 90.9%
// functions.
//
// The branches column started at 60, which was `InviteCard`'s — every
// fallback on that card (a day it could not read, a stop with no place,
// an asker with no name, the credit switch) had gone unexercised — with
// `PricePill` next at 71.42 for a `compact` form nothing calls and a
// price nobody knows, and `InviteSheet` at 84.48 for the seat rule a
// couple's evening imposes and the rows the crew copy had not loaded.
// All three stand at 100 now; `SaveSheet` and `SketchDeck` (93.75) hold
// that column, with `LegalSheet` (94.44) next.
const COMPONENTS_FLOOR = { lines: 95, statements: 95, branches: 93, functions: 90 };

// The one component the gate does not hold, for the same reason `IMPURE`
// exists: it cannot run where the tests run. `MiniMap` IS the native map
// — three guarded `require('react-native-maps')` calls, a platform gate
// read off `expo-constants`, and the view — and under jsdom the module
// will not even import: `expo-constants` pulls `expo-modules-core`, which
// reads an `EventEmitter` off a global that only the Expo runtime sets.
// Every test that mounts a screen holding it stands it in (`PlacesMap`,
// `PlaceDetailScreen`, `ExploreScreen`, `StartSheet`), and a test of the
// real one could only ever watch it render `null`. `mapsModule.ts`, the
// same three requires for `PlacesMap`, is outside the `*.tsx` include
// for the same reason.
const NATIVE_ONLY = [
  'src/components/MiniMap.tsx',
];

const IMPURE = [
  // A React hook, imports Alert and Keyboard — and since 9 October fully
  // rendered by `candidates.ui.test.tsx`, at 100% of lines and functions
  // and 98.63% of branches. The one branch left is `suggestOne`'s
  // `if (!city)`, which only `addMany` calls, after the same check: it is
  // there to narrow the type, and no reader can reach it. Passing
  // `city.id` in would remove it; that is a change to the hook, not a
  // test, so it waits for its own commit rather than riding in on one.
  'src/lib/candidates.ts',
  'src/lib/database.types.ts', // generated from the schema; one runtime const, no logic
  'src/lib/channel.ts', // reads expo-updates; two consts, no logic to hold
  'src/lib/reminders.ts', // talks to expo-notifications; the maths it uses is remind.ts, which the gate holds
  'src/lib/data/fetch.ts', // the hook every query is driven by; needs a renderer
  'src/lib/data/hooks.ts', // and the wrappers around it, for the same reason
  'src/lib/data/index.ts', // the barrel: re-exports and nothing else
  'src/lib/supabase.ts', // the client itself
  'src/lib/testing.ts', // the stand-in for it — test scaffolding, not shipped
  'src/lib/types.ts', // types only, no statements to cover
];

// ── the providers' floor ──
//
// `src/lib/*.tsx` had no number at all until 9 October: the contexts sit
// outside the `*.ts` gate, and a provider could ship untested with
// nothing turning red. `i18n.tsx` was the case in point — every string
// the reader sees passes through its `t`, and its fallbacks for a missing
// translation stood at 61% of branches with no test of its own.
//
// Lines and branches only. The functions column reads 30–66% on files
// whose every line runs, because it counts the no-op defaults each
// `createContext` is given for a tree with no provider above it; a floor
// there would ask for tests of code no reader can reach. Today's truth,
// rounded down, each column one file's: `catalog.tsx` at 97.6% lines,
// `invitations.tsx` at 89.18% branches.
//
// That second figure was first written down as 86.11, and CI read 82.85
// on the same code. `invitations.tsx` drops an answer that lands after a
// newer ask, and whether any test reached that guard was left to timing:
// two local runs in four went each way. A floor over a number that moves
// on its own is a coin toss, so the guard got two tests that hold each
// ask open and let them go in order, and the figure stopped moving —
// three full runs since, identical in every provider and function file.
const PROVIDERS_FLOOR = { lines: 97, branches: 89 };

// ── the Edge Functions' floor ──
//
// They run on Deno, but every one that has a test is loaded unchanged by
// a `*.fn.test.ts` here, so this run measures them. Until 9 October it did
// not report them: the note below on `include` explains the one setting
// that made the difference. The first reading then showed six functions
// with no test of any kind, among them `fetch-place` — the one any
// signed-in phone can make spend Google money — and `prune-photos`, which
// deletes from Storage. Each has one now.
//
// v8 only reports a file something imported, so a function no test loads
// is absent from this report rather than at zero, and no floor here can
// see it. `scripts/edgeFunctionTests.test.ts` holds that side.
//
// The same ratchet as the screens. `classify.ts` holds branches at 94.11;
// `plan-assist/index.ts` holds functions at 66.66, and the reason is one
// helper, `un`, that nothing in the file has called since it was written
// (a6a86ce39). Deleting it lifts the column to 100 — a change to the
// function, so not made here.
const FUNCTIONS_FLOOR = { lines: 100, statements: 100, branches: 94, functions: 66 };

// Coverage globs as v8 reports paths once `allowExternal` is on: by where
// the file is, not relative to `app/`. A relative `include` then matches
// nothing and the report is empty — "Unknown% (0/0)", and a green run.
// The `thresholds` keys below stay relative: they are matched against the
// report's own names, which are, and the `**/app/…` form there matched
// nothing either and turned every floor off without a word. Both were
// measured by setting a floor no file can meet and watching for the error.
const at = (p: string) => (p.startsWith('../') ? `**/${p.slice(3)}` : `**/app/${p}`);

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
      // `src/lib/*.tsx` and the Edge Functions carry floors of their own —
      // see "the providers' floor" and "the Edge Functions' floor" above.
      //
      // `supabase/functions` used to be knowingly outside: `include:
      // ['../supabase/…']` matched nothing and reported a confident 100% of
      // the files it did find, and re-rooting the gate at the repository
      // took every other file to zero. `allowExternal` is what was missing —
      // without it v8 drops every file outside `app/` before `include` is
      // read. It changes how paths are matched, which is what `at` is for.
      // `src/components` carries its own floor — see "the components'
      // floor" above.
      allowExternal: true,
      include: ['src/lib/*.ts', 'src/lib/data/*.ts', 'src/screens/*.tsx', 'src/components/*.tsx', 'src/lib/*.tsx', '../supabase/functions/*/*.ts'].map(at),
      exclude: ['src/**/*.test.ts', 'src/**/*.test.tsx', ...IMPURE, ...NATIVE_ONLY].map(at),
      thresholds: {
        // Each file on its own — see "per file, not on average" above. The
        // pure half was already there in practice, since 100% of an
        // aggregate is 100% of every file; the screens floor is what this
        // changes.
        perFile: true,
        // All four at 100, because a threshold at 97 is a number nobody can
        // argue with or about. Either the pure half is covered or it is not.
        'src/lib/**/*.ts': { statements: 100, branches: 100, functions: 100, lines: 100 },
        // A floor, not a target: the figures the screens stood at when their
        // tests last grew, rounded down. See "the screens floor" above.
        'src/screens/*.tsx': SCREENS_FLOOR,
        // The same shape for the components — see "the components' floor".
        'src/components/*.tsx': COMPONENTS_FLOOR,
        // The contexts — see "the providers' floor".
        'src/lib/*.tsx': PROVIDERS_FLOOR,
        // `_shared/*.ts` and every function's own files — see "the Edge
        // Functions' floor".
        '../supabase/functions/*/*.ts': FUNCTIONS_FLOOR,
      },
    },
  },
});
