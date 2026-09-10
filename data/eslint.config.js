// The data package's lint gate. Same doctrine as the dashboard's (see
// dashboard/eslint.config.js): plain JavaScript with no typecheck behind
// it, so lint is the only automated reader these scripts have — and
// until this file existed they had none at all. Most of them are frozen
// bootstrap pipelines kept for provenance; the ones still run are the
// snapshot export and the mockup injection, and `itinerary-runtime.js`
// is shipped into the mockup verbatim.

import js from '@eslint/js';
import globals from 'globals';

export default [
  // `scan-city-local.ts` is a Deno script — `npm:` specifiers, Deno
  // globals — and this parser does not read TypeScript. It is the one
  // file here the Edge Function checks already cover, since it only
  // calls into `supabase/functions/_shared`.
  { ignores: ['node_modules/**', 'scripts/scan-city-local.ts'] },

  js.configs.recommended,

  {
    files: ['**/*.{js,mjs}'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.node },
    },
    linterOptions: { reportUnusedDisableDirectives: 'error' },
    rules: {
      'no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
        ignoreRestSiblings: true,
      }],
    },
  },

  // The itinerary generator is not a module: it is ES5 pasted between
  // markers into the mockup page, where `PLACES`, `CITIES`, `CITY` and
  // `gsize` are the page's own globals and `document` is the real one.
  // Read as a script, with those names known, so lint sees what the
  // browser will.
  {
    files: ['scripts/itinerary-runtime.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'script',
      globals: {
        ...globals.browser,
        PLACES: 'readonly', CITIES: 'readonly', CITY: 'readonly', gsize: 'readonly',
      },
    },
  },
];
