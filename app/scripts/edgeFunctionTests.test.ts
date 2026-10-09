// Every Edge Function in the repository is loaded by a test, or named
// below with the reason it is not.
//
// The coverage gate reads `supabase/functions` since 9 October, and it
// cannot see this hole on its own: v8 reports a file only once something
// has imported it, so a function no test loads is absent from the report
// rather than at 0% — measured, not assumed: six of them were missing
// that day, `fetch-place` among them, the one any signed-in phone can
// make spend Google money. A floor over files that are not listed holds
// nothing. This closes it from the other side: it reads the functions out
// of git and the loads out of the tests, and fails the moment a function
// arrives without one.
//
// Tracked files only (`git ls-files`), because a function is what the
// repository holds. An untracked folder on one laptop is not something
// CI will ever deploy, and it must not turn that laptop's suite red.
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const app = join(dirname(fileURLToPath(import.meta.url)), '..');
const repo = join(app, '..');

/**
 * Functions with no test of their own, and why that is honest. Each is a
 * door: it reads a batch and hands every row to a `_shared` module that
 * the gate holds at 100%. A test here would assert the loop, not the work.
 */
const DOORS: Record<string, string> = {
  'rehost-photos': 'the copy is `_shared/rehost.ts`',
  'refresh-places': 'the refresh is `_shared/refresh-place.ts`',
};

const functions = execFileSync('git', ['ls-files', 'supabase/functions/*/index.ts'], { cwd: repo, encoding: 'utf8' })
  .split('\n')
  .filter(Boolean)
  .map((path) => path.split('/')[2]);

const loads = new Set(
  readdirSync(join(app, 'src/lib'))
    .filter((f) => f.endsWith('.fn.test.ts'))
    .flatMap((f) => [...readFileSync(join(app, 'src/lib', f), 'utf8')
      .matchAll(/supabase\/functions\/([\w-]+)\/index\.ts/g)].map((m) => m[1])),
);

describe('the Edge Functions and their tests', () => {
  it('finds the functions it is meant to read', () => {
    // A glob or a path that matched nothing would pass every test below.
    expect(functions).toContain('delete-account');
  });

  for (const name of functions) {
    it(`${name} is loaded by a *.fn.test.ts${DOORS[name] ? ' — or is a door' : ''}`, () => {
      expect(loads.has(name) || name in DOORS, `no test loads supabase/functions/${name}/index.ts`).toBe(true);
    });
  }

  // A door that gains a test stops being one, and a name left here after
  // its function is deleted is a reason nobody can check.
  for (const name of Object.keys(DOORS)) {
    it(`${name} is still a door: in the repository, with no test of its own`, () => {
      expect(functions).toContain(name);
      expect(loads.has(name)).toBe(false);
    });
  }
});
