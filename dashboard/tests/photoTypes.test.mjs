// The photo-type round's sample and its one line of answers.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GUIDE, KINDS, ROUNDS, SAMPLE, SAMPLE_1B, encode, firstOpen } from '../src/photoTypes.js';

test('the sample is a hundred photographs, none twice', () => {
  assert.equal(SAMPLE.length, 100);
  assert.equal(new Set(SAMPLE).size, 100);
});

test('the answers are four, each its own letter', () => {
  assert.deepEqual(KINDS.map((k) => k.key), ['F', 'P', 'S', 'U']);
});

test('encode writes a letter per photograph in sample order, and - where none', () => {
  const line = encode(SAMPLE, { [SAMPLE[0]]: 'F', [SAMPLE[2]]: 'S' });
  assert.equal(line.length, 100);
  assert.equal(line.slice(0, 4), 'F-S-');
});

test('firstOpen is the first unanswered photograph, or the end', () => {
  assert.equal(firstOpen(SAMPLE, {}), 0);
  assert.equal(firstOpen(SAMPLE, { [SAMPLE[0]]: 'P' }), 1);
  assert.equal(firstOpen(SAMPLE, Object.fromEntries(SAMPLE.map((id) => [id, 'U']))), 100);
});

// Round 1b asks again only what round 1 called a place or scenery.
test('round 1b is 57 of round 1, in round 1\'s order, none twice', () => {
  assert.equal(SAMPLE_1B.length, 57);
  assert.equal(new Set(SAMPLE_1B).size, 57);
  const at = SAMPLE_1B.map((id) => SAMPLE.indexOf(id));
  assert.ok(at.every((i) => i >= 0));
  assert.deepEqual(at, [...at].sort((a, b) => a - b));
});

test('each round keeps its answers apart, and only 1b shows the definitions', () => {
  assert.notEqual(ROUNDS.r1.key, ROUNDS.r1b.key);
  assert.equal(ROUNDS.r1.guide, false);
  assert.equal(ROUNDS.r1b.guide, true);
  assert.deepEqual(GUIDE.map((g) => g.key), ['P', 'S', 'F', 'U']);
});
