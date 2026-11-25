// The comparison behind `.github/workflows/migration-drift.yml`, which
// can only run where the live project's history can be read. These pin
// what it decides on a history made up here, and that its list of known
// exceptions still names files the repo has.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { drift, KNOWN, parseFile } from '../scripts/migration-drift.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const row = (version, name) => ({ version, name });

test('reads a migration file name, and nothing else', () => {
  assert.deepEqual(parseFile('20261125120000_checkin_photo_desk.sql'), { version: '20261125120000', name: 'checkin_photo_desk' });
  assert.equal(parseFile('README.md'), null);
  assert.equal(parseFile('2026_short.sql'), null);
});

test('a file live ran under its own name is on live, whatever the version', () => {
  const { missing } = drift(['20261125120000_checkin_photo_desk.sql'], [row('20261125014020', 'checkin_photo_desk')], {});
  assert.deepEqual(missing, []);
});

test('a file whose version live has is on live, whatever the name', () => {
  // After the history is repaired, versions match and names may not.
  const { missing } = drift(['20261125120000_checkin_photo_desk.sql'], [row('20261125120000', 'something_else')], {});
  assert.deepEqual(missing, []);
});

test('a file live has not run is reported', () => {
  const { missing } = drift(
    ['20261124230000_checkin_photos.sql', '20261126000000_new_thing.sql'],
    [row('20261124160603', 'checkin_photos')],
    {},
  );
  assert.deepEqual(missing, ['20261126000000_new_thing.sql']);
});

test('a renamed migration counts only while its live name is there', () => {
  const known = { japanese_content_columns: { as: 'add_japanese_content_columns' } };
  const files = ['20260808120000_japanese_content_columns.sql'];
  assert.deepEqual(drift(files, [row('20260808090945', 'add_japanese_content_columns')], known).missing, []);
  assert.deepEqual(drift(files, [row('20260808090945', 'other')], known).missing, files);
});

test('a folded or data-only file is accepted without a live row', () => {
  const known = { profiles: { folded: true }, tagline_audit: { data: true } };
  const files = ['20260815000000_profiles.sql', '20261008150000_tagline_audit.sql'];
  assert.deepEqual(drift(files, [row('1', 'x')], known), { missing: [], stale: [] });
});

test('an exception no file needs any more is named as stale', () => {
  const known = { profiles: { folded: true }, gone: { folded: true } };
  // `profiles` now matches live by name: its entry is not needed either.
  const { stale } = drift(['20260815000000_profiles.sql'], [row('1', 'profiles')], known);
  assert.deepEqual(stale.sort(), ['gone', 'profiles']);
});

test('every exception names a file the repo still has', () => {
  const names = new Set(readdirSync(join(ROOT, 'supabase/migrations')).map(parseFile).filter(Boolean).map((m) => m.name));
  for (const n of Object.keys(KNOWN)) assert.ok(names.has(n), `KNOWN['${n}'] names no file in supabase/migrations`);
});
