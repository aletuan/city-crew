// The stylesheet's own arithmetic, such as it is: does every custom property
// the desk reads actually exist.
//
// This is here because it did not, and nothing noticed. The reports block
// was written against a different set of names — `--text`, `--text-2`,
// `--text-3`, `--border-soft` — and the token file declares
// `--text-primary`, `--text-secondary`, `--text-tertiary` and
// `--border-glass-soft`. An unresolvable `var()` is not a parse error and
// not a lint error; the property simply becomes unset, and `color` inherits.
// So five ranks of information on the Reports page — the kind, the reason,
// the handle, the quoted words, the reporter's note — all rendered the same
// white, and the page looked deliberate while saying nothing.
//
// Lint cannot see this: ESLint does not read CSS. The build cannot see it:
// Vite ships invalid `var()` untouched, exactly as the spec requires. A
// component test cannot see it either, unless it happens to assert on a
// colour nobody would think to assert on. It is only visible by comparing
// two sets of names, which is all this file does.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/theme.css', import.meta.url), 'utf8');

/** Every `--name:` that appears as a declaration — i.e. at the start of a
 *  declaration, after `{` or `;` or a newline. Deliberately not a match on
 *  `--name` anywhere, which would also catch the uses. */
const declared = new Set(
  [...css.matchAll(/(?:^|[{;])\s*(--[\w-]+)\s*:/gm)].map((m) => m[1]),
);

/** Every `var(--name)` read, with the name it falls back to (if any) kept
 *  separately: `var(--a, var(--b))` reads both. */
const used = new Set([...css.matchAll(/var\(\s*(--[\w-]+)/g)].map((m) => m[1]));

test('the token file declares something', () => {
  // A guard on the guard: if the regex above ever stops matching, the real
  // assertion below would pass by finding nothing to complain about.
  assert.ok(declared.size > 15, `only ${declared.size} custom properties found — regex broken?`);
  assert.ok(used.size > 15, `only ${used.size} var() reads found — regex broken?`);
  assert.ok(declared.has('--bg-app'));
  assert.ok(used.has('--text-primary'));
});

test('every var() the stylesheet reads is a property it declares', () => {
  const missing = [...used].filter((name) => !declared.has(name)).sort();
  assert.deepEqual(
    missing,
    [],
    `undefined custom propert${missing.length === 1 ? 'y' : 'ies'}: ${missing.join(', ')}.\n`
    + 'An unresolvable var() is not an error — the property becomes unset and\n'
    + 'colour inherits, so this renders as text that silently loses its rank.\n'
    + `Declared names include: ${[...declared].sort().join(', ')}`,
  );
});

test('a control has an edge you can see', () => {
  // WCAG 1.4.11 wants 3:1 of whatever identifies a control, and an input's
  // edge is the only thing that does. The value is derived in the comment
  // beside the declaration; this holds the floor it was derived against, so
  // a later tidy-up cannot quietly put it back under the line.
  const m = css.match(/--border-control:\s*rgba\(255,\s*255,\s*255,\s*([\d.]+)\)/);
  assert.ok(m, '--border-control is missing or no longer a white alpha');
  assert.ok(
    Number(m[1]) >= 0.3423,
    `--border-control is ${m[1]}; below 0.3423 it drops under 3:1 on the desk's own grounds`,
  );
});
