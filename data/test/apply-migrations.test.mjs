// What `.github/workflows/apply-migrations.yml` would apply, decided on a
// history made up here, and the request it sends for one file.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyBody, planApply } from '../scripts/apply-migrations.mjs';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'supabase/migrations');
const row = (version, name) => ({ version, name });
const LIVE = [row('20261124230000', 'checkin_photos'), row('20261125120000', 'checkin_photo_desk')];
const FILES = ['20261124230000_checkin_photos.sql', '20261125120000_checkin_photo_desk.sql'];

test('nothing to apply when live has every file', () => {
  assert.deepEqual(planApply(FILES, LIVE), { apply: [], refuse: null });
});

test('applies the files live lacks, oldest first', () => {
  const files = [...FILES, '20261127000000_b.sql', '20261126000000_a.sql'];
  assert.deepEqual(planApply(files, LIVE), { apply: ['20261126000000_a.sql', '20261127000000_b.sql'], refuse: null });
});

test('refuses while live has a row no file describes', () => {
  const r = planApply([...FILES, '20261126000000_a.sql'], [...LIVE, row('20261125230000', 'hotfix')]);
  assert.deepEqual(r.apply, []);
  assert.match(r.refuse, /live row\(s\) with no file: 20261125230000_hotfix/);
});

test('refuses while a file sits under another version on live', () => {
  const r = planApply([...FILES, '20261126000000_a.sql'], [...LIVE, row('20261126013000', 'a')]);
  assert.deepEqual(r.apply, []);
  assert.match(r.refuse, /applied under another version: a/);
});

test('refuses while one version has two names', () => {
  const r = planApply(FILES, [LIVE[0], row('20261125120000', 'other')]);
  assert.deepEqual(r.apply, []);
  assert.match(r.refuse, /two names: 20261125120000/);
});

test('refuses a file older than the newest live row', () => {
  // Merged out of order: running it after the files that came later is
  // a person's decision.
  const r = planApply([...FILES, '20261125000000_late.sql'], LIVE);
  assert.deepEqual(r.apply, []);
  assert.match(r.refuse, /merged out of order: 20261125000000_late/);
});

test('one transaction: the SQL, then its row under the file\'s own version', () => {
  const { query } = JSON.parse(applyBody('20261126000000_a.sql', 'create table t (x int);'));
  assert.equal(query.split('\n')[0], 'begin;');
  assert.match(query, /create table t \(x int\);\n;\ninsert into supabase_migrations\.schema_migrations/);
  assert.match(query, /values \('20261126000000', 'a', array\[\$migration\$create table t \(x int\);\$migration\$\]/);
  assert.equal(query.split('\n').at(-1), 'commit;');
});

test('quotes the SQL under a tag the SQL does not contain', () => {
  const sql = 'select $migration$x$migration$;';
  const { query } = JSON.parse(applyBody('20261126000000_a.sql', sql));
  assert.ok(query.includes(`array[$migration0$${sql}$migration0$]`));
});

test('refuses a file that runs its own transaction or builds concurrently', () => {
  assert.throws(() => applyBody('20261126000000_a.sql', 'begin;\nselect 1;\ncommit;'), /apply it by hand/);
  assert.throws(() => applyBody('20261126000000_a.sql', 'create index concurrently i on t (x);'), /apply it by hand/);
  // A PL/pgSQL body's `begin` is not a transaction, nor is a comment.
  assert.doesNotThrow(() => applyBody('20261126000000_a.sql', '-- begin;\ncreate function f() returns void language plpgsql as $$ begin null; end; $$;'));
  // Nor is the word in a comment explaining why not.
  assert.doesNotThrow(() => applyBody('20261126000000_a.sql', '-- not concurrently: the table is small\ncreate index i on t (x);'));
});

test('every file in the repo could be applied this way', () => {
  for (const f of readdirSync(DIR).filter((n) => n.endsWith('.sql'))) {
    assert.doesNotThrow(() => applyBody(f, readFileSync(join(DIR, f), 'utf8')), f);
  }
});
