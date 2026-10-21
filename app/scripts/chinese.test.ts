// The screens that speak Simplified Chinese, and the proof they still do.
//
// Chinese arrives in steps (21 Oct 2026): step 1 made the language exist
// and fall back to English, step 2 translates the interface a group of
// screens at a time, step 3 is the catalog's own rows. `t(en, vi, ja?,
// zh?)` takes the Chinese last and optional — 887 strings were written
// with three — so a string added to a translated screen without one
// compiles, passes every other test, and reaches a Chinese reader in
// English without anybody noticing. This reads every `t()` call in the
// files below and fails on one that has no fourth argument.
//
// The exception is a row from the database — a city's short name, a
// collection's title, a neighbourhood — which has no Chinese column yet.
// Those are step 3, and named here so that the list says what is left.
//
// It also fails on kana in a Chinese string. The two languages share
// characters, and a Japanese line pasted into the Chinese slot looks right
// at a glance and is not Chinese.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const src = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');

/** Step 2a: Explore, a place, Search, the city sheet, the filters, and
 *  what those draw. A group translated later is added here in its PR. */
const TRANSLATED = [
  'screens/ExploreScreen.tsx',
  'screens/PlaceDetailScreen.tsx',
  'screens/SearchScreen.tsx',
  'components/CitySwitcher.tsx',
  'components/ExploreFilterSheet.tsx',
  'components/PlaceCard.tsx',
  'components/MapPlaceCard.tsx',
  'components/PlacesMap.tsx',
  'components/PricePill.tsx',
  'components/LocalGuidePanel.tsx',
  'components/CandidateRow.tsx',
  'components/AddBatchBar.tsx',
  'components/loadFail.tsx',
  'components/ActionSheet.tsx',
  'lib/searchRows.ts',
  'lib/loadfail.ts',
  'lib/categories.ts',
  'lib/vibes.ts',
];

/** Rows with no Chinese column yet (step 3), by the English argument. */
const ROWS = new Set(['c.short_en', 'city.short_en', 'item.collection.title_en', 'r.en']);

const KANA = /[぀-ヿ]/;

type Call = { at: string; args: string[] };

const calls = (file: string): Call[] => {
  const path = join(src, file);
  const sf = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const out: Call[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 't') {
      const line = sf.getLineAndCharacterOfPosition(node.getStart()).line + 1;
      out.push({ at: `${file}:${line}`, args: node.arguments.map((a) => a.getText()) });
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
};

describe('the screens translated into Chinese', () => {
  const all = TRANSLATED.map((f) => ({ file: f, calls: calls(f) }));

  // A path that stopped matching would pass everything below vacuously.
  it('finds a string to check in every file it names', () => {
    for (const { file, calls: c } of all) expect(c.length, file).toBeGreaterThan(0);
  });

  it('gives every string a Chinese line', () => {
    const missing = all.flatMap(({ calls: c }) => c)
      .filter((c) => c.args.length < 4 && !ROWS.has(c.args[0]))
      .map((c) => `${c.at} ${c.args[0]}`);
    expect(missing).toEqual([]);
  });

  it('writes no Chinese line in Japanese', () => {
    const kana = all.flatMap(({ calls: c }) => c)
      .filter((c) => c.args.length >= 4 && KANA.test(c.args[3]))
      .map((c) => `${c.at} ${c.args[3]}`);
    expect(kana).toEqual([]);
  });
});
