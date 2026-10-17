// Round 3's sample and its line of answers.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { ATTRS, KINDS_3, ROUNDS_3, SAMPLE_3, SAMPLE_3B, STATES, code, encode3, firstOpen3, nextState } from '../src/labelRound.js';

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

// Round 3b: the criteria alone, on 40 of round 3's photographs drawn by
// the rule labelRound.js writes down. Recomputed here from the sealed
// answers, so the sample cannot drift from the rule that justifies it.
test('round 3b is the 40 photographs its rule draws from round 3, none twice', () => {
  const md5 = (id) => createHash('md5').update(`${id}photo-labels-round-3b`).digest('hex');
  const lines = [sealed.claude, sealed.function.fn_opus.line, sealed.function.fn_haiku.line,
    sealed.function_v2.fn_opus.line, sealed.function_v2.fn_haiku.line].map((l) => l.split(' '));
  const rare = sealed.photos.filter((_, n) => lines.some((l) => l[n][5] === '1' || l[n][6] === '1'));
  const contested = sealed.photos
    .filter((id, n) => !rare.includes(id) && [1, 2, 3, 4, 5, 6].some((a) => new Set(lines.map((l) => l[n][a])).size > 1))
    .sort((x, y) => md5(x).localeCompare(md5(y)));
  const drawn = [...rare, ...contested.slice(0, 40 - rare.length)].sort((x, y) => md5(x).localeCompare(md5(y)));
  assert.deepEqual(SAMPLE_3B, drawn);
  assert.equal(new Set(SAMPLE_3B).size, 40);
  assert.ok(SAMPLE_3B.every((id) => SAMPLE_3.includes(id)));
});

test('each round keeps its answers apart, and only round 3 asks the kind', () => {
  assert.notEqual(ROUNDS_3.r3.key, ROUNDS_3.r3b.key);
  assert.equal(ROUNDS_3.r3.kinds, true);
  assert.equal(ROUNDS_3.r3b.kinds, false);
  assert.equal(ROUNDS_3.r3b.sample, SAMPLE_3B);
});

test('without the kind, a code is the six criteria once Next was pressed, dashes before', () => {
  assert.equal(code({ seen: true, attrs: { people: '1', brand: '?' } }, false), '?00010');
  assert.equal(code({ attrs: { people: '1' } }, false), '------');
  assert.equal(encode3(SAMPLE_3B.slice(0, 2), { [SAMPLE_3B[1]]: { seen: true } }, false), '------ 000000');
  assert.equal(firstOpen3(SAMPLE_3B, { [SAMPLE_3B[0]]: { seen: true } }, false), 1);
  assert.equal(firstOpen3(SAMPLE_3B, Object.fromEntries(SAMPLE_3B.map((id) => [id, { seen: true }])), false), 40);
});
