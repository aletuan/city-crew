import { test } from 'node:test';
import assert from 'node:assert/strict';
import { leftBehindNote, removeObjects } from '../src/storage.js';

const bucket = (answer) => {
  const asked = [];
  return { asked, remove: async (paths) => { asked.push(paths); return typeof answer === 'function' ? answer(paths) : answer; } };
};

test('asks for nothing when there is nothing to remove', async () => {
  const b = bucket({ data: [], error: null });
  assert.deepEqual(await removeObjects(b, [null, '', undefined]), { removed: 0, left: [] });
  assert.deepEqual(b.asked, []);
});

test('asks once, without duplicates, and counts what Storage says went', async () => {
  const b = bucket((paths) => ({ data: paths.map((name) => ({ name })), error: null }));
  const r = await removeObjects(b, ['a/1.jpg', 'a/2.jpg', 'a/1.jpg']);
  assert.deepEqual(b.asked, [['a/1.jpg', 'a/2.jpg']]);
  assert.deepEqual(r, { removed: 2, left: [] });
});

// The failure that left 63 files behind: a refused delete is not an error,
// it is an empty list.
test('treats an empty answer with no error as nothing removed', async () => {
  const r = await removeObjects(bucket({ data: [], error: null }), ['a/1.jpg', 'a/2.jpg']);
  assert.deepEqual(r, { removed: 0, left: ['a/1.jpg', 'a/2.jpg'] });
});

test('reports the part Storage kept', async () => {
  const r = await removeObjects(bucket({ data: [{ name: 'a/1.jpg' }], error: null }), ['a/1.jpg', 'a/2.jpg']);
  assert.deepEqual(r, { removed: 1, left: ['a/2.jpg'] });
});

test('reports an error, and a throw, as everything left', async () => {
  const refused = await removeObjects(bucket({ data: null, error: { message: 'denied' } }), ['a/1.jpg']);
  assert.deepEqual(refused, { removed: 0, left: ['a/1.jpg'], error: 'denied' });
  const thrown = await removeObjects({ remove: async () => { throw new Error('offline'); } }, ['a/1.jpg']);
  assert.deepEqual(thrown, { removed: 0, left: ['a/1.jpg'], error: 'offline' });
});

test('says nothing when nothing was left, and counts it when something was', () => {
  assert.equal(leftBehindNote([]), null);
  assert.equal(leftBehindNote(undefined), null);
  assert.equal(leftBehindNote(['a']), '1 photo file could not be removed from Storage and is now orphaned');
  assert.equal(leftBehindNote(['a', 'b']), '2 photo files could not be removed from Storage and are now orphaned');
});
