// The comparison behind `.github/workflows/migration-drift.yml`, which
// can only run where the live project's history can be read. These pin
// what it decides on a history made up here.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { drift, parseFile, pending } from '../scripts/migration-drift.mjs';

const row = (version, name) => ({ version, name });
const none = { missing: [], extra: [], restamped: [], renamed: [] };

test('reads a migration file name, and nothing else', () => {
  assert.deepEqual(parseFile('20261125120000_checkin_photo_desk.sql'), { version: '20261125120000', name: 'checkin_photo_desk' });
  assert.equal(parseFile('README.md'), null);
  assert.equal(parseFile('2026_short.sql'), null);
});

test('agrees when every file has its row and every row its file', () => {
  const files = ['20261124230000_checkin_photos.sql', '20261125120000_checkin_photo_desk.sql', 'README.md'];
  const live = [row('20261124230000', 'checkin_photos'), row('20261125120000', 'checkin_photo_desk')];
  assert.deepEqual(drift(files, live), none);
});

test('a file live has not run is missing', () => {
  const r = drift(['20261124230000_checkin_photos.sql', '20261126000000_new_thing.sql'], [row('20261124230000', 'checkin_photos')]);
  assert.deepEqual(r, { ...none, missing: ['20261126000000_new_thing'] });
});

test('a live row no file describes is extra', () => {
  // Applied by hand and never committed, or a file a merge took away.
  const r = drift(['20261124230000_checkin_photos.sql'], [row('20261124230000', 'checkin_photos'), row('20261126000000', 'hotfix')]);
  assert.deepEqual(r, { ...none, extra: ['20261126000000_hotfix'] });
});

test('a file applied under the minute it ran is restamped, not missing and extra', () => {
  const r = drift(['20261126000000_new_thing.sql'], [row('20261125234512', 'new_thing')]);
  assert.deepEqual(r, { ...none, restamped: [{ name: 'new_thing', file: '20261126000000', live: '20261125234512' }] });
});

test('one version under two names is renamed', () => {
  const r = drift(['20261126000000_new_name.sql'], [row('20261126000000', 'old_name')]);
  assert.deepEqual(r, { ...none, renamed: [{ version: '20261126000000', file: 'new_name', live: 'old_name' }] });
});

test('a missing file and an extra row with different names stay what they are', () => {
  const r = drift(['20261126000000_a.sql'], [row('20261125000000', 'b')]);
  assert.deepEqual(r, { ...none, missing: ['20261126000000_a'], extra: ['20261125000000_b'] });
});

test('a deploy waits for a file live has not run, and for nothing else', () => {
  const files = ['20261124230000_checkin_photos.sql', '20261125120000_checkin_photo_desk.sql', '20261126000000_new_thing.sql'];
  const live = [
    // Applied under the minute it ran: it ran, so nothing waits on it.
    row('20261124231507', 'checkin_photos'),
    row('20261125120000', 'checkin_photo_desk'),
    // In no file: the drift job's business, not a deploy's.
    row('20261101000000', 'applied_by_hand'),
  ];
  assert.deepEqual(pending(files, live), ['20261126000000_new_thing']);
  assert.deepEqual(pending(files, [...live, row('20261126000000', 'new_thing')]), []);
});
