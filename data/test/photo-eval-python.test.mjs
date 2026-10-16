// The photo critic's evaluation script is Python (data/photo-eval), and
// its verdict rule is what steps B5–B7 of docs/photo-critic.md measure
// the model by: a rule that quietly changed would change every number
// they record. Its tests use the standard library only, so they run on
// whatever python3 the machine has, without the venv the model needs.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'photo-eval');

test('the evaluation script\'s own tests pass', () => {
  const run = spawnSync('python3', ['-m', 'unittest', '-v', 'test_eval'], {
    cwd: DIR,
    encoding: 'utf8',
    env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' },
  });
  assert.equal(run.error, undefined, `python3 did not start: ${run.error}`);
  assert.equal(run.status, 0, run.stderr);
});
