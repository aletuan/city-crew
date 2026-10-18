// Round 4's pairs and its line of answers.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { CHOICES, KIND_NAME, PAIRS_4, encode4, firstOpen4 } from '../src/pairRound.js';

const sealed = JSON.parse(readFileSync(new URL('../../data/review/photo-types/round4.json', import.meta.url)));

test('the pairs are the sealed 60, in the sealed order, each photograph once', () => {
  assert.equal(PAIRS_4.length, 60);
  assert.deepEqual(PAIRS_4, sealed.pairs.map(({ kind, a, b }) => ({ kind, a, b })));
  const ids = PAIRS_4.flatMap((p) => [p.a, p.b]);
  assert.equal(new Set(ids).size, 120);
  // One pair to a place.
  assert.equal(new Set(sealed.pairs.map((p) => p.place)).size, 60);
});

test('15 fronts, 23 interiors, 22 food pairs, each kind named', () => {
  const n = (k) => PAIRS_4.filter((p) => p.kind === k).length;
  assert.deepEqual([n('E'), n('I'), n('F')], [15, 23, 22]);
  for (const k of ['E', 'I', 'F']) assert.ok(KIND_NAME[k]);
});

// The sealed lines are what the owner's answers are scored against: if
// one or its hash changed after the owner answered, the round measures
// nothing.
test('each judge\'s sealed line matches its hash and has a letter per pair', () => {
  for (const judge of ['vision', 'haiku', 'opus']) {
    const { line, sha256 } = sealed[judge];
    assert.equal(createHash('sha256').update(line).digest('hex'), sha256, judge);
    assert.match(line, /^[AB=]{60}$/, judge);
  }
});

test('the lines are what the sealed numbers say', () => {
  const pick = (x, y) => (x > y ? 'A' : y > x ? 'B' : '=');
  const from = (value) => sealed.pairs.map((p) => pick(value(p.a), value(p.b))).join('');
  assert.equal(from((id) => sealed.vision.aesthetic[id]), sealed.vision.line);
  assert.equal(from((id) => sealed.haiku.scores[id][0]), sealed.haiku.line);
  assert.equal(from((id) => sealed.opus.scores[id][0]), sealed.opus.line);
});

test('three answers: A, even, B', () => {
  assert.deepEqual(CHOICES.map((c) => c.key), ['A', '=', 'B']);
});

test('encode4 writes a letter per pair in order, a dash where none', () => {
  const line = encode4({ 0: 'A', 2: '=', 59: 'B' });
  assert.equal(line.length, 60);
  assert.equal(line.slice(0, 4), 'A-=-');
  assert.equal(line[59], 'B');
});

test('firstOpen4 is the first pair without an answer, or the end', () => {
  assert.equal(firstOpen4({}), 0);
  assert.equal(firstOpen4({ 0: 'A', 2: 'B' }), 1);
  assert.equal(firstOpen4(Object.fromEntries(PAIRS_4.map((_, i) => [i, '=']))), 60);
});
