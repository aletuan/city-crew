// Every id the iOS smoke flows select by still exists in the app.
//
// The flows under `.maestro/` run by hand on a Mac, so a renamed or
// removed `testID` used to surface only there — days later, as "Element
// not found" on a flow nobody had touched. This reads the ids out of the
// flows and out of the source and fails here, in CI, the moment they part.
//
// The source side is read from the lines that set a `testID` (or forward
// one, as `backTestID` does): quoted ids,
// and the fixed front of a template (`place-card-${index}` answers for
// `place-card-0`).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const app = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Expo Go and iOS Settings controls used by simulator prep, not app ids. */
const NOT_OURS = new Set(['gearshape.fill', 'SuggestStrongPasswordsToggle', 'AutoFillFromPasswordsToggle']);

const walk = (dir: string, keep: (f: string) => boolean): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path, keep);
    return keep(path) ? [path] : [];
  });

const flowIds = (): Map<string, string> => {
  const ids = new Map<string, string>();
  for (const file of walk(join(app, '.maestro'), (f) => f.endsWith('.yaml'))) {
    for (const m of readFileSync(file, 'utf8').matchAll(/^\s*id:\s*"([^"]+)"/gm)) {
      if (!NOT_OURS.has(m[1])) ids.set(m[1], file.slice(app.length + 1));
    }
  }
  return ids;
};

const sourceIds = () => {
  const exact = new Set<string>();
  const prefixes = new Set<string>();
  // `.ts` as well as `.tsx` (23 Nov 2026): a hook that builds sheet rows
  // sets their ids with no JSX in sight — `useListMenu`'s
  // `collection-menu-edit` — and reading only `.tsx` failed three flows
  // the day the ⋯'s rows left the screen for it.
  const files = walk(join(app, 'src'), (f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f));
  for (const file of files) {
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      // Any case: a prop that forwards an id under its own name
      // (`backTestID="collection-back"`) sets it just the same.
      if (!/testid/i.test(line)) continue;
      for (const m of line.matchAll(/['"]([a-z0-9][a-z0-9-]*)['"]/g)) exact.add(m[1]);
      for (const m of line.matchAll(/`([a-z0-9-]+)\$\{/g)) prefixes.add(m[1]);
    }
  }
  return { exact, prefixes };
};

describe('the smoke flows and the app agree on ids', () => {
  const ids = flowIds();
  const { exact, prefixes } = sourceIds();

  it('finds the flows', () => {
    // A path that stopped matching would pass every check below vacuously.
    expect(ids.size).toBeGreaterThan(20);
  });

  // An id is a regular expression to Maestro, and a flow that waits for
  // one of two pages writes both (`person-account|profile-sign-in`, since
  // 19 Nov 2026): each of them has to be in the app, or the wait is for a
  // page that no longer exists half the time.
  for (const [id, file] of ids) {
    it(`${id} (${file}) is set somewhere in src/`, () => {
      for (const one of id.split('|')) {
        const found = exact.has(one) || [...prefixes].some((p) => one.startsWith(p) && one.length > p.length);
        expect(found, `no testID "${one}" in src/ — renamed or removed?`).toBe(true);
      }
    });
  }
});
