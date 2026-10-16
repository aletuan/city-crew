// The photo critic's evaluation prompts (step B2 of docs/photo-critic.md)
// describe each category's photographs. A category the app gains and the
// prompts lack would be scored as nothing at all, and a key the app drops
// would be a category no place can match — both silent. So the keys are
// held to the app's, by the same parse `categories-sync.test.mjs` uses.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function appKeys() {
  const src = readFileSync(join(ROOT, 'app/src/lib/categories.ts'), 'utf8');
  const start = src.indexOf('export const CATEGORIES');
  const body = src.slice(start, src.indexOf('\n};', start));
  return [...body.matchAll(/^ {2}(\w+): \{/gm)].map((m) => m[1]);
}

const prompts = JSON.parse(readFileSync(join(ROOT, 'data/photo-eval/prompts.json'), 'utf8'));

test('the evaluation prompts describe exactly the app\'s categories', () => {
  const app = appKeys().sort();
  assert.ok(app.length >= 2, 'parsed no categories out of the app');
  assert.deepEqual(Object.keys(prompts.categories).sort(), app);
});

// One sentence would make a category's score that sentence's luck; the
// best of several is what a category is scored by.
test('every category, and both outside groups, has at least three sentences', () => {
  for (const [key, list] of Object.entries(prompts.categories)) {
    assert.ok(list.length >= 3, `${key} has ${list.length}`);
  }
  assert.ok(prompts.offTopic.length >= 3);
  assert.ok(prompts.neutral.length >= 3);
});

// A sentence in two groups would make a photograph match both by the
// same words, and the margin between them meaningless.
test('no sentence is in two groups', () => {
  const all = [...Object.values(prompts.categories).flat(), ...prompts.offTopic, ...prompts.neutral];
  assert.equal(new Set(all).size, all.length);
});
