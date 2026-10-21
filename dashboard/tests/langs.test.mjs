// langs.js: the one place the language rule is written, and the fold
// that turns the object's languages into form keys and back.
//
// The fold is where a flag gets decided — `machine` on a blurb a model
// wrote and nobody has touched — so each of its three answers is pinned:
// a draft just taken, a text a person changed, a text left alone.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LANGS, columnLangs, objectLangs, localizedColumns, localizedKeys, unfoldI18n, foldI18n,
  countMachine, machineFilters,
} from '../src/langs.js';

test('EN and VI are columns, every later language is in the object', () => {
  assert.deepEqual(columnLangs().map((l) => l.code), ['en', 'vi']);
  assert.deepEqual(objectLangs().map((l) => l.code), ['ja', 'zh', 'zh-Hant']);
  assert.equal(LANGS.length, 5);
  assert.deepEqual(localizedColumns(), [
    'name_en', 'name_vi', 'desc_en', 'desc_vi', 'neighborhood_en', 'neighborhood_vi',
  ]);
  assert.deepEqual(localizedKeys(['desc']), ['desc_en', 'desc_vi', 'desc_ja', 'desc_zh', 'desc_zh-Hant']);
});

test('unfold gives the form one key per field, null where the object has nothing', () => {
  const none = {
    name_ja: null, desc_ja: null, neighborhood_ja: null, name_zh: null, desc_zh: null, neighborhood_zh: null,
    'name_zh-Hant': null, 'desc_zh-Hant': null, 'neighborhood_zh-Hant': null,
  };
  assert.deepEqual(unfoldI18n({
    ja: { name: 'カフェ', desc: '  川沿い。 ', machine: true }, zh: { desc: ' 河边。 ' }, 'zh-Hant': { desc: '河邊。' },
  }), {
    ...none, name_ja: 'カフェ', desc_ja: '川沿い。', desc_zh: '河边。', 'desc_zh-Hant': '河邊。',
  });
  assert.deepEqual(unfoldI18n({}), none);
  assert.deepEqual(unfoldI18n(undefined), none);
  // A number where text should be is not text.
  assert.deepEqual(unfoldI18n({ ja: { name: 7 } }), none);
});

test('fold writes the text back, trimmed, and drops a language with no text left', () => {
  assert.deepEqual(foldI18n({ name_ja: ' 店 ', desc_ja: '', neighborhood_ja: null }), {
    ja: { name: '店' },
  });
  assert.deepEqual(foldI18n({ name_ja: '', desc_ja: '  ', neighborhood_ja: null }, { ja: { desc: 'x', machine: true } }), {});
  assert.deepEqual(foldI18n({}), {});
});

test('fold leaves languages the form does not carry exactly as they were', () => {
  const base = { ko: { desc: '호수 옆 카페.', machine: true }, ja: { desc: '古い。' } };
  assert.deepEqual(foldI18n({ desc_ja: '新しい。' }, base), {
    ko: { desc: '호수 옆 카페.', machine: true },
    ja: { desc: '新しい。' },
  });
});

test('a draft just taken is machine; the same words edited by a person are not', () => {
  const drafted = { ja: '川沿いのベンチ。' };
  assert.deepEqual(foldI18n({ desc_ja: '川沿いのベンチ。' }, {}, drafted), {
    ja: { desc: '川沿いのベンチ。', machine: true },
  });
  // Trimmed on both sides: a trailing space is not an edit.
  assert.deepEqual(foldI18n({ desc_ja: '川沿いのベンチ。 ' }, {}, drafted).ja.machine, true);
  assert.deepEqual(foldI18n({ desc_ja: '川沿いのベンチ。改訂。' }, {}, drafted), {
    ja: { desc: '川沿いのベンチ。改訂。' },
  });
});

test('a text nobody touched keeps its flag; a text somebody changed loses it', () => {
  const base = { ja: { name: '店', desc: '古い。', machine: true } };
  assert.deepEqual(foldI18n({ name_ja: '店', desc_ja: '古い。' }, base), base);
  assert.deepEqual(foldI18n({ name_ja: '店', desc_ja: '新しい。' }, base), { ja: { name: '店', desc: '新しい。' } });
  // Adding a field is a change too.
  assert.deepEqual(foldI18n({ name_ja: '店', desc_ja: '古い。', neighborhood_ja: '1区' }, base),
    { ja: { name: '店', desc: '古い。', neighborhood: '1区' } });
  // And a text that was never machine does not become it by being left alone.
  assert.deepEqual(foldI18n({ desc_ja: '人。' }, { ja: { desc: '人。' } }), { ja: { desc: '人。' } });
});

test('other metadata beside the text survives a fold', () => {
  const base = { ja: { desc: '古い。', machine: true, source: 'threads' } };
  assert.deepEqual(foldI18n({ desc_ja: '新しい。' }, base), { ja: { source: 'threads', desc: '新しい。' } });
});

test('the machine queue is counted per object language, on the boolean the fold writes', () => {
  assert.deepEqual(machineFilters(), [['ja', 'Machine JA'], ['zh', 'Machine ZH'], ['zh-Hant', 'Machine ZH-HANT']]);
  assert.deepEqual(countMachine(null), { ja: 0, zh: 0, 'zh-Hant': 0 });
  assert.deepEqual(countMachine([
    { i18n: { ja: { desc: 'a', machine: true } } },
    { i18n: { ja: { desc: 'b', machine: true } } },
    { i18n: { ja: { desc: 'c' } } },            // read and saved: flag gone
    { i18n: { ja: { desc: 'd', machine: 'true' } } }, // not the fold's boolean
    { i18n: { ko: { desc: 'e', machine: true } } },   // a language LANGS does not list
    { i18n: { zh: { desc: 'f', machine: true } } },
    { i18n: { 'zh-Hant': { desc: 'g', machine: true } } },
    { i18n: {} },
    {},
  ]), { ja: 2, zh: 1, 'zh-Hant': 1 });
});
