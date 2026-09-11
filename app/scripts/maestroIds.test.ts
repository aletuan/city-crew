// Every id the iOS smoke flows select by still exists in the app.
//
// The flows under `.maestro/` run by hand on a Mac, so a renamed or
// removed `testID` used to surface only there — days later, as "Element
// not found" on a flow nobody had touched. This reads the ids out of the
// flows and out of the source and fails here, in CI, the moment they part.
//
// The source side is read from the lines that set `testID`: quoted ids,
// and the fixed front of a template (`place-card-${index}` answers for
// `place-card-0`).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const app = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Expo Go's own controls, which the prep subflow taps — not ours. */
const NOT_OURS = new Set(['gearshape.fill']);

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
  const files = walk(join(app, 'src'), (f) => f.endsWith('.tsx') && !/\.test\.tsx$/.test(f));
  for (const file of files) {
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      if (!line.includes('testID')) continue;
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

  for (const [id, file] of ids) {
    it(`${id} (${file}) is set somewhere in src/`, () => {
      const found = exact.has(id) || [...prefixes].some((p) => id.startsWith(p) && id.length > p.length);
      expect(found, `no testID "${id}" in src/ — renamed or removed?`).toBe(true);
    });
  }
});
