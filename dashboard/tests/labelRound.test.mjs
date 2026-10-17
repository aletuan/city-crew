// Round 3's sample and its line of answers.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { ATTRS, KINDS_3, SAMPLE_3, STATES, code, encode3, firstOpen3, nextState } from '../src/labelRound.js';

const sealed = JSON.parse(readFileSync(new URL('../../data/review/photo-types/round3.json', import.meta.url)));

test('the sample is the 137 photographs Claude labelled, none twice, in the sealed order', () => {
  assert.equal(SAMPLE_3.length, 137);
  assert.equal(new Set(SAMPLE_3).size, 137);
  assert.deepEqual(SAMPLE_3, sealed.photos);
});

// The sealed line is what the owner's answers are scored against: if it
// or its hash changed after the owner answered, the round measures
// nothing.
test('Claude\'s sealed line matches its hash and reads as round 3 codes', () => {
  assert.equal(createHash('sha256').update(sealed.claude).digest('hex'), sealed.sha256);
  const codes = sealed.claude.split(' ');
  assert.equal(codes.length, 137);
  assert.ok(codes.every((c) => /^[FIEVTOfievto][01?]{6}$/.test(c)));
});

test('the kinds are seven letters, the criteria six, in the line\'s order', () => {
  assert.deepEqual(KINDS_3.map((k) => k.key), ['F', 'I', 'E', 'V', 'T', 'O', 'U']);
  assert.deepEqual(ATTRS.map((a) => a.key), ['brand', 'wide', 'green', 'daylight', 'people', 'staged']);
});

test('a tap steps a criterion from no to yes to can\'t tell and back', () => {
  assert.deepEqual(STATES.map((s) => s.key), ['0', '1', '?']);
  assert.equal(nextState('0'), '1');
  assert.equal(nextState('1'), '?');
  assert.equal(nextState('?'), '0');
});

test('code writes the kind and six criteria, no where untouched, dashes where no kind', () => {
  assert.equal(code({ kind: 'I', attrs: { wide: '1', daylight: '?' } }), 'I010?00');
  assert.equal(code({ kind: 'F' }), 'F000000');
  assert.equal(code({ attrs: { wide: '1' } }), '-------');
  assert.equal(code(undefined), '-------');
});

test('encode3 writes a code per photograph in sample order', () => {
  const line = encode3(SAMPLE_3, { [SAMPLE_3[1]]: { kind: 'E', attrs: { brand: '1' } } });
  const codes = line.split(' ');
  assert.equal(codes.length, 137);
  assert.deepEqual(codes.slice(0, 3), ['-------', 'E100000', '-------']);
});

test('firstOpen3 is the first photograph without a kind, or the end', () => {
  assert.equal(firstOpen3(SAMPLE_3, {}), 0);
  assert.equal(firstOpen3(SAMPLE_3, { [SAMPLE_3[0]]: { kind: 'F' }, [SAMPLE_3[1]]: { attrs: {} } }), 1);
  assert.equal(firstOpen3(SAMPLE_3, Object.fromEntries(SAMPLE_3.map((id) => [id, { kind: 'U' }]))), 137);
});
