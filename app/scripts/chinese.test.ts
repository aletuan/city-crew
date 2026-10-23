// Every string the app writes has a Simplified Chinese line, and this is
// the proof it still does.
//
// Chinese arrived in steps (21 Oct 2026): step 1 made the language exist
// and fall back to English, step 2 translated the interface a group of
// screens at a time (2a Explore and Search, 2b Collections, 2c the
// profile and the account, 2d trips, the crew and the rest), and step 3
// is the catalog's own rows. `t(en, vi, ja?, zh?)` takes the Chinese last
// and optional — 887 strings were written with three — so a string added
// without one compiles, passes every other test, and reaches a Chinese
// reader in English without anybody noticing. This reads every `t()` call
// under `src/` and fails on one that has no fourth argument.
//
// Until step 2 was done it read a list of the translated files, which
// grew in each PR. With the last group translated the list was every file
// that writes a string, so it reads all of them: a new screen is checked
// from the day it is written, not from the day somebody remembers to add
// it here.
//
// The exception is a row from the database that has no Chinese of its
// own, and two kinds of those are meant to stay that way. Place names —
// a city's, a neighbourhood's — are kept as they are, in Latin letters:
// the owner's rule (21 Oct 2026), because they are the names on the
// signs and the map a visitor reads. A collection's title and
// description are kept in the words its author wrote them in. Both are
// named below, so the list says what is English on purpose.
//
// It also fails on kana in a Chinese string. The two languages share
// characters, and a Japanese line pasted into the Chinese slot looks right
// at a glance and is not Chinese.
//
// Traditional Chinese (21 Oct 2026) is the fifth argument, and is not
// written by hand: `scripts/hant.ts` makes it from the fourth, and `npm
// run hant` writes it in. So the check is equality — a call whose fifth
// argument is not what that file makes of its fourth fails, whichever of
// the two was edited — and the same for every table's `hant` beside its
// `zh`, and for the photo kinds' five-word rows.
//
// The terms and the privacy policy are not here, because they are not
// written with `t()`: a policy binds in the words it was written in, and
// `LegalSheet` shows Chinese readers the English, as it does Japanese.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { chineseTable, hantOf } from './hant';

const src = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });

/** Rows with no Chinese column, on purpose, by the English argument. */
const ROWS = new Set([
  // Place names: a city's, a neighbourhood's, a place's own.
  'c.short_en', 'city.short_en', 'r.en', "hit.place.name_en ?? ''",
  // What a collection's author wrote.
  'item.collection.title_en', 'c.title_en', 'c.desc_en', 'col.title_en', 'col.desc_en', 'own.title_en', 'own.desc_en',
  'list.title_en',
]);

const KANA = /[぀-ヿ]/;

const HAN = /[\u4e00-\u9fff]/;

type Call = { at: string; args: string[]; hant?: string };
/** A Simplified string and its Traditional, wherever they sit together. */
type Pair = { at: string; zh: string; hant: string | undefined; want: string };

const read = (path: string): { calls: Call[]; pairs: Pair[] } => {
  const file = relative(src, path);
  const sf = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true,
    path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const calls: Call[] = [];
  const pairs: Pair[] = [];
  const visit = (node: ts.Node) => {
    const at = `${file}:${sf.getLineAndCharacterOfPosition(node.getStart()).line + 1}`;
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 't') {
      calls.push({ at, args: node.arguments.map((a) => a.getText()) });
      const [, , , zh, hant] = node.arguments;
      if (zh && !ts.isSpreadElement(node.arguments[0])) {
        pairs.push({ at, zh: zh.getText(), hant: hant?.getText(), want: hantOf(zh) });
      }
    }
    const table = ts.isObjectLiteralExpression(node) && chineseTable(node);
    if (table) pairs.push({ at, zh: table.zh.getText(), hant: table.hant?.getText(), want: hantOf(table.zh) });
    // The photo kinds' rows: [en, vi, ja, zh, hant].
    if (ts.isArrayLiteralExpression(node) && node.elements.length === 5 && node.elements.every(ts.isStringLiteral)
      && HAN.test(node.elements[3].getText())) {
      pairs.push({ at, zh: node.elements[3].getText(), hant: node.elements[4].getText(), want: hantOf(node.elements[3]) });
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return { calls, pairs };
};

describe('the app in Chinese', () => {
  const files = walk(src).map(read);
  const all = files.flatMap((f) => f.calls);
  const pairs = files.flatMap((f) => f.pairs);

  // A walk that stopped finding files would pass everything below
  // vacuously. 1,160 calls on 21 Oct 2026.
  it('finds the strings it checks', () => {
    expect(all.length).toBeGreaterThan(1000);
  });

  // A call spread from a table (`t(...def(kind).name)`) is checked by
  // the compiler instead: the table's tuple type names four languages.
  it('gives every string a Chinese line', () => {
    const missing = all
      .filter((c) => c.args.length < 4 && !ROWS.has(c.args[0]) && !c.args[0].startsWith('...'))
      .map((c) => `${c.at} ${c.args[0]}`);
    expect(missing).toEqual([]);
  });

  // Equality, so a Simplified line edited without `npm run hant`, and a
  // Traditional one edited by hand, both fail here.
  it('gives every Chinese line its Traditional, as scripts/hant.ts makes it', () => {
    const wrong = pairs
      .filter((p) => p.hant !== p.want)
      .map((p) => `${p.at} ${p.zh} → ${p.hant ?? '(none)'}, want ${p.want}`);
    expect(wrong, 'run `npm run hant`').toEqual([]);
    // Every call, every table and the nine photo kinds: 1,159 on 21 Oct
    // 2026. A walk that found none would pass the line above vacuously.
    expect(pairs.length).toBeGreaterThan(1000);
  });

  it('writes no Chinese line in Japanese', () => {
    const kana = all
      .filter((c) => c.args.length >= 4 && KANA.test(c.args[3]))
      .map((c) => `${c.at} ${c.args[3]}`);
    expect(kana).toEqual([]);
  });
});
