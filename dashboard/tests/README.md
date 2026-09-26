# What the desk's gates hold, and what they do not

Two suites, two gates, one directory.

## The modules: `npm test`, gated by `npm run coverage`

`node --test` over plain modules: `api.js` with a fake Supabase client
(`_fakeSupabase.mjs`), and the arithmetic modules — `contributors.js`,
`coverage.js`, `reports.js`, `storage.js`, `cityHero.js` and everything
under `lib/` — which are folds over plain rows and sit at or near 100%.
Two of the files here read source rather than run it: `desk.test.mjs`
cuts the two seats of the actions out of `App.jsx` by class name, and
`theme.test.mjs` checks every `var()` the stylesheet reads is declared.

The gate is c8, per file, lines and functions only; `api.js` is the
lowest file and sets the floor. The numbers are in `package.json`.

## The components: `npm run test:ui`, gated by `npm run coverage:ui`

`tests/*.ui.test.jsx`, run by vitest in jsdom. Every screen is mounted
at its route inside the real `<App />` through the same route table the
page uses (`_ui/desk.jsx`), with `api.js` and the Supabase client stood
in for (`_ui/setup.jsx`). What a test sees is what the page shows: the
head above the screen, the toast the screen fires, the city the desk is
on. `App.jsx` is covered by the same tests that cover its rooms, and
`auth.jsx` is the one thing tested on its own.

The gate is vitest's, per file, all four columns; the floors are in
`vitest.config.js` with the reasoning. They are a ratchet: the lowest
file's figures rounded down, raised by hand when the tests grow, never
lowered to make a change pass.

## What a number here means

Coverage says a line ran, not that a test would notice it breaking. The
tests that exist were written to pin behaviour somebody could otherwise
break silently — a filter that dropped the page, a checkbox that ticked
after the round trip, a publish button in one seat and not the other —
and the next one should be written for the same reason rather than to
move a percentage. Nothing here has ever seen a pixel: layout is not
simulated, and a screen that renders the right words in the wrong place
is green.

## Why this used to read differently

Until the component harness existed, this file said the desk's function
percentage fell with every feature, because each handler was a function
the denominator counted and the numerator could not — and the advice was
to move everything decidable out of a component into a module. That was
the right advice for the tools there were, and the modules it produced
are still the first place to test a decision. It is no longer the only
place.
