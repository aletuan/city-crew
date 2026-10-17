// The photo-type round's sample and its one line of answers.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KINDS, SAMPLE, encode, firstOpen } from '../src/photoTypes.js';

test('the sample is a hundred photographs, none twice', () => {
  assert.equal(SAMPLE.length, 100);
  assert.equal(new Set(SAMPLE).size, 100);
});

test('the answers are four, each its own letter', () => {
  assert.deepEqual(KINDS.map((k) => k.key), ['F', 'P', 'S', 'U']);
});

test('encode writes a letter per photograph in sample order, and - where none', () => {
  const line = encode({ [SAMPLE[0]]: 'F', [SAMPLE[2]]: 'S' });
  assert.equal(line.length, 100);
  assert.equal(line.slice(0, 4), 'F-S-');
});

test('firstOpen is the first unanswered photograph, or the end', () => {
  assert.equal(firstOpen({}), 0);
  assert.equal(firstOpen({ [SAMPLE[0]]: 'P' }), 1);
  assert.equal(firstOpen(Object.fromEntries(SAMPLE.map((id) => [id, 'U']))), 100);
});
