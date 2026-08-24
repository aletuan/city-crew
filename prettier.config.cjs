// Prettier's settings — deliberately *not* wired to a repo-wide run.
//
// ── why the formatter is available but not enforced ──
//
// Running `prettier --write` across `app/src` today rewrites 127 files:
// +8,788 / -3,847, a 12,600-line diff. Almost none of it is disagreement
// about style. It is Prettier re-wrapping prose — the comments in this
// repository carry the reasoning behind the code, they are wrapped by hand
// to break at clauses, and a formatter that only counts columns breaks them
// mid-sentence instead. That diff would also take `git blame` on every one
// of those files with it, and blame is how the "why" gets found when the
// comment is not enough.
//
// So the trade was made the other way round: the settings below are chosen
// to *match what the code already does* (single quotes, 100 columns,
// trailing commas), which makes a new file formatted by an editor look like
// its neighbours, and `npm run format` in `app/` is there for anyone who
// wants a file tidied. There is no `--check` step in CI, because a gate that
// is red the day it lands is a gate nobody can act on.
//
// `npm run format` in `app/` takes a path on purpose — `npm run format --
// src/lib/day.ts` — rather than defaulting to the whole tree, so that tidying
// one file cannot turn into that 12,600-line diff by accident.
//
// The lint gate is the one that blocks (see app/eslint.config.js). This file
// is a shared default, not a rule. `eslint-config-prettier` is already in the
// lint config, so whenever a repo-wide reformat is decided on deliberately,
// the two will not fight.

/** @type {import('prettier').Config} */
module.exports = {
  singleQuote: true,
  printWidth: 100,
  semi: true,
  trailingComma: 'all',
  arrowParens: 'always',
};
