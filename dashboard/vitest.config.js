// The desk's component tests: React rendered into jsdom and driven.
//
// `node --test` still runs the plain modules (see package.json `test` and
// tests/README.md) — those import nothing that needs a renderer and there
// is no reason to move them. What it could never run is anything under
// `src/components/`, `App.jsx` or `auth.jsx`: JSX with no loader, hooks
// with no React, and the README that sat beside them said so for months
// ("everything in src/components/ is untested"). This is the harness that
// note was asking for.
//
// Vitest rather than a second Node runner, because the app already does
// exactly this (app/vitest.config.ts) and a second way of doing the same
// thing in one repository is a second thing to learn. The React plugin is
// the same one the Vite build uses, so a component is compiled here the
// way it is compiled for the page.
//
// ── what the gate is for ──
//
// A floor, not a target — the same shape as the app's screens floor. The
// numbers are the lowest file's in each column, rounded down, and they
// exist so a component cannot quietly lose its test or grow a few hundred
// untested lines. Raise them by hand, in the same change, when the tests
// grow; never lower them to make a change pass.
//
// Per file, because an average is a floor with a hole in it: one screen at
// zero can hide behind nine at a hundred.
//
// The first reading, the day the harness landed: every file at or above
// 98% of lines, and each column's floor is one file's. `CityHero` holds
// lines and statements at 98.98 — the three lines are the credit check
// inside `upload`, which the disabled drop zone stops a test from
// reaching the way it stops a reader. `AddPlace` holds branches at 90.
//
// Functions moved, and the reason is worth keeping. `App` held them at
// 89.65 on three uncovered functions: the no-op defaults its contexts
// carry for a screen mounted outside the shell, and the overflow link's
// own close. Removing the Sync button took a *covered* function out and
// pushed the file under the floor with no test changed — the arithmetic
// this file's own doctrine warns about. The link's close is covered now,
// so `App` sits at 92.59 and `CityHero` holds functions at 90.9: its
// `beforeunload` guard, which jsdom never fires on its own, and the same
// disabled drop zone that already holds the lines column.
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const FLOOR = { lines: 98, statements: 98, branches: 90, functions: 90 };

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.ui.test.jsx'],
    // Stands in for Supabase and the API, stubs what jsdom lacks, and
    // unmounts between tests. Every UI test file gets it.
    setupFiles: ['tests/_ui/setup.jsx'],
    coverage: {
      provider: 'v8',
      // Apart from c8's `coverage/`, which `npm run coverage` owns.
      reportsDirectory: 'coverage/ui',
      include: ['src/**/*.jsx'],
      exclude: [
        // The entry point: one `createRoot` against a `#root` that only a
        // page has. Its routes are in routes.jsx, which is in.
        'src/main.jsx',
        // A table of SVG paths keyed by name, one switch and no decision
        // worth a test — the same exception the c8 gate makes for
        // categories.js and vibes.js.
        'src/icons.jsx',
      ],
      thresholds: {
        perFile: true,
        'src/**/*.jsx': FLOOR,
      },
    },
  },
});
