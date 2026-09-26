// The category vocabulary lives in three places, and until this file
// nothing checked that they agreed.
//
//   app/src/lib/categories.ts   — what the phone draws and searches
//   dashboard/src/categories.js — what the desk offers an editor
//   supabase/migrations/*.sql   — the check constraint that accepts a write
//
// All three already say, in their own comments, that the other two must
// match. None of them could verify it: a TypeScript file cannot read a
// migration, and `supabase/tests/categories_test.sql` can only see the
// constraint it is testing. So the invariant was held by one person
// remembering it, and the failure it invites is quiet — add a key to the
// app and the desk, forget the constraint, and every import carrying the
// new category fails in production with a constraint violation.
//
// This test lives in `data/` because `data/` is the only workspace that
// is not one of the three parties; it can read all of them without any of
// them depending on it.
//
// It deliberately does NOT hardcode which migration holds the constraint.
// Three have set it so far (`place_categories`, `drop_sights_category`,
// `focus_fun_categories`) and the next one will be a fourth, so the rule
// is "the last migration in filename order that adds it", which is what
// Postgres itself ends up with.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** The keys of `export const CATEGORIES: Record<string, CategoryStyle> = {…}`,
 *  taken at one level of indent so the fields inside each entry — `en`,
 *  `icon`, `color` — are not mistaken for categories. */
function appKeys() {
  const src = readFileSync(join(ROOT, 'app/src/lib/categories.ts'), 'utf8');
  const start = src.indexOf('export const CATEGORIES');
  assert.notEqual(start, -1, 'app/src/lib/categories.ts no longer declares CATEGORIES');
  const body = src.slice(start, src.indexOf('\n};', start));
  return [...body.matchAll(/^ {2}(\w+): \{/gm)].map((m) => m[1]);
}

/** The first element of each pair in `export const CATEGORY_KEYS = […]`;
 *  the second is the desk's own label and is allowed to differ. */
function dashboardKeys() {
  const src = readFileSync(join(ROOT, 'dashboard/src/categories.js'), 'utf8');
  const start = src.indexOf('export const CATEGORY_KEYS');
  assert.notEqual(start, -1, 'dashboard/src/categories.js no longer declares CATEGORY_KEYS');
  const body = src.slice(start, src.indexOf('\n];', start));
  return [...body.matchAll(/\['(\w+)',/g)].map((m) => m[1]);
}

/** The array in the newest migration that adds `places_categories_known`. */
function constraintKeys() {
  const dir = join(ROOT, 'supabase/migrations');
  const holders = readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .filter((f) => /add constraint places_categories_known/.test(readFileSync(join(dir, f), 'utf8')));
  assert.ok(holders.length > 0, 'no migration adds places_categories_known');
  const last = holders[holders.length - 1];
  const sql = readFileSync(join(dir, last), 'utf8');
  const at = sql.indexOf('add constraint places_categories_known');
  const arr = sql.slice(at).match(/array\[([^\]]*)\]/);
  assert.ok(arr, `${last} adds the constraint but no array[...] follows it`);
  return [...arr[1].matchAll(/'(\w+)'/g)].map((m) => m[1]);
}

const missing = (a, b) => a.filter((k) => !b.includes(k));

test('the app, the desk and the check constraint know the same categories', () => {
  const app = appKeys();
  const desk = dashboardKeys();
  const db = constraintKeys();

  // A parser that silently matched nothing would make every comparison
  // below pass, so each source has to have found something first.
  assert.ok(app.length >= 2, `parsed ${app.length} categories out of the app — the file's shape changed`);
  assert.ok(desk.length >= 2, `parsed ${desk.length} categories out of the dashboard — the file's shape changed`);
  assert.ok(db.length >= 2, `parsed ${db.length} categories out of the constraint — the migration's shape changed`);

  // Reported per direction, because "these two sets differ" sends the
  // reader back to diff three files by eye; the whole point is to say
  // which key is where.
  assert.deepEqual(missing(app, db), [], 'in the app but not in the check constraint — an import of these would be rejected');
  assert.deepEqual(missing(db, app), [], 'in the check constraint but not in the app — the phone cannot draw these');
  assert.deepEqual(missing(app, desk), [], 'in the app but not on the desk — no editor can assign these');
  assert.deepEqual(missing(desk, app), [], 'on the desk but not in the app — the desk offers what the phone will not show');
});
